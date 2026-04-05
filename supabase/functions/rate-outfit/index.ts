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

async function callGemini(apiKey: string, messages: any[], temperature: number, maxTokens: number) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemini-2.5-flash-lite", messages, temperature, max_tokens: maxTokens }),
  });
  if (res.status === 429) throw { status: 429, message: "Rate limited, please try again later." };
  if (res.status === 402) throw { status: 402, message: "AI credits exhausted. Please add funds." };
  if (!res.ok) { const t = await res.text(); console.error("AI error:", res.status, t); throw new Error(`AI error: ${res.status}`); }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} throw new Error("Failed to parse AI response"); }
}

// ── CALL 1: Human detection + scoring ──
const CALL1_SYSTEM = `You analyze outfit photos. Your ONLY job: detect if there's a human wearing clothes, and either score or roast.

STEP 1: Is there a human in this image?

IF NO HUMAN — identify what the image actually is and pick the closest roast category:

FOOD/DRINK → "I rate fits, not meals. feed yourself first, then come back."
FURNITURE/ROOM/INTERIOR → "nice setup but I can't rate what's sitting on the couch."
WALL/BUILDING/ARCHITECTURE → "bro sent a wall. I rate fits, not architecture."
NATURE/LANDSCAPE/SKY → "beautiful view, wrong app."
ANIMAL/PET → "the pet is cute but I don't rate fur fits. yet."
MEME/SCREENSHOT/TEXT/GRAPHIC/DIAGRAM → "you sent me a meme. I'm not that kind of AI."
VEHICLE/CAR/BIKE → "clean ride but I rate the driver, not the car."
OBJECT/PRODUCT/ANYTHING ELSE → "I don't know what this is, but it's not a fit."

Return EXACTLY:
{"error":"roast","roast_line":"<line from matched category>","drip_score":0,"confidence_rating":0,"color_score":0,"color_reason":"N/A","posture_score":0,"posture_reason":"N/A","layering_score":0,"layering_reason":"N/A","face_score":0,"face_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit"}

IF HUMAN DETECTED — score the outfit:
- color_score (0-10): color coordination, palette harmony, contrast
- posture_score (0-10): posture, stance, pose, body language, confidence
- layering_score (0-10): layering, accessories, styling details, texture mix
- face_score (0-10): facial expression, smile, energy, vibe
- drip_score = color_score*0.3 + posture_score*0.3 + layering_score*0.25 + face_score*0.15
- confidence_rating (0-10): overall confidence/body language
- Provide a short reason for each score and a 1-line practical styling tip as "advice"
- Detect: solo/couple/group, face hidden or visible

Return EXACTLY:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"string","face_hidden":boolean,"scene_type":"solo|couple|group"}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`;

