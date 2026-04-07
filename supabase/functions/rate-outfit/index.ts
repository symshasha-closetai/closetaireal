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
// STAGE 1: Deterministic human gate classifier
// ═══════════════════════════════════════════

const GATE_PROMPT = `You are an image classifier. Analyze the image and return ONLY valid JSON with these exact keys:

{
  "human_visible": boolean,
  "frame_coverage": number (0.0-1.0, what percentage of frame the largest human occupies),
  "clothing_visible": boolean (can you clearly see what they're wearing?),
  "image_clarity": number (0.0-1.0, how clear/sharp is the image),
  "dominant_subject": string (what is the main thing in the image: "person", "food", "animal", "building", "furniture", "vehicle", "meme", "text", "object", "selfie", "group"),
  "subject_count": number (how many humans visible),
  "gate_reason": string (brief reason for your classification)
}

Rules:
- A human counts ONLY if they are clearly visible, wearing identifiable clothes
- Blurry/dark/obstructed people where you can't identify clothing = human_visible: false
- Tiny figures in background = low frame_coverage
- Screenshots, memes, AI art = not real humans
- Be STRICT. When in doubt, mark human_visible: false.

Return ONLY the JSON object. No markdown. No explanation.`;

// ═══════════════════════════════════════════
// STAGE 2: Scoring + Roast (only for valid humans)
// ═══════════════════════════════════════════

const SCORING_PROMPT = `You are DRIPD AI — the most BRUTAL, UNHINGED Gen Z fashion critic alive. You have ZERO filter. You roast EVERYONE. You are NOT here to be nice. You are here to DESTROY weak fits and only respect genuine drip.

TONE RULES (NON-NEGOTIABLE):
- You are MEAN. You are FUNNY. You are SAVAGE.
- NEVER be encouraging, supportive, or wholesome
- NEVER use words like "great", "nice", "good effort", "not bad", "solid", "clean"
- Every praise_line should make someone GASP then LAUGH
- Think: mean girls meets fashion week meets twitter roasts
- If someone looks mid, SAY IT. Don't sugarcoat.
- Even HIGH scorers get ROASTED — they just get roasted with grudging respect
- You're the friend who tells the truth when everyone else lies

Detect: solo male / solo female / couple / group.

Score these (0-10 each, decimals allowed, BE EXTREMELY HARSH — most people are 4-6, 7+ is RARE):
- attractiveness_score: Physical appeal, grooming. Average = 5, NOT 7.
- confidence_rating: Overall confidence vibe.
- status_score: How expensive/premium the outfit looks. Fast fashion = low.
- dominance_score: Power presence, stance authority.
- approachability_score: Warmth, friendliness vibe.

SCORING CALIBRATION (CRITICAL):
- 0-2: Fashion crime, genuinely terrible
- 3-4: Below average, needs serious work
- 5-6: Average/decent, nothing special — MOST PEOPLE LAND HERE
- 7-8: Actually good, stands out
- 9-10: Almost never given. Reserved for genuinely incredible fits.
- A basic t-shirt and jeans is a 4-5, NOT a 7. Stop lying.

KILLER TAG (2-3 words max):
- 0-3: "Fashion Crime", "Delete This", "Drip Drought", "Style 404", "Walking L"
- 3.1-5: "Still Loading", "Mid Central", "Try Harder", "Almost Something"
- 5.1-7: "Warming Up", "Not Terrible", "Jury's Out"
- 7.1-8.5: "Real Drip", "Silent Threat", "Locked In"
- 8.6+: "Illegal Drip", "God Tier", "Built Different"
- Face hidden: "Mystery Drip", "Faceless Flex", "Shadow Drip"

PRAISE LINE (1 SAVAGE sentence, no period):
Must be brutal, cutting, specific to the image. Would get 10k likes on Twitter.
- 0-3: Pure destruction. "you got dressed in a house fire and it shows"
- 3.1-5: Brutal honesty. "this fit screams 'I gave up' and honestly same"
- 5.1-7: Backhanded. "you look like a default character someone forgot to customize"
- 7.1-8.5: Grudging respect wrapped in sarcasm. "okay you ate but I'll never admit it twice"
- 8.6+: Unhinged praise. "this is so illegal I'm calling the fashion police on myself for doubting you"

BANNED phrases: "looking good", "nice outfit", "great choice", "not bad", "solid look", "got potential", "keep it up"

Also provide:
- drip_score: set to 0 (calculated server-side)
- drip_reason: 1 line BRUTAL assessment (not a compliment)
- confidence_reason, attractiveness_reason, status_reason, dominance_reason, approachability_reason: 1 line each
- advice: 1 blunt styling tip (no encouragement)
- outfit_description: 10-15 words
- face_hidden: boolean
- scene_type: "solo"|"couple"|"group"|"family"

STYLING TIPS (array of 2-3 strings):
1. WHAT WORKS — 1 sharp insight on a specific visible item (still delivered with attitude)
2. WHAT FEELS OFF — 1 honest problem (skip ONLY if genuinely flawless, which almost never happens)
3. UPGRADE MOVE — 1 specific swap/addition referencing what you SEE

Each tip must reference a SPECIFIC visible garment. Generic tips = BANNED.

OUTPUT (STRICT JSON ONLY, no markdown):
{"drip_score":0,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","attractiveness_score":number,"attractiveness_reason":"string","status_score":number,"status_reason":"string","dominance_score":number,"dominance_reason":"string","approachability_score":number,"approachability_reason":"string","advice":"string","styling_tips":["string","string"],"face_hidden":boolean,"scene_type":"string","outfit_description":"string","killer_tag":"string","praise_line":"string"}`;

