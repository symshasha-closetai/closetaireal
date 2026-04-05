import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getApiKey(): string {
  const keys = [
    Deno.env.get("GOOGLE_AI_API_KEY"),
    Deno.env.get("GOOGLE_AI_API_KEY_2"),
    Deno.env.get("GOOGLE_AI_API_KEY_3"),
    Deno.env.get("GOOGLE_AI_API_KEY_4"),
  ].filter(Boolean) as string[];
  if (keys.length === 0) throw new Error("No GOOGLE_AI_API_KEY configured");
  return keys[Math.floor(Math.random() * keys.length)];
}

async function callGemini(apiKey: string, messages: any[], temperature: number, maxTokens: number, model: string = "gemini-2.5-flash-lite") {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (res.status === 429) throw { status: 429, message: "Rate limited, please try again later.", stage: "gemini_call" };
  if (res.status === 402) throw { status: 402, message: "AI credits exhausted.", stage: "gemini_call" };
  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini error [${res.status}] model=${model}:`, t.substring(0, 500));
    if (t.includes("SAFETY") || t.includes("blocked") || t.includes("HarmCategory")) {
      throw { status: res.status, message: "Content blocked by safety filter", stage: "safety_block", model };
    }
    throw { status: res.status, message: `Gemini ${res.status}: ${t.substring(0, 200)}`, stage: "provider_error", model };
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const finishReason = data.choices?.[0]?.finish_reason || "unknown";
  console.log(`Gemini raw (model=${model}, finish=${finishReason}):`, content.substring(0, 300));
  if (!content.trim()) {
    throw { status: 200, message: "Empty response from AI", stage: "empty_response", model, finish_reason: finishReason };
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
    throw { status: 200, message: "Failed to parse AI response as JSON", stage: "json_parse", model };
  }
}

// ===== LIVE CAPTION GENERATION via Gemini 2.5 Flash =====

const CAPTION_SYSTEM_STANDARD = `You are DRIPD AI — a witty, clever fashion commentator. You create fun, memorable captions for outfit photos.

PERSONALITY: Witty, playful, clever comparisons, meme-aware. Like a fashion-savvy friend who always has the perfect comment.

RULES:
- Focus ONLY on the outfit, vibe, styling, confidence
- Never reference race, religion, body shape, gender identity negatively
- Use Gen Z language naturally (not forced)
- Be creative with unexpected comparisons and wordplay

SCORE TIERS:
- low (0-4): Playfully roast the styling choices, keep it fun not mean
- mid (4.1-6): Acknowledge effort, point out what's almost working
- high (6.1-8): Genuine hype, clever compliments, "main character" energy
- elite (8.1-10): Over-the-top worship, "this should be illegal" energy

GENDER TONE:
- male: "bro", "my guy", "king" vibes
- female: "bestie", "queen", "she" vibes
- unknown: gender-neutral, "legend", "icon"

SCENE:
- couple: reference them as a pair, "y'all", "power couple"
- group: "squad", "the whole crew", plural language

Return ONLY valid JSON: {"killer_tag":"max 5 words with one emoji","praise_line":"max 20 words, viral caption with setup→twist→punchline"}`;

const CAPTION_SYSTEM_SAVAGE = `You are DRIPD AI in SAVAGE MODE — a chaotic, brutally honest fashion roaster. You sound like a savage best friend in a group chat who has zero filter.

PERSONALITY:
- Savage, sarcastic, dramatic, chaotic
- Gen Z humor, meme language, slight exaggeration
- Unexpected comparisons, relatable setups with a twist and punchline
- "slightly chaotic", "a bit disrespectful but funny", "like a friend roasting you publicly", "borderline risky but not violating rules"

RULES:
- Focus ONLY on outfit, vibe, confidence, styling choices
- Do NOT use slurs, hate speech, or target protected traits (race, religion, body, gender)
- Keep it edgy but safe enough to not be blocked
- Every caption should be screenshot-worthy and shareable

SCORE TIERS:
- low (0-4): DESTROY the outfit (not the person). Brutal honesty about the styling disaster. Make them laugh at their own choices
- mid (4.1-6): Backhanded compliments, "you tried" energy, savage but not cruel
- high (6.1-8): Chaotic hype, aggressive compliments, "I hate how good this is" energy
- elite (8.1-10): Unhinged worship, violent levels of hype, "this outfit just ruined my life"

GENDER TONE:
- male: "bro", "my guy", aggressive bro energy, loud and chaotic
- female score<8: warm chaos, "bestie", supportive but savage
- female score>=8: cold, flirty, "she knows exactly what she's doing" energy
- unknown: chaotic neutral, "legend" vibes

SCENE:
- couple: roast/hype them as a unit, "y'all", competitive energy
- group: "the squad", "main characters", collective chaos

Return ONLY valid JSON: {"killer_tag":"max 5 words with one emoji","praise_line":"max 20 words, viral caption with setup→twist→punchline"}`;

function getScoreTier(score: number): string {
  if (score <= 4) return "low";
  if (score <= 6) return "mid";
  if (score <= 8) return "high";
  return "elite";
}

const FALLBACK_CAPTIONS: Record<string, { killer_tag: string; praise_line: string }> = {
  low: { killer_tag: "Interesting Choice 🤔", praise_line: "The confidence is doing more work than the outfit right now" },
  mid: { killer_tag: "Almost There ✨", praise_line: "You're one styling tweak away from actually cooking" },
  high: { killer_tag: "Okay We See You 👏", praise_line: "This fit just told everyone else to try harder" },
  elite: { killer_tag: "Absolutely Unreal 🔥", praise_line: "This outfit should come with a warning label" },
};

const ROAST_SYSTEM = `You are DRIPD AI — a chaotic fashion roaster. Someone uploaded a photo with NO human wearing clothes. Generate a hilarious roast about what they uploaded instead. Be funny, not mean. Gen Z humor, meme language.

Return ONLY valid JSON: {"killer_tag":"max 5 words with one emoji","praise_line":"max 20 words funny roast"}`;

async function generateCaption(
  outfitDescription: string,
  dripScore: number,
  colorScore: number,
  layeringScore: number,
  confidenceRating: number,
  gender: string,
  sceneType: string,
  mode: string,
): Promise<{ killer_tag: string; praise_line: string }> {
  const tier = getScoreTier(dripScore);
  const systemPrompt = mode === "savage" ? CAPTION_SYSTEM_SAVAGE : CAPTION_SYSTEM_STANDARD;
  const userMessage = `Outfit: ${outfitDescription}
Drip Score: ${dripScore}/10 (${tier} tier)
Color Score: ${colorScore}/10
Layering Score: ${layeringScore}/10
Confidence: ${confidenceRating}/10
Gender: ${gender}
Scene: ${sceneType}
Mode: ${mode}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const apiKey = getApiKey();
      const parsed = await callGemini(apiKey, messages, 0.9, 150, "gemini-2.5-flash");
      if (parsed.killer_tag && parsed.praise_line) {
        console.log("Call 2 caption generated:", JSON.stringify(parsed));
        return { killer_tag: parsed.killer_tag, praise_line: parsed.praise_line };
      }
      console.warn(`Call 2 invalid output (attempt ${attempt + 1}):`, JSON.stringify(parsed).substring(0, 200));
    } catch (e: any) {
      console.error(`Call 2 exception (attempt ${attempt + 1}):`, e);
      if (e?.status === 429) return FALLBACK_CAPTIONS[tier];
    }
  }

  console.warn("Call 2 failed after 2 attempts, using fallback");
  return FALLBACK_CAPTIONS[tier];
}

