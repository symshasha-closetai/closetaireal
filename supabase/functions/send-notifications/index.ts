import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto helpers
async function generateJWT(header: object, payload: object, privateKeyBase64url: string): Promise<string> {
  const enc = new TextEncoder();
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const padding = "=".repeat((4 - (privateKeyBase64url.length % 4)) % 4);
  const base64 = (privateKeyBase64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawKey = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: privateKeyBase64url,
      x: "", // Will be derived
      y: "",
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  ).catch(() => {
    // Fallback: import raw private key
    return crypto.subtle.importKey(
      "pkcs8",
      rawKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  });

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${unsignedToken}.${sigB64}`;
}

async function sendWebPush(
  subscription: any,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidEmail: string
): Promise<boolean> {
  try {
    const endpoint = subscription.endpoint;
    const aud = new URL(endpoint).origin;
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

    // For Web Push, we use a simpler approach - direct fetch with VAPID headers
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
        "Urgency": "high",
      },
      body: payload,
    });

    if (response.status === 201 || response.status === 200) {
      return true;
    }

    // If 410 Gone, subscription is invalid
    if (response.status === 410 || response.status === 404) {
      console.log("Subscription expired, should be cleaned up");
      return false;
    }

    console.error(`Push send failed: ${response.status} ${await response.text()}`);
    return false;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

interface NotificationCandidate {
  userId: string;
  type: string;
  subtype: string;
  title: string;
  body: string;
  priority: number;
  url?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = "BPwsylb5rG9Mo9dmJtI13QgpjVSiHhtw1BcDFOXz-eEl3f3QbOX3tshVRJnCmXU7asKYCeZ7uyKYGXL9rcj-tz4";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidEmail = Deno.env.get("VAPID_EMAIL") || "mailto:support@dripd.app";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with active push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription, preferences");

    if (subError || !subscriptions?.length) {
      console.log("No push subscriptions found:", subError?.message);
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date();
    const hour = now.getUTCHours(); // We'll use UTC, users can be in different zones
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];

    let totalSent = 0;

    for (const sub of subscriptions) {
      const userId = sub.user_id;
      const prefs = (sub as any).preferences || { streak: true, competition: true, progression: true, social: true };
      const candidates: NotificationCandidate[] = [];

      // --- COOLDOWN CHECK ---
      const { data: recentLogs } = await supabase
        .from("notification_log")
        .select("type, subtype, sent_at")
        .eq("user_id", userId)
        .gte("sent_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString())
        .order("sent_at", { ascending: false });

      const sentToday = recentLogs?.length || 0;
      if (sentToday >= 3) {
        console.log(`User ${userId}: hit daily limit (${sentToday})`);
        continue; // Skip this user entirely
      }

      // Check 2-hour gap for same subtype
      const recentSubtypes = new Set(
        (recentLogs || [])
          .filter(l => new Date(l.sent_at).getTime() > now.getTime() - 2 * 3600 * 1000)
          .map(l => l.subtype)
      );

      // --- 1. COMPETITION TRIGGERS (priority 1) ---
      try {
        // Get user's best score today
        const { data: todayScores } = await supabase
          .from("drip_history")
          .select("score, created_at")
          .eq("user_id", userId)
          .gte("created_at", today + "T00:00:00Z")
          .order("score", { ascending: false })
          .limit(1);

        if (todayScores?.length) {
          const userBestToday = Number(todayScores[0].score);

          // Get all friends' scores today to check rank
          const { data: friendRows } = await supabase
            .from("friends")
            .select("user_id, friend_id")
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
            .eq("status", "accepted");

          const friendIds = (friendRows || []).map(f =>
            f.user_id === userId ? f.friend_id : f.user_id
          );

          if (friendIds.length > 0) {
            // Check if any friend beat user's score today
            const { data: friendScores } = await supabase
              .from("drip_history")
              .select("user_id, score")
              .in("user_id", friendIds)
              .gte("created_at", today + "T00:00:00Z")
              .order("score", { ascending: false })
              .limit(5);

            const higherFriends = (friendScores || []).filter(f => Number(f.score) > userBestToday);

            if (higherFriends.length > 0 && !recentSubtypes.has("score_beaten")) {
              // Get the friend's name
              const { data: friendProfile } = await supabase
                .from("profiles")
                .select("name, username")
                .eq("user_id", higherFriends[0].user_id)
                .single();

              const friendName = friendProfile?.name || friendProfile?.username || "Someone";

              candidates.push({
                userId,
                type: "competition",
                subtype: "score_beaten",
                title: "Someone's coming for you 😳",
                body: `${friendName} just scored ${higherFriends[0].score} — that's higher than yours`,
                priority: 1,
                url: "/",
              });
            }
          }
        }
      } catch (e) {
        console.error(`Competition trigger error for ${userId}:`, e);
      }

      // --- 2. STREAK TRIGGERS (priority 2) ---
      try {
        const { data: latestLook } = await supabase
          .from("daily_looks")
          .select("streak, look_date")
          .eq("user_id", userId)
          .order("look_date", { ascending: false })
          .limit(1);

        if (latestLook?.length) {
          const lastStreak = latestLook[0].streak;
          const lastDate = latestLook[0].look_date;

          // If last look was yesterday and no look today, streak is at risk
          if (lastDate === yesterday && lastStreak > 1 && !recentSubtypes.has("streak_warning")) {
            candidates.push({
              userId,
              type: "streak",
              subtype: "streak_warning",
              title: "Don't lose your fire 🔥",
              body: `Your ${lastStreak}-day streak breaks at midnight. Upload now!`,
              priority: 2,
              url: "/",
            });
          }
        }
      } catch (e) {
        console.error(`Streak trigger error for ${userId}:`, e);
      }

      // --- 3. PROGRESSION TRIGGERS (priority 3) ---
      try {
        const { data: allScores } = await supabase
          .from("drip_history")
          .select("score, created_at")
          .eq("user_id", userId)
          .order("score", { ascending: false })
          .limit(10);

        if (allScores && allScores.length >= 2) {
          const bestScore = Number(allScores[0].score);
          const bestCreatedAt = allScores[0].created_at;

          // Check if the best score was created today
          if (bestCreatedAt >= today + "T00:00:00Z" && !recentSubtypes.has("personal_best")) {
            const secondBest = Number(allScores[1].score);
            if (bestScore > secondBest) {
              candidates.push({
                userId,
                type: "progression",
                subtype: "personal_best",
                title: "New record! 💎",
                body: `You just hit ${bestScore}/10 — your best ever`,
                priority: 3,
                url: "/",
              });
            }
          }

          // Tier check
          const avgScore = allScores.reduce((sum, s) => sum + Number(s.score), 0) / allScores.length;
          const tiers = [
            { name: "Diamond", min: 9.5, emoji: "💎" },
            { name: "Elite", min: 8.5, emoji: "🏆" },
            { name: "Gold", min: 7.0, emoji: "🥇" },
            { name: "Silver", min: 5.0, emoji: "🥈" },
          ];

          for (const tier of tiers) {
            if (avgScore >= tier.min) {
              // Check if we already sent a tier notification for this tier
              const { data: tierLogs } = await supabase
                .from("notification_log")
                .select("id")
                .eq("user_id", userId)
                .eq("subtype", `tier_${tier.name.toLowerCase()}`)
                .limit(1);

              if (!tierLogs?.length) {
                candidates.push({
                  userId,
                  type: "progression",
                  subtype: `tier_${tier.name.toLowerCase()}`,
                  title: `${tier.name} tier unlocked ${tier.emoji}`,
                  body: `You've reached ${tier.name}. Keep pushing!`,
                  priority: 3,
                  url: "/profile",
                });
              }
              break; // Only check highest eligible tier
            }
          }
        }
      } catch (e) {
        console.error(`Progression trigger error for ${userId}:`, e);
      }

      // --- 4. SOCIAL TRIGGERS (priority 4) ---
      try {
        // Check for recently accepted friend requests (last 30 min)
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
        const { data: acceptedFriends } = await supabase
          .from("friends")
          .select("friend_id, created_at")
          .eq("user_id", userId)
          .eq("status", "accepted")
          .gte("created_at", thirtyMinAgo);

        if (acceptedFriends?.length && !recentSubtypes.has("friend_accepted")) {
          const { data: friendProfile } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("user_id", acceptedFriends[0].friend_id)
            .single();

          const friendName = friendProfile?.name || friendProfile?.username || "Someone";
          candidates.push({
            userId,
            type: "social",
            subtype: "friend_accepted",
            title: "New rival added 🤝",
            body: `${friendName} accepted — check their score`,
            priority: 4,
            url: "/messages",
          });
        }
      } catch (e) {
        console.error(`Social trigger error for ${userId}:`, e);
      }

      // --- SELECT BEST CANDIDATE (filtered by user preferences) ---
      const filteredCandidates = candidates.filter(c => {
        if (c.type === "streak" && !prefs.streak) return false;
        if (c.type === "competition" && !prefs.competition) return false;
        if (c.type === "progression" && !prefs.progression) return false;
        if (c.type === "social" && !prefs.social) return false;
        return true;
      });
      if (filteredCandidates.length === 0) continue;

      // Sort by priority (lower = higher priority)
      filteredCandidates.sort((a, b) => a.priority - b.priority);
      const best = filteredCandidates[0];

      // Time-of-day filtering
      const isValidTime = (
        (best.type === "streak" && (hour >= 17 || hour <= 23)) || // Evening for streak
        (best.type === "competition" && (hour >= 18 || hour <= 23)) || // Evening/night for competition
        (best.type === "progression" && hour >= 7 && hour <= 22) || // Daytime for progression
        (best.type === "social" && hour >= 7 && hour <= 22) // Daytime for social
      );

      if (!isValidTime) {
        console.log(`User ${userId}: skipping ${best.subtype} - outside time window (hour: ${hour})`);
        continue;
      }

      // Send the notification
      const payload = JSON.stringify({
        title: best.title,
        body: best.body,
        url: best.url || "/",
        icon: "/dripd-logo-192.webp",
      });

      const sent = await sendWebPush(
        sub.subscription,
        payload,
        vapidPublicKey,
        vapidPrivateKey || "",
        vapidEmail
      );

      if (sent) {
        // Log the notification
        await supabase
          .from("notification_log")
          .insert({
            user_id: userId,
            type: best.type,
            subtype: best.subtype,
            title: best.title,
            body: best.body,
          });

        totalSent++;
        console.log(`Sent ${best.subtype} notification to ${userId}`);
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, evaluated: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Send notifications error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
