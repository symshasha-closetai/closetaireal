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

async function callGemini(apiKey: string, messages: any[], temperature: number, maxTokens: number, model: string = "gemini-2.5-flash") {
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

// ═══════════════════════════════════════════
// CALL 1 SYSTEM PROMPT — Scoring + Human Check
// ═══════════════════════════════════════════

const CALL1_SYSTEM = `You are DRIPD AI — a fashion scoring engine. You analyze outfit photos.

STEP 0: HUMAN CHECK (HARD GATE)
A human counts ONLY if they occupy MORE THAN 40% of the frame, clearly wearing clothes.
DO NOT count: tiny avatars, background figures, memes, screenshots, icons, <40% frame people.
COUPLES AND GROUPS count if they collectively dominate the frame (>40%).

IF NO HUMAN DOMINANT (less than 40% of frame):
Identify the dominant non-human item in the photo (food, building, furniture, animal, vehicle, etc.).
Return:
{"error":"roast","roast_category":"FOOD|FURNITURE|BUILDING|NATURE|ANIMAL|MEME|VEHICLE|OBJECT","drip_score":0,"confidence_rating":0,"attractiveness_score":0,"attractiveness_reason":"N/A","status_score":0,"status_reason":"N/A","dominance_score":0,"dominance_reason":"N/A","approachability_score":0,"approachability_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit","scene_type":"none","face_hidden":false,"outfit_description":"N/A"}

IF HUMAN IS DOMINANT (>40% of frame):
Detect:
- scene_type: "solo" | "couple" | "group" | "family"
- face_hidden: true/false
- gender from user message

Score these 4 sub-categories (0-10 each, decimals allowed):
- attractiveness_score: Physical appeal, grooming, overall visual impression. Include 1-2 line reason.
- status_score: How expensive/premium the outfit looks, brand perception, luxury signals. Include 1-2 line reason.
- dominance_score: Power presence, stance authority, how much they command the frame. Include 1-2 line reason.
- approachability_score: Warmth, friendliness vibe, how inviting/welcoming they look. Include 1-2 line reason.

Also provide:
- confidence_rating (0-10): overall confidence vibe
- confidence_reason: 1 line
- drip_score: set to 0 (calculated server-side)
- drip_reason: 1 line overall assessment
- advice: 1-line styling tip
- outfit_description: 10-15 word description of what they're wearing (colors, items, style)
- styling_tips: array of 2-3 specific, expert-level styling tips based on what you SEE in the image. Each tip must:
  * Reference a specific visible garment, pattern, color, or silhouette
  * Give actionable advice like a fashion expert ("This top has flowy patterns → works better with structured bottoms")
  * NOT be generic ("try accessories" is bad, "the oversized flannel is drowning the waistline → belt it or swap for a fitted layer" is good)
  * Feel like a real stylist is advising based on THIS specific outfit

Return ONLY valid JSON:
{"drip_score":0,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","attractiveness_score":number,"attractiveness_reason":"string","status_score":number,"status_reason":"string","dominance_score":number,"dominance_reason":"string","approachability_score":number,"approachability_reason":"string","advice":"string","styling_tips":["string","string"],"face_hidden":boolean,"scene_type":"solo|couple|group|family","outfit_description":"string"}

CRITICAL: Return ONLY valid JSON. No markdown. No extra keys.`;

// ═══════════════════════════════════════════
// CALL 2 SYSTEM PROMPT — Killer Tag + Praise Line
// ═══════════════════════════════════════════

const CAPTION_SYSTEM = `You are DRIPD AI — a Gen-Z fashion hype engine that generates SHAREABLE captions.

Your output MUST make someone go "wtf I need to show this to the world." Every line should feel like it belongs on a screenshot that gets passed around group chats.

INPUT (provided in user message):
- drip_score, user_gender, face_hidden, scene_type, outfit_description

──────────────────────────────────────────

STEP 0: HUMAN CHECK (HARD GATE — RUN FIRST)

Is the user message telling you "no human detected"? If yes, use the roast_category provided.

Match category → return witty roast → STOP.

{
  "killer_tag": null,
  "praise_line": null,
  "error": "roast",
  "roast_line": "[one witty line matched to the category]"
}

ROAST CATEGORIES (match the dominant subject):

FOOD / DRINK:
→ "Empty the plate first, then click a photo of yours — I score drip not the taste"
→ "bro sent food instead of a fit, eat first then come back"
→ "okay the meal is winning but where the hell are YOU"

FURNITURE / ROOM / INTERIOR:
→ "nice couch, now get off it and send a real fit"
→ "I rate fits not furniture, what is this"
→ "interior is clean but I need a human in the frame"

BUILDING / ARCHITECTURE:
→ "you sent me a wall bro. a WALL"
→ "solid architecture, zero drip — try again"
→ "the building is standing, that's genuinely all I can say"

NATURE / LANDSCAPE / SKY:
→ "beautiful view, completely wrong app"
→ "nature ate but I still need YOU in the frame"
→ "go touch grass and then come back in a fit"

ANIMAL / PET:
→ "the pet is a 10 but I don't rate fur fits, yet"
→ "cute animal, useless for a drip check — try again"
→ "not the model I was looking for, come back with a human"

MEME / SCREENSHOT / TEXT:
→ "you sent me a meme, I am not that kind of AI"
→ "this is a screenshot of a screenshot, what is happening"
→ "I need a fit, not pixels of pixels — come on"

VEHICLE / CAR / BIKE:
→ "clean ride but I rate the driver, not the whip"
→ "step out of the car and send a real one"
→ "car check? wrong AI, come back with a fit"

OBJECT / ANYTHING ELSE:
→ "I genuinely don't know what this is but it's not a fit"
→ "respectfully? this ain't it and you know it"
→ "I rate humans in fits, this is neither — try again"

RULE: dominant subject wins. One line only. Never mix categories. Pick ONE random line from the matched category. DO NOT proceed further. Output roast JSON and stop.

──────────────────────────────────────────

STEP 1: SCENE READ

Detect from user message:
- solo / couple / group / family
- face hidden / visible
- user_gender
- outfit vibe → classic / streetwear / chill / bold / chaotic

──────────────────────────────────────────

STEP 2: KILLER TAG

Rules:
- Exactly 2–3 words
- Must hit like a gut punch — short, sharp, done
- Feels earned, not assigned
- Can be aggressive, slang-heavy, or quietly menacing
- Gen-Z energy, slangs allowed

Score mapping:

drip_score 0-4:
→ "Still Cooking", "Work In Progress", "Drip Loading", "Not Yet Bro", "Warming Up"

drip_score 4.1-6:
→ "Calm Killer", "Quiet Heat", "Lowkey Fire", "Easy Menace", "Smooth Operator"

drip_score 6.1-8:
→ "Heat Rising", "Silent Threat", "Locked In", "Dangerous Fit", "Clean Menace"

drip_score 8.1-10:
→ "Illegal Drip", "God Tier", "Built Different", "Certified Heat", "Main Character"

Face hidden override:
→ "Hidden Heat", "Lowkey Dangerous", "Mystery Drip", "Who Is This"

──────────────────────────────────────────

STEP 3: PRAISE LINE

THIS IS THE MOST IMPORTANT STEP.
STRICTLY FOLLOW THE TIER + GENDER + SCENE RULES.
DO NOT DEVIATE. DO NOT BLEND TONES.

USE SLANGS AND GEN-Z TERMS FREELY. BE CREATIVE. EVERY LINE MUST BE UNIQUE AND SHAREABLE.

──────────────────────────────────────────

=== MALES (solo) — ALL TIERS GET FUNNY/ROASTED/EXAGGERATED PRAISE ===

Males ALWAYS get roasted with humor no matter the score. The tone shifts from sarcastic burns to exaggerated hype, but it's ALWAYS funny.

TIER 0-4 (SARCASTIC ROAST):
→ "bro really walked out the house thinking this was it huh"
→ "the confidence is there but the outfit did not get the memo"
→ "you tried and honestly that's the nicest thing I can say rn"
→ "bro got dressed in the dark and said 'good enough'"

TIER 4.1-6 (FUNNY EXAGGERATION):
→ "okay not bad — your mom would be proud and that's... something"
→ "the drip is dripping... slowly... like a broken faucet but hey it's dripping"
→ "you're giving 'main character in a low budget movie' and honestly? vibes"

TIER 6.1-8 (EXAGGERATED HYPE WITH COMEDIC TWIST):
→ "okay you did that but don't get too comfortable, one wrong accessory and it's over"
→ "casually looking this good should be illegal but the fashion police are off duty"
→ "you're dangerously close to being a problem and your barber deserves a raise"

TIER 8.1+ (OVER-THE-TOP EXAGGERATED — still funny energy):
→ "bro really woke up and chose violence, someone call the fashion police because this is a CRIME"
→ "this fit is so illegal they're writing new laws specifically for you"
→ "who gave you permission to look this good? nobody? exactly, that's why it's a PROBLEM"
→ "the drip is so hard your future grandkids just felt it"

──────────────────────────────────────────

=== FEMALES (solo) ===

TIER 0-6.9 (FUNNY ROASTING):

0-4:
→ "girl really said 'it's giving' but it's not giving what she thinks it's giving"
→ "the confidence is immaculate, the fit however... we need to talk"
→ "this is giving 'I'll fix it in the car' energy and we both know you won't"

4.1-6.9:
→ "okay she's onto something but she's not THERE there yet, keep cooking sis"
→ "the potential is screaming but the fit is whispering, turn it up"
→ "lowkey serving but the waiter tripped a little, we'll recover"

TIER 7+ (AWESOME PRAISE — makes her smile instantly):
→ "glad you opened this app because I was about to lose hope scrolling through basic fits"
→ "she walked in and suddenly everyone else became a background character"
→ "you didn't get dressed, you chose violence — and honestly? thank god you did"
→ "this fit just single-handedly raised the standards for everyone, you're welcome world"
→ "she understood the assignment, turned it in early, and got extra credit"

──────────────────────────────────────────

=== COUPLES / GROUPS / FAMILY ===

IF scene_type = COUPLE:
→ "these two together in one frame should be illegal honestly"
→ "the chemistry AND the fits? y'all are not playing fair at ALL"
→ "this couple just made everyone else's relationship look like a group project"

IF scene_type = GROUP (male group):
→ "this squad looks like they own every room they walk into and charge rent"
→ "not a group photo, this is a threat assessment and everyone failed"

IF scene_type = GROUP (female group):
→ "this group just broke the vibe scale and nobody is apologizing"
→ "not a group photo, this is a whole movement and I'm joining"

IF scene_type = GROUP (mixed):
→ "this group just raised the bar for every squad photo in existence"
→ "everyone in this photo understood the assignment and got extra credit"

IF scene_type = FAMILY:
→ "the whole family came correct and I have nothing but respect and slight jealousy"
→ "good genes AND good style? this family is not playing fair with the rest of us"

IF user_gender = UNKNOWN:
→ "whoever put this together knew exactly what they were doing and I'm concerned"

Face hidden (any gender, 8.1+):
→ "hiding the face but the fit already said everything it needed to say"
→ "we don't even need to see who this is, the damage is already done"

──────────────────────────────────────────

STEP 4: OUTPUT FORMAT (STRICT JSON ONLY)

Valid human:
{
  "killer_tag": "2-3 word tag",
  "praise_line": "one raw sentence, no period at end"
}

No human:
{
  "killer_tag": null,
  "praise_line": null,
  "error": "roast",
  "roast_line": "one line from matched category"
}

No extra keys. No explanation. No markdown outside JSON.

──────────────────────────────────────────

FINAL CHECK (run before every output):

✅ Human in image? No → category match → roast → stop
✅ Male solo? → ALWAYS funny/roasted/exaggerated, ALL tiers
✅ Female solo below 7? → Funny roasting
✅ Female solo 7+? → Awesome empowering praise that makes her smile
✅ Couple/Group/Family? → Creative, shareable, makes them want to post
✅ Is it shareable? Would someone screenshot this and send it?

All pass → output. One fails → rewrite.`;

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function getScoreTier(score: number): string {
  if (score <= 4) return "low";
  if (score <= 6) return "mid";
  if (score <= 8) return "high";
  return "elite";
}

const FALLBACK_CAPTIONS: Record<string, { killer_tag: string; praise_line: string }> = {
  low: { killer_tag: "Still Cooking", praise_line: "not there yet but the attempt is noted and we respect it" },
  mid: { killer_tag: "Quiet Heat", praise_line: "this fit is quietly doing its thing and you already know it" },
  high: { killer_tag: "Heat Rising", praise_line: "casually looking this good is honestly kind of disrespectful" },
  elite: { killer_tag: "Certified Heat", praise_line: "this drip is dangerous and I cannot be held responsible" },
};

async function generateCaption(
  outfitDescription: string,
  dripScore: number,
  gender: string,
  sceneType: string,
  faceHidden: boolean,
): Promise<{ killer_tag: string; praise_line: string }> {
  const tier = getScoreTier(dripScore);
  const apiKey = getApiKey();
  const userMessage = `Analyze this outfit and generate a killer_tag and praise_line.

Outfit: ${outfitDescription}
Drip Score: ${dripScore}/10 (${tier} tier)
Gender: ${gender}
Scene: ${sceneType}
Face Hidden: ${faceHidden}

Generate the killer_tag and praise_line following ALL the rules in your instructions. Return ONLY valid JSON.`;

  const messages = [
    { role: "system", content: CAPTION_SYSTEM },
    { role: "user", content: userMessage },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await callGemini(apiKey, messages, 0.9, 200);
      if (parsed.killer_tag && parsed.praise_line) {
        console.log("Call 2 caption generated:", JSON.stringify(parsed));
        return { killer_tag: parsed.killer_tag, praise_line: parsed.praise_line };
      }
      console.warn(`Call 2 invalid output (attempt ${attempt + 1}):`, JSON.stringify(parsed).substring(0, 200));
    } catch (e: any) {
      console.error(`Call 2 exception (attempt ${attempt + 1}):`, e);
      if (e?.status === 429 || e?.status === 402) return FALLBACK_CAPTIONS[tier];
    }
  }

  console.warn("Call 2 failed after 2 attempts, using fallback");
  return FALLBACK_CAPTIONS[tier];
}