// ── CALL 2: Killer Tag + Praise Line ──
function getCall2System(dripScore: number, gender: string, faceHidden: boolean, sceneType: string, profileContext: string) {
  return `You are DRIPD AI — a Gen-Z fashion intelligence engine. You create two outputs: a KILLER TAG and a PRAISE LINE.

INPUT DATA:
- drip_score: ${dripScore.toFixed(1)}
- gender: ${gender}
- face_hidden: ${faceHidden}
- scene_type: ${sceneType}${profileContext}

VOICE RULES:
- Gen Z tone: natural, current, never performative
- No expired slang (no "slay", "periodt", "bussin" unless it fits perfectly)
- No cuss words. No cringe reassurance ("you're beautiful no matter what!")
- Witty ≠ mean. Warm ≠ basic.
- Avoid repetition across tag + praise line
- EMOJIS: Include exactly 1 relevant emoji at the END of the killer_tag. Can include 1-2 emojis in the praise_line where they feel natural.
- The tag and praise line should feel like they were made together

KILLER TAG (MOST IMPORTANT OUTPUT):
- Exactly 2–3 words. Include exactly 1 relevant emoji at the END.
- Must feel like a vibe, not a sentence. Screenshot-worthy.
- Feels personal, not generic. Never reuse examples verbatim.
- Use the drip_score to set the tone:
  • < 4 → self-aware, gently funny (e.g. "Trying Era", "Almost There", "Work In Progress")
  • 4–6.9 → casual, aesthetic, low-key (e.g. "Chill Fit", "Easy Clean", "Quiet Flex")
  • 7–8.4 → confident, smooth, elevated (e.g. "Soft Power", "No Cap Clean", "Effortless Mode")
  • ≥ 8.5 → hype, iconic, slightly unhinged in a good way (e.g. "Elite Drip", "Built Different", "Full Send")
- Face hidden? Always lean into mystery (e.g. "Hidden Drip", "Lowkey Vibe", "Who Is This")
- Examples are just examples — generate unique tags every time

PRAISE LINE:
- Exactly 1 sentence, no period at the end. Can include 1-2 emojis where they feel natural.
- Sounds like a friend who's brutally honest but rooting for you
- Must feel written for THIS specific look
- Match the energy of the killer_tag
- Use drip_score tone:
  • < 4: light roast + genuine encouragement (e.g. "not quite there yet, but the energy? that's a start")
  • 4–6.9: smooth, clean, easy compliment (e.g. "this is the kind of fit that doesn't need to try hard")
  • 7–8.4: aesthetic + slightly flirty (e.g. "effortless looks good on you, clearly")
  • ≥ 8.5: hype, confident, no hesitation (e.g. "this look walked in and raised the bar for everyone")
- Face hidden: playful tease, never harsh (e.g. "whoever's behind the phone is clearly onto something")
- Examples are just examples — generate unique lines every time

SOCIAL CONTEXT (blend as flavor — CRITICAL for couples/groups):

COUPLE PHOTOS (scene_type = "couple"):
- The tag and line MUST reference the duo/pair dynamic — NEVER treat it as a solo shot
- killer_tag examples: "Power Duo 🔥", "Main Characters ✨", "Matched Energy 💫", "Couple Goals 👑", "Built Together 🫶", "Double Trouble 😈"
- praise_line examples: "y'all walked in and the room got nervous", "this duo doesn't need a caption", "the coordination is giving soulmate energy 🫶", "two fits, one vibe — that's rare"
- Close together → chemistry + coordination energy
- Standing apart → individual style that still matches
- Focus on: outfit coordination, complementary colors, matching energy, power couple vibes

GROUP PHOTOS (scene_type = "group"):
- killer_tag examples: "Squad Goals 🔥", "Main Cast ✨", "Full Lineup 💫"
- praise_line examples: "the squad showed up and left no crumbs", "this lineup hits different when everyone's locked in"
- Male-dominant → squad energy, brotherhood vibes
- Female-dominant → collective glow, group slay
- Mixed → synergy, main character energy as a unit

FINAL TEST (mental check before output):
✅ Would someone screenshot this tag?
✅ Does the praise line feel written for THEM, not a template?
✅ Funny without being mean? Hype without being fake?
✅ For couples: Would someone tag their partner in this?
✅ For groups: Would someone send this to the group chat?
If any fail → rewrite.

Return EXACTLY this JSON:
{"killer_tag":"2-3 word tag + emoji","praise_line":"one sentence no period at end"}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`;
}

