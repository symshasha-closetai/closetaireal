import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile } = await req.json();

    let imageBase64 = rawBase64;
    if (!imageBase64 && imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
        const arrayBuf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        imageBase64 = btoa(binary);
      } catch (fetchErr) {
        console.error("Failed to fetch image from URL:", fetchErr);
        return new Response(JSON.stringify({ error: "Failed to fetch image from URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const gender = styleProfile?.gender || null;

    const apiKeys: string[] = [];
    for (const name of ["GOOGLE_AI_API_KEY", "GOOGLE_AI_API_KEY_2", "GOOGLE_AI_API_KEY_3", "GOOGLE_AI_API_KEY_4"]) {
      const k = Deno.env.get(name);
      if (k) apiKeys.push(k);
    }

    if (apiKeys.length === 0) {
      return new Response(JSON.stringify({ error: "No API keys configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = ` Profile: ${parts.join(", ")}.`;
    }

    const genderInstruction = gender === "female"
      ? "Use feminine killer_tag (Queen, Empress, Goddess)."
      : gender === "male"
      ? "Use masculine killer_tag (King, Emperor, Boss)."
      : "Use gender-neutral killer_tag.";

    const prompt = `Fashion stylist AI.${profileContext}

Return ONLY valid JSON:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string"}

Rules:
- All scores 0-10 decimals. drip_score = Color(25%)+Style(20%)+Fit(25%)+Occasion(20%)+Accessories(10%)
- confidence_rating: Score posture/body language 0-10.
- killer_tag: 1-3 words + 1-2 emojis. ${genderInstruction}
- praise_line: witty shareable sentence, Gen Z tone, emojis.
- reasons: 1 sentence each. NO profanity.

Analyze this outfit. Return JSON only.`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    const PER_KEY_TIMEOUT = 30000;
    let result = null;
    let lastError = "";

    for (let i = 0; i < apiKeys.length; i++) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeys[i]}`;

      try {
        const response = await Promise.race([
          fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), PER_KEY_TIMEOUT)),
        ]) as Response;

        if (response.status === 429 || response.status >= 500) {
          lastError = `Key ${i + 1} returned ${response.status}`;
          console.warn(`${lastError}, trying next key...`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `Key ${i + 1} error: ${response.status} ${errText}`;
          console.error(lastError);
          continue;
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          result = JSON.parse(cleaned);
        } catch {
          lastError = `Failed to parse Gemini response from key ${i + 1}`;
          console.error(lastError, content);
          continue;
        }
        break;
      } catch (e) {
        lastError = `Key ${i + 1}: ${e instanceof Error ? e.message : e}`;
        console.warn(lastError);
        continue;
      }
    }

    if (!result) {
      return new Response(JSON.stringify({ error: `All API keys failed. Last: ${lastError}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