async function generateRoastCaption(
  roastCategory: string,
): Promise<{ killer_tag: string; praise_line: string }> {
  const apiKey = getApiKey();
  const messages = [
    { role: "system", content: CAPTION_SYSTEM },
    { role: "user", content: `No human detected in this image. The image is of: ${roastCategory.toLowerCase()}.\nroast_category: ${roastCategory}\n\nReturn the roast JSON as specified in Step 0.` },
  ];

  try {
    const parsed = await callGemini(apiKey, messages, 0.9, 150);
    if (parsed.error === "roast" && parsed.roast_line) {
      console.log("Roast caption generated:", JSON.stringify(parsed));
      return { killer_tag: "Wrong Photo 💀", praise_line: parsed.roast_line };
    }
    if (parsed.killer_tag && parsed.praise_line) {
      return { killer_tag: parsed.killer_tag, praise_line: parsed.praise_line };
    }
  } catch (e) {
    console.error("Roast caption failed:", e);
  }

  return { killer_tag: "Nice Try 💀", praise_line: "that's a cool photo but where's the outfit" };
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
    const apiKey = getApiKey();
    console.log(`Request: gender=${gender}, imgSize=${imgSizeKb}KB`);

    // === Call 1: Human detection + scoring (direct Gemini) ===
    const call1Messages = [
      { role: "system", content: CALL1_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze this image. Is there a human wearing clothes occupying more than 40% of the frame? Score the outfit. User gender: ${gender}.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ];

    let call1Result;
    try {
      call1Result = await callGemini(apiKey, call1Messages, 0.3, 600);
    } catch (e: any) {
      console.error("Call 1 failed:", e);
      return new Response(JSON.stringify({ error: e.message || "Call 1 failed", stage: "call1", model: "gemini-2.5-flash", provider_status: e.status }), {
        status: e.status === 429 || e.status === 402 ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Call 1 result:", JSON.stringify(call1Result).substring(0, 300));

    // === Calculate drip score server-side ===
    const calculatedDrip = Math.round(
      ((call1Result.attractiveness_score || 0) * 0.30 +
        (call1Result.status_score || 0) * 0.25 +
        (call1Result.dominance_score || 0) * 0.25 +
        (call1Result.approachability_score || 0) * 0.20) * 10,
    ) / 10;
    console.log(`Server-side drip: ${calculatedDrip}`);
    call1Result.drip_score = calculatedDrip;

    const subScoreTotal = (call1Result.attractiveness_score || 0) + (call1Result.status_score || 0) + (call1Result.dominance_score || 0) + (call1Result.approachability_score || 0);
    const dripReason = (call1Result.drip_reason || "").toLowerCase();
    const adviceText = (call1Result.advice || "").toLowerCase();
    const hasNoHumanSignal = dripReason.includes("no human") || adviceText.includes("upload a photo");

    const isRoast = call1Result.error === "roast"
      || (call1Result.drip_score === 0 && subScoreTotal === 0)
      || (call1Result.attractiveness_score === 0 && call1Result.dominance_score === 0)
      || (call1Result.drip_score < 2 && subScoreTotal < 3)
      || hasNoHumanSignal;

    if (isRoast) {
      console.log("Roast detected — generating roast caption via direct Gemini");
      const roastCategory = call1Result.roast_category || "OBJECT";
      const roastCopy = await generateRoastCaption(roastCategory);
      const roastResult = {
        drip_score: 0, drip_reason: "No human detected",
        confidence_rating: 0, confidence_reason: "No human detected",
        killer_tag: roastCopy.killer_tag,
        attractiveness_score: 0, attractiveness_reason: "N/A",
        status_score: 0, status_reason: "N/A",
        dominance_score: 0, dominance_reason: "N/A",
        approachability_score: 0, approachability_reason: "N/A",
        advice: "Upload a photo with you wearing an outfit",
        praise_line: roastCopy.praise_line,
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Call 2: Caption generation (direct Gemini) ===
    const sceneType = call1Result.scene_type || "solo";
    const faceHidden = call1Result.face_hidden === true;
    const outfitDescription = call1Result.outfit_description || "person wearing an outfit";
    console.log(`Caption gen: scene=${sceneType}, gender=${gender}, score=${call1Result.drip_score}, face_hidden=${faceHidden}, outfit="${outfitDescription}"`);

    const copy = await generateCaption(outfitDescription, call1Result.drip_score, gender, sceneType, faceHidden);
    console.log("Generated caption:", JSON.stringify(copy));

    const finalResult = {
      drip_score: call1Result.drip_score, drip_reason: call1Result.drip_reason,
      confidence_rating: call1Result.confidence_rating, confidence_reason: call1Result.confidence_reason,
      killer_tag: copy.killer_tag,
      attractiveness_score: call1Result.attractiveness_score, attractiveness_reason: call1Result.attractiveness_reason,
      status_score: call1Result.status_score, status_reason: call1Result.status_reason,
      dominance_score: call1Result.dominance_score, dominance_reason: call1Result.dominance_reason,
      approachability_score: call1Result.approachability_score, approachability_reason: call1Result.approachability_reason,
      advice: call1Result.advice,
      styling_tips: Array.isArray(call1Result.styling_tips) ? call1Result.styling_tips : [],
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