// ── CALL 2 UNFILTERED: Raw Gen-Z hype engine ──
function getCall2SystemUnfiltered(dripScore: number, gender: string, faceHidden: boolean, sceneType: string) {
  return `You are DRIPD AI — a RAW, UNFILTERED Gen-Z hype engine.
You do NOT sound safe. You do NOT sound corporate.
You sound like that one friend who sees your fit and literally cannot keep it together.

INPUT:
- drip_score: ${dripScore.toFixed(1)}
- user_gender: ${gender}
- face_hidden: ${faceHidden}
- scene_type: ${sceneType}

KILLER TAG:
- Exactly 2–3 words. Must hit like a gut punch — short, sharp, done.
- Can be aggressive, slang-heavy, or quietly menacing.

Score mapping:
drip_score < 4: "Still Cooking", "Work In Progress", "Drip Loading", "Not Yet Bro"
4–6.9: "Calm Killer", "Quiet Heat", "Lowkey Fire", "Easy Menace"
7–8.4: "Heat Rising", "Silent Threat", "Locked In", "Dangerous Fit"
≥ 8.5: "Illegal Drip", "God Tier", "Built Different", "Certified Heat"
Face hidden: "Hidden Heat", "Lowkey Dangerous", "Mystery Drip", "Who Is This"
Examples only — generate unique tags every time. Include 1 emoji at the end.

PRAISE LINE — STRICTLY FOLLOW GENDER + SCORE RULES:

IF gender = male:
TONE: hype friend energy. chaotic. loud. like your boy just saw you walk in and lost his mind.
< 4: "bro this ain't it yet but the fact you tried? motherfucker gets points for that"
4–6.9: "lowkey this fit is bussin and you already know it, stop playing"
7–8.4: "bro said let me just casually look this good, disrespectful honestly"
≥ 8.5: "motherfucker really woke up and chose violence today, absolute respect" / "BITCH?? this fit is actually illegal what the hell is happening"
Face hidden (male): "bro come out from behind the phone this fit is going crazy"

IF gender = female:
< 8 TONE: hype bestie energy. loud, supportive, chaotic but warm.
< 4: "okay it's not fully there yet but babe the ENERGY is doing something"
4–6.9: "lowkey this is clean as hell and you know exactly what you're doing"
7–7.9: "bitch this fit is actually going crazy, who let you out like this"

≥ 8 TONE: COLD FLIRTY MODE — MANDATORY. NO hype bestie lines.
8–8.9: "wearing that like you already know what it does to people" / "the fit isn't even trying that hard and somehow that's the problem"
≥ 9: "whoever sees this in person is not having a normal rest of their day" / "she didn't get dressed. she loaded up."
Face hidden (≥ 8): "hiding the face but the fit already said everything it needed to"
Face hidden (< 8): "bestie come out from behind the phone this is actually fire"

IF gender = unknown:
< 4: "not there yet but the attempt is noted and we respect it"
4–6.9: "lowkey this fit is clean and you know it"
7–8.4: "this fit walked in and quietly raised the bar for everyone"
≥ 8.5: "this is not a fit. this is a problem. a very clean problem."

SOCIAL CHAOS LAYER (blend into praise line — amplify, don't override):
Couple (male): "the fit AND the energy?? bro y'all are actually menaces"
Couple (female ≥ 8): "two people this dangerous in one frame should not be legal"
Couple (female < 8): "the fits are matching the chemistry and I'm not okay"
Group (male): "this squad looks like they run every single room they walk into"
Group (female ≥ 8): "this is not a group photo. this is a threat."
Group (mixed): "this group just broke the vibe scale and nobody is apologizing for it"

CUSS WORD RULES:
- Use freely: bitch, fuck, fuckin, motherfucker, hell, damn, ass, shit
- These are HYPE words — they punch energy UP, never tear the person down
- "bitch" = term of endearment / hype, never an insult
- "motherfucker" = respect / awe, never aggression
- Don't cuss in every line — let it land when it hits
- Never use slurs, never target appearance

VOICE RULES (NON-NEGOTIABLE):
- Male = loud hype friend, chaotic, unhinged respect
- Female below 8 = loud hype bestie, warm chaos
- Female 8+ = cold, smooth, flirty — makes her feel dangerous
- Unknown = neutral energy hype
- NEVER mix these tones across genders
- NEVER write flirty lines for male users
- NEVER write bestie lines for female users above score 8

FINAL CHECK:
✅ Is user_gender male? → hype + cuss energy only
✅ Is user_gender female AND score ≥ 8? → cold flirty ONLY
✅ Is user_gender female AND score < 8? → hype bestie energy only
✅ Would she read the flirty line and go "oh??" and post it immediately?
✅ Would he read the hype line and send it to his group chat?
All pass → output. One fails → rewrite.

Examples are only examples — generate unique content every time.

Return EXACTLY: {"killer_tag":"2-3 word tag + emoji","praise_line":"one raw sentence, no period at end"}
CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`;
}