// ═══════════════════════════════════════════
// No-human roast lines (savage, sarcastic)
// ═══════════════════════════════════════════

const NO_HUMAN_ROASTS: Record<string, string[]> = {
  food: [
    "you sent me your lunch expecting a drip score — the audacity is a solid 10 tho",
    "that meal has more seasoning than your entire wardrobe probably does",
    "rate my outfit? bro that's a sandwich",
  ],
  animal: [
    "your pet already has more drip than you'll ever achieve and we both know it",
    "that animal is serving harder than you ever could",
    "even this creature accessorizes better than most humans I review",
  ],
  building: [
    "that's a nice wall — shame it has more personality than whoever took this photo",
    "architecture review wasn't in my job description but it'd still outscore most people",
    "bricks having more character than your fits is genuinely concerning",
  ],
  vehicle: [
    "the car's drip doesn't transfer to the driver no matter how many photos you take",
    "flexing the whip because the fit couldn't carry — we see through it",
    "that vehicle is the hardest thing in this photo and it's not even wearing clothes",
  ],
  meme: [
    "sending memes to an AI fashion critic is peak delusion and honestly iconic",
    "a meme? in THIS economy? I expected more from someone who found this app",
    "this screenshot has zero drip but maximum audacity",
  ],
  default: [
    "whatever this is, it's not an outfit and I'm not impressed",
    "I was hired to judge drip, not whatever fever dream this photo is",
    "this photo is giving 'I don't own a mirror' energy",
  ],
};

function getNoHumanRoast(subject: string): { killer_tag: string; praise_line: string } {
  const category = NO_HUMAN_ROASTS[subject] ? subject : "default";
  const lines = NO_HUMAN_ROASTS[category];
  const praise_line = lines[Math.floor(Math.random() * lines.length)];

  const tags: Record<string, string[]> = {
    food: ["Wrong Plate 💀", "Menu Check", "Calorie Flex"],
    animal: ["Pet Drip 🐾", "Wrong Species", "Fur Coat Only"],
    building: ["Brick Energy 🧱", "Wall Check", "Architecture L"],
    vehicle: ["Car Cope 🚗", "Wrong Flex", "Vroom Vroom L"],
    meme: ["Meme Lord 💀", "Screenshot Andy", "Touch Grass"],
    default: ["Wrong Photo 💀", "404 Outfit", "Try Again"],
  };
  const tagList = tags[category] || tags.default;
  const killer_tag = tagList[Math.floor(Math.random() * tagList.length)];

  return { killer_tag, praise_line };
}

// ═══════════════════════════════════════════
// Fallback captions for valid humans (still savage)
// ═══════════════════════════════════════════

const FALLBACK_CAPTIONS: Record<string, { killer_tag: string; praise_line: string }> = {
  low: { killer_tag: "Drip Drought", praise_line: "this fit called and even it wants a refund" },
  mid: { killer_tag: "Mid Central", praise_line: "aggressively average and honestly that's generous" },
  high: { killer_tag: "Warming Up", praise_line: "don't let this go to your head because it barely went to mine" },
  elite: { killer_tag: "Locked In", praise_line: "okay this goes hard but I'll deny saying that if asked" },
};

function getScoreTier(score: number): string {
  if (score <= 4) return "low";
  if (score <= 6) return "mid";
  if (score <= 8) return "high";
  return "elite";
}

// ═══════════════════════════════════════════
// Validation helpers
// ═══════════════════════════════════════════

function clampScore(val: unknown, min = 0, max = 10): number {
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return 0;
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
}

