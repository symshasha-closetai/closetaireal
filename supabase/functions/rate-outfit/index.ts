import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callOpenAI(messages: any[], temperature: number, maxTokens: number): Promise<any> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", messages, temperature, max_tokens: maxTokens }),
  });

  if (res.status === 429) throw { status: 429, message: "Rate limited, please try again later.", stage: "openai_call" };
  if (res.status === 402) throw { status: 402, message: "AI credits exhausted.", stage: "openai_call" };
  if (!res.ok) {
    const t = await res.text();
    console.error(`OpenAI error [${res.status}]:`, t.substring(0, 500));
    throw { status: res.status, message: `OpenAI ${res.status}: ${t.substring(0, 200)}`, stage: "provider_error" };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  console.log(`OpenAI raw (finish=${data.choices?.[0]?.finish_reason}):`, content.substring(0, 300));

  if (!content.trim()) {
    throw { status: 200, message: "Empty response from AI", stage: "empty_response" };
  }

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    console.error("JSON parse failed:", cleaned.substring(0, 500));
    throw { status: 200, message: "Failed to parse AI response as JSON", stage: "json_parse" };
  }
}

// ═══════════════════════════════════════════
// SINGLE CALL SYSTEM PROMPT — Scoring + Tag + Line + Styling
// ═══════════════════════════════════════════

const SYSTEM_PROMPT = `You are DRIPD AI — a savage Gen Z fashion critic AND world-class fashion intelligence engine combined.

You have TWO jobs in ONE response:
1. DRIP CHECK — brutal, sarcastic, witty scoring
2. STYLING ADVICE — sharp, non-generic, high-IQ fashion intelligence

═══════════════════════════════════════════
PART 1: DRIP CHECK
═══════════════════════════════════════════

Detect: solo male / solo female / couple / group / no human.

HUMAN CHECK (HARD GATE):
A human counts ONLY if they occupy MORE THAN 40% of the frame, clearly wearing clothes.
DO NOT count: tiny avatars, background figures, memes, screenshots, icons, <40% frame people.

IF NO HUMAN (less than 40% of frame):
Identify the dominant non-human item (food, building, furniture, animal, vehicle, etc.).
Return:
{"error":"roast","roast_category":"FOOD|FURNITURE|BUILDING|NATURE|ANIMAL|MEME|VEHICLE|OBJECT","drip_score":0,"confidence_rating":0,"attractiveness_score":0,"attractiveness_reason":"N/A","status_score":0,"status_reason":"N/A","dominance_score":0,"dominance_reason":"N/A","approachability_score":0,"approachability_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit","scene_type":"none","face_hidden":false,"outfit_description":"N/A","killer_tag":"Wrong Photo 💀","praise_line":"[one witty roast line matched to the category - be creative, savage, funny]","styling_tips":[]}

ROAST TONE (no human): Pick ONE savage line specific to what you see. Examples:
- Food: "empty the plate first, then click a photo of yours — I score drip not taste"
- Building: "you sent me a wall bro. a WALL"
- Animal: "the pet is a 10 but I don't rate fur fits, yet"
- Meme: "you sent me a meme, I am not that kind of AI"

IF HUMAN IS DOMINANT (>40% of frame):

Detect:
- scene_type: "solo" | "couple" | "group" | "family"
- face_hidden: true/false
- gender from user message

Score these 4 (0-10 each, decimals allowed):
- Drip (attractiveness_score): Physical appeal, grooming, overall visual impression. 1-2 line reason.
- Confidence (confidence_rating): Overall confidence vibe. 1 line reason.
- Allure (status_score): How expensive/premium the outfit looks, brand perception, luxury signals. 1-2 line reason.
- Domination (dominance_score): Power presence, stance authority, how much they command the frame. 1-2 line reason.
- approachability_score: Warmth, friendliness vibe. 1-2 line reason.

Also provide:
- drip_score: set to 0 (calculated server-side)
- drip_reason: 1 line overall assessment
- advice: 1 line styling tip
- outfit_description: 10-15 word description of what they're wearing

KILLER TAG (2-3 words, sharp, earned):
- 0-4: "Still Cooking", "Work In Progress", "Drip Loading"
- 4.1-6: "Calm Killer", "Quiet Heat", "Lowkey Fire"
- 6.1-8: "Heat Rising", "Silent Threat", "Locked In"
- 8.1+: "Illegal Drip", "God Tier", "Built Different"
- Face hidden: "Hidden Heat", "Lowkey Dangerous", "Mystery Drip"

PRAISE LINE (1 savage sentence, no period):
Tone: brutal, sarcastic, witty, Gen Z slang, no politeness. Make it viral-worthy.

Males (solo) — ALL tiers get funny/roasted/exaggerated:
- 0-4: sarcastic roast burns
- 4.1-6: funny exaggeration, supportive but still roasting  
- 6.1-8: exaggerated hype with comedic twist
- 8.1+: over-the-top praise, still funny energy

Females (solo):
- 0-6.9: funny roasting (same energy as males)
- 7+: awesome praise that makes her smile instantly, empowering, screenshot-worthy

Couples/Groups/Family: creative, shareable, makes them want to post

═══════════════════════════════════════════
PART 2: STYLING ADVICE
═══════════════════════════════════════════

Think like a luxury stylist + streetwear expert + visual psychologist.
Focus on contrast, structure, silhouette, color balance, and vibe alignment.

Provide styling_tips as an array of 2-3 strings:
1. WHAT WORKS — 1 sharp insight referencing specific visible items
2. WHAT FEELS OFF — 1 honest issue (if any, skip if outfit is solid)
3. UPGRADE MOVE — 1 specific improvement referencing what you SEE

Each tip must:
- Reference a specific visible garment, pattern, color, or silhouette
- Give actionable advice like a fashion expert
- NOT be generic ("try accessories" = bad)
- Feel like a real stylist advising on THIS specific outfit

Style: Clean, confident, slightly edgy. No over-explaining.

═══════════════════════════════════════════
OUTPUT FORMAT (STRICT JSON ONLY)
═══════════════════════════════════════════

For humans:
{"drip_score":0,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","attractiveness_score":number,"attractiveness_reason":"string","status_score":number,"status_reason":"string","dominance_score":number,"dominance_reason":"string","approachability_score":number,"approachability_reason":"string","advice":"string","styling_tips":["string","string"],"face_hidden":boolean,"scene_type":"solo|couple|group|family","outfit_description":"string","killer_tag":"string","praise_line":"string"}

CRITICAL: Return ONLY valid JSON. No markdown. No extra keys. No explanation outside JSON.`;

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

