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

// ===== CALL 1: Scoring + outfit description =====
const CALL1_SYSTEM = `You analyze outfit photos. Your ONLY job: detect if there's a human wearing clothes, and either score or roast.

DOMINANT SUBJECT CHECK:
A human counts ONLY if they are the DOMINANT subject - at least 30-40% of the frame, clearly wearing clothes.
DO NOT count: tiny avatars, background figures, memes, screenshots, icons, <20% frame people.
COUPLES AND GROUPS count if they collectively dominate the frame.

IF NO HUMAN - Return: {"error":"roast","roast_category":"<FOOD|FURNITURE|NATURE|ANIMAL|MEME|VEHICLE|OBJECT>","drip_score":0,"confidence_rating":0,"color_score":0,"color_reason":"N/A","posture_score":0,"posture_reason":"N/A","layering_score":0,"layering_reason":"N/A","face_score":0,"face_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit","outfit_description":"not an outfit"}

IF HUMAN IS DOMINANT - score:
- color_score (0-10): color coordination
- posture_score (0-10): posture, stance, body language
- layering_score (0-10): layering, accessories, styling
- face_score (0-10): expression, energy, vibe
- drip_score: set to 0 (calculated server-side)
- confidence_rating (0-10): overall confidence
- Short reason for each, 1-line styling tip as "advice"
- Detect: solo/couple/group, face hidden or visible
- outfit_description: 10-15 word vivid description of what they're actually wearing (colors, items, style)

Return: {"drip_score":0,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"string","face_hidden":boolean,"scene_type":"solo|couple|group","outfit_description":"string"}

CRITICAL: Return ONLY valid JSON. No markdown.`;

// ===== CALL 2: Live caption generation via Lovable AI Gateway =====
const CAPTION_SYSTEM_STANDARD = `You are an AI that generates witty, fun captions for outfit photos.

PERSONALITY: Sounds like a cool, supportive friend who's genuinely impressed or playfully teasing.
STYLE: Gen Z humor, clever wordplay, unexpected comparisons, meme-aware but not try-hard.
TONE: Witty and fun. Hype them up if they look good, gently tease if mid, be playfully honest if bad.

RULES:
- Focus ONLY on outfit, vibe, confidence, styling choices
- Do NOT mention race, religion, body shape, gender identity, or any protected traits
- Keep it fun and shareable — something they'd screenshot and post

OUTPUT: Generate a killer_tag (max 5 words, catchy/funny) and praise_line (max 20 words, viral caption).
The tag and caption MUST reference the actual outfit described — not generic phrases.`;

const CAPTION_SYSTEM_SAVAGE = `You are an AI that generates VIRAL savage captions for outfits.

GOAL: Create a caption so funny, chaotic, and brutally honest that users will screenshot and share it.

PERSONALITY:
- Sounds like a savage best friend in a group chat
- Witty, sarcastic, dramatic
- Never polite, never formal, never generic

IMPORTANT RULES:
- Do NOT use slurs, hate speech, or target protected traits
- Do NOT be offensive about race, religion, body, gender
- Focus ONLY on outfit, vibe, confidence, styling choices
- Keep it edgy but safe enough to not be blocked

STYLE:
- Gen Z humor, meme language
- Slight exaggeration
- Unexpected comparisons
- Chaotic but clever
- "slightly chaotic", "a bit disrespectful but funny", "like a friend roasting you publicly", "borderline risky but not violating rules"

OUTPUT: Generate a killer_tag (max 5 words, savage/catchy) and praise_line (max 20 words, viral caption).
The tag and caption MUST reference the actual outfit described — not generic phrases.

STRUCTURE for the praise_line:
- Start with a relatable setup
- Add a twist
- End with a punchline

EXAMPLES OF GOOD OUTPUT:
- Tag: "Corporate Confusion" / Caption: "Bro dressed like he has a job interview and an identity crisis right after"
- Tag: "Main Character Energy" / Caption: "You didn't wear the outfit, the outfit decided to follow you"`;

const CAPTION_SYSTEM_ROAST = `You are an AI that generates VIRAL savage roasts for non-outfit photos uploaded to a fashion app.

GOAL: The user uploaded something that ISN'T a person wearing clothes (could be food, a pet, furniture, a meme, etc). Roast them hilariously for it.

PERSONALITY: Chaotic, dramatic, Gen Z energy, like a savage group chat friend
STYLE: Meme language, unexpected comparisons, slightly unhinged but never offensive about protected traits

OUTPUT: Generate a killer_tag (max 5 words) and praise_line (max 20 words) that roast the fact they uploaded this instead of an outfit.
Reference what they actually uploaded if possible.`;

// Minimal fallback if Call 2 completely fails twice
const FALLBACK_CAPTIONS: Record<string, { killer_tag: string; praise_line: string }> = {
  low: { killer_tag: "Needs Work 😬", praise_line: "We all have off days, this is yours" },
  mid: { killer_tag: "Not Bad Actually 🤔", praise_line: "You're on the right track, just keep walking" },
  high: { killer_tag: "Looking Good 🔥", praise_line: "Okay we see you, the fit is definitely fitting" },
  elite: { killer_tag: "Absolutely Iconic ✨", praise_line: "This is the kind of outfit that changes lives" },
  roast: { killer_tag: "Nice Try 💀", praise_line: "Upload an actual outfit next time bestie" },
};