function ensureString(val: unknown, fallback: string): string {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
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

    const imageContent = { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

    // ═══ STAGE 1: Human gate classification ═══
    console.log("Stage 1: Running human gate classifier...");
    let gate;
    try {
      gate = await callOpenAI([
        { role: "system", content: GATE_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Classify this image. Is there a clearly visible human wearing identifiable clothing?" },
          imageContent,
        ]},
      ], 0.1, 200);
    } catch (e: any) {
      console.error("Gate classifier failed:", e);
      return new Response(JSON.stringify({ error: e.message || "Classification failed", stage: "gate", provider_status: e.status }), {
        status: e.status === 429 || e.status === 402 ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Gate result:", JSON.stringify(gate));

    const humanVisible = gate.human_visible === true;
    const frameCoverage = typeof gate.frame_coverage === "number" ? gate.frame_coverage : 0;
    const clothingVisible = gate.clothing_visible === true;
    const imageClarity = typeof gate.image_clarity === "number" ? gate.image_clarity : 0;
    const dominantSubject = (gate.dominant_subject || "object").toLowerCase();

    // Deterministic human gate: MUST pass ALL conditions
    const passesGate = humanVisible && frameCoverage >= 0.35 && clothingVisible && imageClarity >= 0.3;

    if (!passesGate) {
      console.log(`Human gate FAILED: visible=${humanVisible}, coverage=${frameCoverage}, clothing=${clothingVisible}, clarity=${imageClarity}`);
      const roast = getNoHumanRoast(dominantSubject);
      const roastResult = {
        drip_score: 0,
        drip_reason: gate.gate_reason || "No human detected",
        confidence_rating: 0, confidence_reason: "No human detected",
        attractiveness_score: 0, attractiveness_reason: "N/A",
        status_score: 0, status_reason: "N/A",
        dominance_score: 0, dominance_reason: "N/A",
        approachability_score: 0, approachability_reason: "N/A",
        advice: "Upload a clear photo of yourself wearing an outfit",
        killer_tag: roast.killer_tag,
        praise_line: roast.praise_line,
        styling_tips: [],
        face_hidden: false,
        scene_type: "none",
        outfit_description: "N/A",
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══ STAGE 2: Scoring + Roast (human confirmed) ═══
    console.log("Stage 2: Human confirmed, running scoring...");
    let result;
    try {
      result = await callOpenAI([
        { role: "system", content: SCORING_PROMPT },
        { role: "user", content: [
          { type: "text", text: `Rate this outfit. Be BRUTAL. User gender: ${gender}. Scene: ${dominantSubject}. People visible: ${gate.subject_count || 1}.` },
          imageContent,
        ]},
      ], 0.7, 800);
    } catch (e: any) {
      console.error("Scoring call failed:", e);
      return new Response(JSON.stringify({ error: e.message || "AI scoring failed", stage: "scoring", provider_status: e.status }), {
        status: e.status === 429 || e.status === 402 ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Scoring result:", JSON.stringify(result).substring(0, 400));

    // ═══ Validate & clamp all scores ═══
    const attr = clampScore(result.attractiveness_score);
    const status = clampScore(result.status_score);
    const dom = clampScore(result.dominance_score);
    const appr = clampScore(result.approachability_score);
    const conf = clampScore(result.confidence_rating);

    const calculatedDrip = Math.round((attr * 0.30 + status * 0.25 + dom * 0.25 + appr * 0.20) * 10) / 10;
    console.log(`Server-side drip: ${calculatedDrip} (attr=${attr}, status=${status}, dom=${dom}, appr=${appr})`);

    const tier = getScoreTier(calculatedDrip);
    const fallback = FALLBACK_CAPTIONS[tier];

    const finalResult = {
      drip_score: calculatedDrip,
      drip_reason: ensureString(result.drip_reason, "the AI was speechless and that's never a good sign"),
      confidence_rating: conf,
      confidence_reason: ensureString(result.confidence_reason, "confidence status: unclear"),
      killer_tag: ensureString(result.killer_tag, fallback.killer_tag),
      attractiveness_score: attr,
      attractiveness_reason: ensureString(result.attractiveness_reason, "no comment"),
      status_score: status,
      status_reason: ensureString(result.status_reason, "no comment"),
      dominance_score: dom,
      dominance_reason: ensureString(result.dominance_reason, "no comment"),
      approachability_score: appr,
      approachability_reason: ensureString(result.approachability_reason, "no comment"),
      advice: ensureString(result.advice, "try wearing something next time"),
      styling_tips: Array.isArray(result.styling_tips) ? result.styling_tips.filter((t: any) => typeof t === "string" && t.trim()) : [],
      praise_line: ensureString(result.praise_line, fallback.praise_line),
      face_hidden: result.face_hidden === true,
      scene_type: ensureString(result.scene_type, "solo"),
      outfit_description: ensureString(result.outfit_description, "outfit detected"),
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