async function generateRoastCaption(
  roastCategory: string,
  mode: string,
): Promise<{ killer_tag: string; praise_line: string }> {
  const messages = [
    { role: "system", content: ROAST_SYSTEM },
    { role: "user", content: `Someone uploaded a photo of a ${roastCategory.toLowerCase()} instead of an outfit. Generate a funny roast.\nMode: ${mode}` },
  ];

  try {
    const apiKey = getApiKey();
    const parsed = await callGemini(apiKey, messages, 0.9, 150, "gemini-2.5-flash");
    if (parsed.killer_tag && parsed.praise_line) {
      console.log("Roast caption generated:", JSON.stringify(parsed));
      return { killer_tag: parsed.killer_tag, praise_line: parsed.praise_line };
    }
  } catch (e) {
    console.error("Roast caption failed:", e);
  }

  return { killer_tag: "Nice Try 💀", praise_line: "That's a cool photo but where's the outfit" };
}

// ===== Call 1 System Prompt =====
const CALL1_SYSTEM = `You are DRIPD AI — a fashion scoring engine. You analyze outfit photos.

DOMINANT SUBJECT CHECK:
A human counts ONLY if they are the DOMINANT subject - at least 30-40% of the frame, clearly wearing clothes.
DO NOT count: tiny avatars, background figures, memes, screenshots, icons, <20% frame people.
COUPLES AND GROUPS count if they collectively dominate the frame.

IF NO HUMAN - Return: {"error":"roast","roast_category":"<FOOD|FURNITURE|NATURE|ANIMAL|MEME|VEHICLE|OBJECT>","drip_score":0,"confidence_rating":0,"color_score":0,"color_reason":"N/A","posture_score":0,"posture_reason":"N/A","layering_score":0,"layering_reason":"N/A","face_score":0,"face_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit"}

IF HUMAN IS DOMINANT - score:
- color_score (0-10): color coordination
- posture_score (0-10): posture, stance, body language
- layering_score (0-10): layering, accessories, styling
- face_score (0-10): expression, energy, vibe
- drip_score: set to 0 (calculated server-side)
- confidence_rating (0-10): overall confidence
- Short reason for each, 1-line styling tip as "advice"
- Detect: solo/couple/group, face hidden or visible
- outfit_description: 10-15 word description of what the person is actually wearing (colors, items, style)

Return: {"drip_score":0,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"string","face_hidden":boolean,"scene_type":"solo|couple|group","outfit_description":"string"}

CRITICAL: Return ONLY valid JSON. No markdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile, unfiltered } = await req.json();
    const gender = styleProfile?.gender || "unknown";
    const mode = unfiltered ? "savage" : "standard";

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
    const apiKey = getApiKey();
    console.log(`Request: mode=${mode}, gender=${gender}, imgSize=${imgSizeKb}KB`);

    // === Call 1: Human detection + scoring ===
    const call1Messages = [
      { role: "system", content: CALL1_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze this image. Is there a human wearing clothes? Score the outfit. User gender: ${gender}.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ];

    let call1Result;
    try {
      call1Result = await callGemini(apiKey, call1Messages, 0.3, 512);
    } catch (e: any) {
      console.error("Call 1 failed:", e);
      return new Response(JSON.stringify({ error: e.message || "Call 1 failed", stage: "call1", model: "gemini-2.5-flash-lite", provider_status: e.status }), {
        status: e.status === 429 || e.status === 402 ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Call 1 result:", JSON.stringify(call1Result).substring(0, 200));

    // === Calculate drip score server-side ===
    const calculatedDrip = Math.round(
      ((call1Result.color_score || 0) * 0.3 +
        (call1Result.posture_score || 0) * 0.3 +
        (call1Result.layering_score || 0) * 0.25 +
        (call1Result.face_score || 0) * 0.15) * 10,
    ) / 10;
    console.log(`Server-side drip: ${calculatedDrip}`);
    call1Result.drip_score = calculatedDrip;

    const subScoreTotal = (call1Result.color_score || 0) + (call1Result.posture_score || 0) + (call1Result.layering_score || 0) + (call1Result.face_score || 0);
    const dripReason = (call1Result.drip_reason || "").toLowerCase();
    const adviceText = (call1Result.advice || "").toLowerCase();
    const hasNoHumanSignal = dripReason.includes("no human") || adviceText.includes("upload a photo");

    const isRoast = call1Result.error === "roast"
      || (call1Result.drip_score === 0 && subScoreTotal === 0)
      || (call1Result.face_score === 0 && call1Result.posture_score === 0)
      || (call1Result.drip_score < 2 && subScoreTotal < 3)
      || hasNoHumanSignal;

    if (isRoast) {
      console.log("Roast detected — generating live roast caption");
      const roastCategory = call1Result.roast_category || "OBJECT";
      const roastCopy = await generateRoastCaption(roastCategory, mode);
      const roastResult = {
        drip_score: 0, drip_reason: "No human detected",
        confidence_rating: 0, confidence_reason: "No human detected",
        killer_tag: roastCopy.killer_tag,
        color_score: 0, color_reason: "N/A", posture_score: 0, posture_reason: "N/A",
        layering_score: 0, layering_reason: "N/A", face_score: 0, face_reason: "N/A",
        advice: "Upload a photo with you wearing an outfit",
        praise_line: roastCopy.praise_line,
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Call 2: Live caption generation ===
    const sceneType = call1Result.scene_type || "solo";
    const outfitDescription = call1Result.outfit_description || "person wearing an outfit";
    console.log(`Caption gen: mode=${mode}, scene=${sceneType}, gender=${gender}, score=${call1Result.drip_score}, outfit="${outfitDescription}"`);

    const copy = await generateCaption(outfitDescription, call1Result.drip_score, call1Result.color_score || 0, call1Result.layering_score || 0, call1Result.confidence_rating || 0, gender, sceneType, mode);
    console.log("Generated caption:", JSON.stringify(copy));

    const finalResult = {
      drip_score: call1Result.drip_score, drip_reason: call1Result.drip_reason,
      confidence_rating: call1Result.confidence_rating, confidence_reason: call1Result.confidence_reason,
      killer_tag: copy.killer_tag,
      color_score: call1Result.color_score, color_reason: call1Result.color_reason,
      posture_score: call1Result.posture_score, posture_reason: call1Result.posture_reason,
      layering_score: call1Result.layering_score, layering_reason: call1Result.layering_reason,
      face_score: call1Result.face_score, face_reason: call1Result.face_reason,
      advice: call1Result.advice,
      praise_line: copy.praise_line,
    };

    return new Response(JSON.stringify({ result: finalResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("rate-outfit unhandled error:", e);
    const stage = e?.stage || "unknown";
    const model = e?.model || "unknown";
    if (e?.status === 429 || e?.status === 402) {
      return new Response(JSON.stringify({ error: e.message, stage, model }), { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e?.message || "Unknown error", stage, model }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