function getScoreTier(score: number): string {
  if (score <= 4) return "low";
  if (score <= 6) return "mid";
  if (score <= 8) return "high";
  return "elite";
}

async function generateCaption(
  outfitDescription: string,
  dripScore: number,
  gender: string,
  sceneType: string,
  mode: string,
  isRoast: boolean,
  roastCategory?: string,
): Promise<{ killer_tag: string; praise_line: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, using fallback");
    return FALLBACK_CAPTIONS[isRoast ? "roast" : getScoreTier(dripScore)];
  }

  const tier = getScoreTier(dripScore);
  let systemPrompt: string;
  let userMessage: string;

  if (isRoast) {
    systemPrompt = CAPTION_SYSTEM_ROAST;
    userMessage = `The user uploaded a photo to a fashion app but it's NOT an outfit. It appears to be: ${roastCategory || "unknown object"}. Description: ${outfitDescription}. Mode: ${mode === "savage" ? "savage (be extra chaotic and unhinged)" : "standard (funny but not too harsh)"}. Generate a roast.`;
  } else {
    systemPrompt = mode === "savage" ? CAPTION_SYSTEM_SAVAGE : CAPTION_SYSTEM_STANDARD;
    userMessage = `Outfit: ${outfitDescription}. Score: ${dripScore}/10 (${tier} tier). Gender: ${gender}. Scene: ${sceneType}. Mode: ${mode}.${mode === "savage" ? " Go HARD. Be borderline viral." : ""}`;
  }

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    tools: [{
      type: "function",
      function: {
        name: "generate_caption",
        description: "Generate a killer tag and viral caption for the outfit",
        parameters: {
          type: "object",
          properties: {
            killer_tag: { type: "string", description: "Max 5 words, catchy/savage tag with one emoji" },
            praise_line: { type: "string", description: "Max 20 words, viral caption that references the actual outfit" },
          },
          required: ["killer_tag", "praise_line"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "generate_caption" } },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.log(`Caption Call 2 attempt ${attempt + 1}: mode=${mode}, tier=${tier}, isRoast=${isRoast}`);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        console.warn("Caption Call 2: rate limited");
        if (attempt === 0) { await new Promise(r => setTimeout(r, 1000)); continue; }
        break;
      }
      if (res.status === 402) {
        console.warn("Caption Call 2: credits exhausted");
        break;
      }
      if (!res.ok) {
        const t = await res.text();
        console.error(`Caption Call 2 error [${res.status}]:`, t.substring(0, 300));
        if (attempt === 0) continue;
        break;
      }

      const data = await res.json();

      // Extract from tool call response
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (parsed.killer_tag && parsed.praise_line) {
          console.log("Caption Call 2 success:", JSON.stringify(parsed));
          return { killer_tag: parsed.killer_tag, praise_line: parsed.praise_line };
        }
      }

      // Fallback: try content field
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.killer_tag && parsed.praise_line) {
            console.log("Caption Call 2 success (content fallback):", JSON.stringify(parsed));
            return { killer_tag: parsed.killer_tag, praise_line: parsed.praise_line };
          }
        } catch {}
      }

      console.warn(`Caption Call 2 attempt ${attempt + 1}: invalid response structure`);
      if (attempt === 0) continue;
    } catch (e) {
      console.error(`Caption Call 2 attempt ${attempt + 1} error:`, e);
      if (attempt === 0) continue;
    }
  }

  console.warn("Caption Call 2 failed both attempts, using fallback");
  return FALLBACK_CAPTIONS[isRoast ? "roast" : getScoreTier(dripScore)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile, unfiltered } = await req.json();
    const gender = styleProfile?.gender || "unknown";
    const mode = unfiltered ? "savage" : "standard";

    let imageBase64 = rawBase64;
    if (!imageBase64 && imageUrl) {
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

    // === Call 1: Human detection + scoring + outfit description ===
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

    console.log("Call 1 result:", JSON.stringify(call1Result).substring(0, 300));

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
      const outfitDesc = call1Result.outfit_description || call1Result.roast_category || "unknown object";
      const roastCopy = await generateCaption(outfitDesc, 0, gender, "solo", mode, true, call1Result.roast_category);
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
    const outfitDescription = call1Result.outfit_description || "stylish outfit";
    const normalizedGender = (gender === "male" || gender === "female") ? gender : "unknown";
    console.log(`Caption gen: mode=${mode}, scene=${sceneType}, gender=${normalizedGender}, score=${call1Result.drip_score}, outfit="${outfitDescription}"`);

    const copy = await generateCaption(outfitDescription, call1Result.drip_score, normalizedGender, sceneType, mode, false);
    console.log("Selected copy:", JSON.stringify(copy));

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