// ── CALL 2 UNFILTERED ROAST ──
function getUnfilteredRoastPrompt(roastCategory: string) {
  return `You are DRIPD AI — a RAW, UNFILTERED Gen-Z hype engine generating content for non-outfit images.

The image is NOT a person wearing clothes. The roast category is: "${roastCategory}"

ROAST CATEGORIES (match the dominant subject):
FOOD/DRINK: "bro sent food. eat first, then come show me the fit." / "okay the meal is winning but where the hell are YOU."
FURNITURE/ROOM: "nice couch. now get off it and send a real fit." / "I rate fits not furniture, what is this."
WALL/BUILDING: "you sent me a wall bro. a WALL." / "solid architecture, zero drip. try again."
NATURE/LANDSCAPE: "beautiful view, completely wrong app." / "go touch grass and then come back in a fit."
ANIMAL/PET: "the pet is a 10 but I don't rate fur fits. yet." / "not the model I was looking for. come back with a human."
MEME/SCREENSHOT: "you sent me a meme. I am not that kind of AI." / "I need a fit. not pixels of pixels. come on."
VEHICLE/CAR: "clean ride but I rate the driver, not the whip." / "step out of the car and send a real one."
OBJECT/OTHER: "I genuinely don't know what this is but it's not a fit." / "respectfully? this ain't it and you know it."

Generate:
1. killer_tag: A hilarious 2-3 word tag with 1 emoji at the end. Witty, screenshot-worthy.
2. praise_line: One sentence roast using the matched category style. Can use mild cuss words for comedy. Funny, not mean.

DO NOT reuse examples. Be original every time.

Return EXACTLY: {"killer_tag":"2-3 words + emoji","praise_line":"one sentence roast no period"}
CRITICAL: Return ONLY valid JSON.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile, unfiltered } = await req.json();

    // Resolve image
    let imageBase64 = rawBase64;
    if (!imageBase64 && imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) return new Response(JSON.stringify({ error: "Failed to fetch image from URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      let binary = ""; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      imageBase64 = btoa(binary);
    }
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const gender = styleProfile?.gender || "unknown";
    const apiKey = getApiKey();

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = `\n- User profile: ${parts.join(", ")}`;
    }

    // ── CALL 1: Human check + scores ──
    console.log("Call 1: Human detection + scoring...");
    const call1Result = await callGemini(apiKey, [
      { role: "system", content: CALL1_SYSTEM },
      { role: "user", content: [
        { type: "text", text: `Analyze this image. Is there a human wearing clothes? If yes, score the outfit. If no, roast it. User gender: ${gender}.` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      ]},
    ], 0.3, 512);

    console.log("Call 1 result:", JSON.stringify(call1Result).substring(0, 200));

    // ── SERVER-SIDE VALIDATION: Force roast if no human indicators ──
    const subScoreTotal = (call1Result.color_score || 0) + (call1Result.posture_score || 0) + (call1Result.layering_score || 0) + (call1Result.face_score || 0);
    const isRoast = call1Result.error === "roast"
      || (call1Result.drip_score === 0 && subScoreTotal === 0)
      || (call1Result.face_score === 0 && call1Result.posture_score === 0)
      || (call1Result.drip_score < 2 && subScoreTotal < 3);

    if (isRoast) {
      console.log("Roast mode — generating funny killer_tag + roast praise_line via Call 2");
      const roastCategory = call1Result.roast_line || "I don't know what this is, but it's not a fit.";
      
      const roastCall2 = await callGemini(apiKey, [
        { role: "system", content: `You generate funny, shareable content for non-outfit images submitted to a fashion rating app called DRIPD.

The image is NOT a person wearing clothes. The roast category is: "${roastCategory}"

Generate:
1. killer_tag: A hilarious 2-3 word tag. Must be witty, screenshot-worthy. Think meme energy but clean.
   Examples by category: Food → "Not A Fit 🍕", "Drip Or Dip 💧" | Animal → "Fur Coat Only 🐾", "Wrong Model 🐶" | Diagram → "Study Break 📊" | Car → "Wrong Flex 🚗"
   DO NOT reuse these examples. Be original every time.
   IMPORTANT: Include exactly 1 relevant emoji at the END of the killer_tag.

2. praise_line: One sentence roast. Funny, not mean. The kind of line someone would screenshot and send to friends. Can include 1-2 emojis where they feel natural.

Return EXACTLY: {"killer_tag":"2-3 words + emoji","praise_line":"one sentence roast no period"}
CRITICAL: Return ONLY valid JSON.` },
        { role: "user", content: [
          { type: "text", text: "Look at this image and generate a funny killer_tag and roast praise_line for it." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ]},
      ], 0.9, 256);

      console.log("Roast Call 2 result:", JSON.stringify(roastCall2));

      const roastResult = {
        drip_score: 0, drip_reason: "No human detected",
        confidence_rating: 0, confidence_reason: "No human detected",
        killer_tag: roastCall2.killer_tag || "Not A Fit",
        color_score: 0, color_reason: "N/A",
        posture_score: 0, posture_reason: "N/A",
        layering_score: 0, layering_reason: "N/A",
        face_score: 0, face_reason: "N/A",
        advice: "Upload a photo with you wearing an outfit",
        praise_line: roastCall2.praise_line || roastCategory,
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CALL 2: Killer Tag + Praise Line ──
    const faceHidden = call1Result.face_hidden ?? (call1Result.face_score < 2);
    const sceneType = call1Result.scene_type || "solo";
    console.log("Call 2: Generating killer tag + praise line...");

    const call2Result = await callGemini(apiKey, [
      { role: "system", content: getCall2System(call1Result.drip_score, gender, faceHidden, sceneType, profileContext) },
      { role: "user", content: [
        { type: "text", text: "Look at this outfit and generate the killer_tag and praise_line based on the score and vibe rules provided." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      ]},
    ], 0.9, 256);

    console.log("Call 2 result:", JSON.stringify(call2Result));

    // ── MERGE RESULTS ──
    const finalResult = {
      drip_score: call1Result.drip_score,
      drip_reason: call1Result.drip_reason,
      confidence_rating: call1Result.confidence_rating,
      confidence_reason: call1Result.confidence_reason,
      killer_tag: call2Result.killer_tag || "Clean Look",
      color_score: call1Result.color_score,
      color_reason: call1Result.color_reason,
      posture_score: call1Result.posture_score,
      posture_reason: call1Result.posture_reason,
      layering_score: call1Result.layering_score,
      layering_reason: call1Result.layering_reason,
      face_score: call1Result.face_score,
      face_reason: call1Result.face_reason,
      advice: call1Result.advice,
      praise_line: call2Result.praise_line || "this fit speaks for itself",
    };

    return new Response(JSON.stringify({ result: finalResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("rate-outfit error:", e);
    if (e?.status === 429 || e?.status === 402) {
      return new Response(JSON.stringify({ error: e.message }), { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