const FALLBACK_CAPTIONS: Record<string, { killer_tag: string; praise_line: string }> = {
  low: { killer_tag: "Still Cooking", praise_line: "not there yet but the attempt is noted and we respect it" },
  mid: { killer_tag: "Quiet Heat", praise_line: "this fit is quietly doing its thing and you already know it" },
  high: { killer_tag: "Heat Rising", praise_line: "casually looking this good is honestly kind of disrespectful" },
  elite: { killer_tag: "Certified Heat", praise_line: "this drip is dangerous and I cannot be held responsible" },
};

function getScoreTier(score: number): string {
  if (score <= 4) return "low";
  if (score <= 6) return "mid";
  if (score <= 8) return "high";
  return "elite";
}

// ═══════════════════════════════════════════
// HTTP Handler
// ═══════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile } = await req.json();
    const gender = styleProfile?.gender || "unknown";

    let imageBase64 = rawBase64?.replace(/^data:image\/\w+;base64,/, "");

    if (!imageBase64 && imageUrl) {
      console.log("Fetching image from URL:", imageUrl.substring(0, 80));
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch image from URL" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      imageBase64 = btoa(binary);
    }
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imgSizeKb = Math.round(imageBase64.length * 3 / 4 / 1024);
    console.log(`Request: gender=${gender}, imgSize=${imgSizeKb}KB`);

    // === Single Call: Scoring + Tag + Line + Styling ===
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze this image. Is there a human wearing clothes occupying more than 40% of the frame? Score the outfit. User gender: ${gender}.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ];

    let result;
    try {
      result = await callOpenAI(messages, 0.7, 800);
    } catch (e: any) {
      console.error("OpenAI call failed:", e);
      return new Response(JSON.stringify({ error: e.message || "AI call failed", stage: e.stage || "call1", provider_status: e.status }), {
        status: e.status === 429 || e.status === 402 ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("AI result:", JSON.stringify(result).substring(0, 400));

    // === Calculate drip score server-side ===
    const calculatedDrip = Math.round(
      ((result.attractiveness_score || 0) * 0.30 +
        (result.status_score || 0) * 0.25 +
        (result.dominance_score || 0) * 0.25 +
        (result.approachability_score || 0) * 0.20) * 10,
    ) / 10;
    console.log(`Server-side drip: ${calculatedDrip}`);
    result.drip_score = calculatedDrip;

    // Check if roast
    const subScoreTotal = (result.attractiveness_score || 0) + (result.status_score || 0) + (result.dominance_score || 0) + (result.approachability_score || 0);
    const dripReason = (result.drip_reason || "").toLowerCase();
    const adviceText = (result.advice || "").toLowerCase();
    const hasNoHumanSignal = dripReason.includes("no human") || adviceText.includes("upload a photo");

    const isRoast = result.error === "roast"
      || (result.drip_score === 0 && subScoreTotal === 0)
      || (result.attractiveness_score === 0 && result.dominance_score === 0)
      || (result.drip_score < 2 && subScoreTotal < 3)
      || hasNoHumanSignal;

    if (isRoast) {
      console.log("Roast detected");
      const roastResult = {
        drip_score: 0, drip_reason: "No human detected",
        confidence_rating: 0, confidence_reason: "No human detected",
        killer_tag: result.killer_tag || "Wrong Photo 💀",
        attractiveness_score: 0, attractiveness_reason: "N/A",
        status_score: 0, status_reason: "N/A",
        dominance_score: 0, dominance_reason: "N/A",
        approachability_score: 0, approachability_reason: "N/A",
        advice: "Upload a photo with you wearing an outfit",
        praise_line: result.praise_line || "that's a cool photo but where's the outfit",
        styling_tips: [],
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure killer_tag and praise_line exist with fallbacks
    const tier = getScoreTier(calculatedDrip);
    const fallback = FALLBACK_CAPTIONS[tier];

    const finalResult = {
      drip_score: result.drip_score,
      drip_reason: result.drip_reason,
      confidence_rating: result.confidence_rating,
      confidence_reason: result.confidence_reason,
      killer_tag: result.killer_tag || fallback.killer_tag,
      attractiveness_score: result.attractiveness_score,
      attractiveness_reason: result.attractiveness_reason,
      status_score: result.status_score,
      status_reason: result.status_reason,
      dominance_score: result.dominance_score,
      dominance_reason: result.dominance_reason,
      approachability_score: result.approachability_score,
      approachability_reason: result.approachability_reason,
      advice: result.advice,
      styling_tips: Array.isArray(result.styling_tips) ? result.styling_tips : [],
      praise_line: result.praise_line || fallback.praise_line,
    };

    return new Response(JSON.stringify({ result: finalResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("rate-outfit unhandled error:", e);
    if (e?.status === 429 || e?.status === 402) {
      return new Response(JSON.stringify({ error: e.message, stage: e.stage || "unknown" }), { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e?.message || "Unknown error", stage: e?.stage || "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
