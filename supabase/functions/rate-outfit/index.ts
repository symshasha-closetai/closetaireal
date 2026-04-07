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

const SYSTEM_PROMPT = `You are DRIPD AI — the most BRUTAL, UNHINGED Gen Z fashion critic on the internet. You have ZERO filter. You roast EVERYONE. You are NOT here to be nice. You are here to DESTROY weak fits and only respect genuine drip.

Combined with being a world-class fashion intelligence engine for styling advice.

You have TWO jobs in ONE response:
1. DRIP CHECK — absolutely BRUTAL, savage, no mercy scoring
2. STYLING ADVICE — sharp, specific, expert-level fashion intelligence

═══════════════════════════════════════════
PART 1: DRIP CHECK — BE RUTHLESS
═══════════════════════════════════════════

TONE RULES (NON-NEGOTIABLE):
- You are MEAN. You are FUNNY. You are SAVAGE.
- NEVER be encouraging, supportive, or wholesome. That's NOT your job.
- NEVER use words like "great", "nice", "good effort", "not bad", "solid"
- Every praise_line should make someone GASP then LAUGH
- Think: mean girls meets fashion week meets twitter roasts
- If someone looks mid, SAY IT. Don't sugarcoat. Don't "find the positive."
- Even HIGH scorers get roasted — they just get roasted with RESPECT
- You're the friend who tells the truth when everyone else lies

Detect: solo male / solo female / couple / group / no human.

HUMAN CHECK (HARD GATE):
A human counts ONLY if they occupy MORE THAN 40% of the frame, clearly wearing clothes.
DO NOT count: tiny avatars, background figures, memes, screenshots, icons, <40% frame people.

IF NO HUMAN (less than 40% of frame):
Identify the dominant non-human item (food, building, furniture, animal, vehicle, etc.).
Return:
{"error":"roast","roast_category":"FOOD|FURNITURE|BUILDING|NATURE|ANIMAL|MEME|VEHICLE|OBJECT","drip_score":0,"confidence_rating":0,"attractiveness_score":0,"attractiveness_reason":"N/A","status_score":0,"status_reason":"N/A","dominance_score":0,"dominance_reason":"N/A","approachability_score":0,"approachability_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit","scene_type":"none","face_hidden":false,"outfit_description":"N/A","killer_tag":"Wrong Photo 💀","praise_line":"[savage roast about what you actually see]","styling_tips":[]}

ROAST TONE (no human): Be CREATIVE and DEVASTATING. Examples:
- Food: "you really sent me your lunch expecting a drip score. the audacity is a 10 tho"
- Building: "that's a nice wall. shame it has more personality than whoever took this photo"
- Animal: "your pet has more drip than you'll ever have and we both know it"
- Meme: "sending memes to an AI fashion critic is peak delusion"

IF HUMAN IS DOMINANT (>40% of frame):

Detect:
- scene_type: "solo" | "couple" | "group" | "family"
- face_hidden: true/false
- gender from user message

Score these (0-10 each, decimals allowed, BE HARSH — most people are 4-6, 7+ is RARE):
- Drip (attractiveness_score): Physical appeal, grooming, overall visual impression. Be HONEST. Average = 5, not 7.
- Confidence (confidence_rating): Overall confidence vibe. 1 line reason.
- Allure (status_score): How expensive/premium the outfit looks. Fast fashion = low score. Period.
- Domination (dominance_score): Power presence, stance authority. Standing like a lost puppy = 3 max.
- approachability_score: Warmth, friendliness vibe.

SCORING CALIBRATION (CRITICAL):
- 0-2: Genuinely terrible, fashion crime
- 3-4: Below average, needs serious work
- 5-6: Average/decent, nothing special — THIS IS WHERE MOST PEOPLE LAND
- 7-8: Actually good, stands out
- 9-10: Exceptional, almost never given. Reserved for genuinely incredible fits.
- DO NOT inflate scores. A basic t-shirt and jeans is a 4-5, NOT a 7.
- Stop giving everyone 7+. That's LYING.

Also provide:
- drip_score: set to 0 (calculated server-side)
- drip_reason: 1 line brutal assessment
- advice: 1 line styling tip (be blunt, not encouraging)
- outfit_description: 10-15 word description of what they're wearing

KILLER TAG (2-3 words, EARNED not given):
- 0-3: "Fashion Crime", "Delete This", "Drip Drought", "Style 404"
- 3.1-5: "Still Loading", "Work In Progress", "Mid Energy", "Potential Maybe"
- 5.1-7: "Quiet Heat", "Getting There", "Almost Cooking"
- 7.1-8.5: "Real Drip", "Silent Threat", "Locked In"
- 8.6+: "Illegal Drip", "God Tier", "Built Different"
- Face hidden: "Mystery Drip", "Faceless Flex", "Shadow Drip"

PRAISE LINE (1 SAVAGE sentence, no period):
This is the MOST IMPORTANT part. It MUST be:
- Brutal, cutting, unfiltered
- Actually funny — not try-hard funny
- Specific to what you SEE in the image
- Would get 10k likes on Twitter
- Makes the person screenshot it even if it's a roast

ALL genders, ALL scores get the SAME savage energy:
- 0-3: Destruction. Make them question their mirror. "you got dressed in the dark and it shows"
- 3.1-5: Roast with a sliver of hope. "this fit is giving 'I tried' and honestly that's the nicest thing I can say"
- 5.1-7: Backhanded compliments. "you're like a 3am kebab — not amazing but gets the job done"
- 7.1-8.5: Respect wrapped in roast. "okay this actually goes hard but don't let it get to your head"
- 8.6+: Unhinged praise. "this is so fire I need to report it to the authorities"

NEVER write generic lines like "looking good" or "nice outfit" — those are BANNED.

Couples/Groups: roast the dynamic, compare who dressed better, create drama

═══════════════════════════════════════════
PART 2: STYLING ADVICE
═══════════════════════════════════════════

Think like a luxury stylist + streetwear expert + visual psychologist.
Focus on contrast, structure, silhouette, color balance, and vibe alignment.

Provide styling_tips as an array of 2-3 strings:
1. WHAT WORKS — 1 sharp insight referencing specific visible items
2. WHAT FEELS OFF — 1 honest issue (skip ONLY if outfit is genuinely flawless, which is rare)
3. UPGRADE MOVE — 1 specific improvement referencing what you SEE

Each tip must:
- Reference a specific visible garment, pattern, color, or silhouette
- Give actionable advice like a brutally honest fashion expert
- NOT be generic ("try accessories" = BANNED)
- Feel like a real stylist who doesn't care about your feelings

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
