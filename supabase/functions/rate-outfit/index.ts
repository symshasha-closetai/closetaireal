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
  if (!res.ok) {
    const t = await res.text();
    console.error("AI error:", res.status, t);
    throw new Error(`AI error: ${res.status}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
      }
    }
    throw new Error("Failed to parse AI response");
  }
}

const CALL1_SYSTEM = `You analyze outfit photos. Your ONLY job: detect if there's a human wearing clothes, and either score or roast.

STEP 1: DOMINANT SUBJECT CHECK (CRITICAL — READ THIS FIRST):

A human counts ONLY if they are the DOMINANT subject of the image — taking up at least 30-40% of the frame and clearly wearing a visible outfit.

DO NOT count as "human detected":
- Tiny profile pictures, avatars, or icons within screenshots
- Small figures in the background of a landscape
- Faces in memes, thumbnails, or embedded images within a screenshot
- People who occupy less than 20% of the frame
- Circular profile photos or contact images in messaging apps
- Any human figure that is NOT the main focus of the image

ASK YOURSELF: "What is the DOMINANT thing in this image — the thing taking up the most space?"
If the answer is text, a screenshot, a UI, food, an object, a diagram, etc. — it is NOT a fashion photo. ROAST IT.
Only if the answer is "a person/people wearing clothes" should you proceed to scoring.

COUPLES AND GROUPS are exceptions — multiple people together count as long as they collectively dominate the frame.

IF NO HUMAN (or human is NOT dominant) — identify what the dominant content actually is and pick the closest roast category:

FOOD/DRINK → roast the food
FURNITURE/ROOM/INTERIOR → roast the room
WALL/BUILDING/ARCHITECTURE → roast the wall
NATURE/LANDSCAPE/SKY → roast the view
ANIMAL/PET → roast the pet
MEME/SCREENSHOT/TEXT/GRAPHIC/DIAGRAM/UI → roast the screenshot/content
VEHICLE/CAR/BIKE → roast the vehicle
OBJECT/PRODUCT/ANYTHING ELSE → roast the object

Return EXACTLY:
{"error":"roast","roast_line":"<brief description of what the dominant subject is>","roast_category":"<category from above>","drip_score":0,"confidence_rating":0,"color_score":0,"color_reason":"N/A","posture_score":0,"posture_reason":"N/A","layering_score":0,"layering_reason":"N/A","face_score":0,"face_reason":"N/A","drip_reason":"No human detected","confidence_reason":"No human detected","advice":"Upload a photo with you wearing an outfit"}

IF HUMAN IS DOMINANT — score the outfit:
- color_score (0-10): color coordination, palette harmony, contrast
- posture_score (0-10): posture, stance, pose, body language, confidence
- layering_score (0-10): layering, accessories, styling details, texture mix
- face_score (0-10): facial expression, smile, energy, vibe
- drip_score: set to 0 (will be calculated server-side from sub-scores)
- confidence_rating (0-10): overall confidence/body language
- Provide a short reason for each score and a 1-line practical styling tip as "advice"
- Detect: solo/couple/group, face hidden or visible

Return EXACTLY:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"string","face_hidden":boolean,"scene_type":"solo|couple|group"}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`;

function getScoreTier(score: number): string {
  if (score < 4) return "NEEDS WORK";
  if (score < 7) return "DECENT";
  if (score < 8.5) return "FIRE";
  return "ELITE";
}

function getSceneRule(sceneType: string): string {
  if (sceneType === "couple") {
    return `SCENE RULE: This is a COUPLE photo. You MUST write like there are TWO people in frame.
- Use plural language: y'all, you two, both of you, duo, pair, together.
- Reference chemistry, coordination, matching energy, shared vibe, or couple tension.
- NEVER write this like a solo compliment.`;
  }
  if (sceneType === "group") {
    return `SCENE RULE: This is a GROUP photo. You MUST write like there are multiple people in frame.
- Use plural language: y'all, squad, crew, lineup, everyone, all of you.
- Reference collective energy, lineup strength, or shared aura.
- NEVER write this like a solo compliment.`;
  }
  return `SCENE RULE: This is a SOLO photo. Write to one person only.`;
}

function hasSceneCue(text: string, sceneType: string): boolean {
  if (sceneType === "couple") return /\b(y['’]all|you two|both of you|duo|pair|together|chemistry|couple|matched|both)\b/i.test(text);
  if (sceneType === "group") return /\b(y['’]all|squad|crew|lineup|everyone|all of you|group|team|together)\b/i.test(text);
  return true;
}

function hasSavageCue(text: string): boolean {
  return /\b(lowkey|no cap|deadass|went crazy|locked in|clean as hell|different|ate|stood on business|menace|wild|cooked)\b/i.test(text);
}

function hasLowScorePraise(text: string): boolean {
  return /\b(clean|fire|elite|iconic|perfect|amazing|gorgeous|stunning|beautiful|hard|different|illegal|god tier|main character)\b/i.test(text);
}

function hasHighScoreDiss(text: string): boolean {
  return /\b(trying era|almost there|work in progress|not there yet|still cooking|ain['’]t it|mid|meh|needs work)\b/i.test(text);
}

function getFallbackCopy(dripScore: number, sceneType: string, unfiltered: boolean) {
  const tier = getScoreTier(dripScore);

  if (sceneType === "couple") {
    if (unfiltered) {
      if (tier === "NEEDS WORK") return { killer_tag: "Chaotic Duo 😬", praise_line: "y'all got chemistry for sure, but deadass the fits are not on the same page yet" };
      if (tier === "DECENT") return { killer_tag: "Cute Trouble 😏", praise_line: "lowkey, you two are carrying this off chemistry and that's saving the whole vibe" };
      if (tier === "FIRE") return { killer_tag: "Power Menace 😮‍💨", praise_line: "deadass y'all went crazy together, the duo energy is doing heavy damage" };
      return { killer_tag: "Double Trouble 😈", praise_line: "no cap, you two look illegal together and the whole frame is absolutely different" };
    }

    if (tier === "NEEDS WORK") return { killer_tag: "Mixed Signals 😬", praise_line: "you two have chemistry, but the fits need more of the same energy to really click" };
    if (tier === "DECENT") return { killer_tag: "Cute Sync ✨", praise_line: "y'all look good together and the coordination is lowkey starting to land" };
    if (tier === "FIRE") return { killer_tag: "Power Pair 🔥", praise_line: "you two look locked in and the shared energy makes the whole photo hit harder" };
    return { killer_tag: "Main Duo 👑", praise_line: "y'all walked in like the caption wrote itself and honestly that's dangerous" };
  }

  if (sceneType === "group") {
    if (unfiltered) {
      if (tier === "NEEDS WORK") return { killer_tag: "Squad Loading 😬", praise_line: "the squad has energy, but no cap the fits still need one cleaner direction" };
      if (tier === "DECENT") return { killer_tag: "Crew Pressure 😮‍💨", praise_line: "lowkey this lineup is doing enough damage to keep the room interested" };
      if (tier === "FIRE") return { killer_tag: "Lineup Crazy 🔥", praise_line: "deadass, y'all are locked in and the group energy makes this hit way harder" };
      return { killer_tag: "Whole Threat 😈", praise_line: "no cap, this group looks like a problem and everybody else just got cooked" };
    }

    if (tier === "NEEDS WORK") return { killer_tag: "Almost Synced 😅", praise_line: "the squad energy is there, but the outfits need one stronger common thread" };
    if (tier === "DECENT") return { killer_tag: "Clean Lineup ✨", praise_line: "the group looks coordinated and that shared energy is doing a lot for the shot" };
    if (tier === "FIRE") return { killer_tag: "Main Cast 🔥", praise_line: "y'all look locked in and the lineup feels intentional in the best way" };
    return { killer_tag: "Full Pressure 👑", praise_line: "this lineup walked in like the room already belonged to all of you" };
  }

  if (unfiltered) {
    if (tier === "NEEDS WORK") return { killer_tag: "Still Cooking 😬", praise_line: "no cap, the confidence is trying to carry this but the fit still needs saving" };
    if (tier === "DECENT") return { killer_tag: "Lowkey Menace 😮‍💨", praise_line: "lowkey clean, lowkey trouble, you almost had to pay rent in this one" };
    if (tier === "FIRE") return { killer_tag: "Locked In 🔥", praise_line: "deadass this went crazy, you look like you stood on business before leaving the house" };
    return { killer_tag: "Different Breed 😈", praise_line: "no cap, this fit is actually a problem and everybody else just got cooked" };
  }

  if (tier === "NEEDS WORK") return { killer_tag: "Almost There 😅", praise_line: "the pose is helping, but the fit still needs one cleaner idea to lock in" };
  if (tier === "DECENT") return { killer_tag: "Lowkey Clean ✨", praise_line: "this is easy on the eyes and one sharper detail would make it hit harder" };
  if (tier === "FIRE") return { killer_tag: "Clean Pressure 🔥", praise_line: "you look locked in and the whole fit feels intentional in the best way" };
  return { killer_tag: "Main Event 👑", praise_line: "this look walked in like it already knew it was the moment" };
}

function needsCopyFallback(killerTag: string, praiseLine: string, dripScore: number, sceneType: string, unfiltered: boolean): boolean {
  const combined = `${killerTag} ${praiseLine}`;
  if (!killerTag || !praiseLine) return true;
  if (!hasSceneCue(combined, sceneType)) return true;
  if (unfiltered && !hasSavageCue(praiseLine)) return true;
  if (dripScore < 4 && hasLowScorePraise(combined)) return true;
  if (dripScore >= 8.5 && hasHighScoreDiss(combined)) return true;
  return false;
}

function getCall2System(dripScore: number, gender: string, faceHidden: boolean, sceneType: string, profileContext: string) {
  const tier = getScoreTier(dripScore);
  const sceneRule = getSceneRule(sceneType);
  return `You are DRIPD AI — a Gen-Z fashion intelligence engine. You create two outputs: a KILLER TAG and a PRAISE LINE.

CRITICAL TONE GATE (NON-NEGOTIABLE):
The drip_score is ${dripScore.toFixed(1)} which falls in the "${tier}" tier.
Your killer_tag and praise_line MUST match this tier's energy:
- NEEDS WORK (< 4): The outfit is NOT good. Be gently critical, self-aware, or lightly funny. NEVER praise or hype it.
- DECENT (4-6.9): Nice but not crazy. Keep it smooth, current, and lowkey.
- FIRE (7-8.4): Genuinely good. Use confident praise.
- ELITE (≥ 8.5): Exceptional. Go full hype.
DO NOT praise a low score. DO NOT underplay a high score.

${sceneRule}

INPUT DATA:
- drip_score: ${dripScore.toFixed(1)}
- gender: ${gender}
- face_hidden: ${faceHidden}
- scene_type: ${sceneType}${profileContext}

VOICE RULES:
- Sound current, witty, and Gen Z native — not corporate, not generic.
- Mild modern slang is welcome when it feels natural: lowkey, no cap, locked in, clean, different.
- WIT RULE: The line needs a twist, contrast, or clever observation. Plain compliments are not enough.
- No cuss words. No fake positivity.
- Avoid repetition across tag + praise line.
- Include exactly 1 relevant emoji at the END of the killer_tag.
- The tag and praise line must feel like they belong together.

KILLER TAG:
- Exactly 2–3 words.
- Feels like a screenshot-worthy vibe, not a sentence.
- Match the score tier exactly.
- If face is hidden, lean into mystery without ignoring the score tier.
- NEVER reuse examples verbatim.

PRAISE LINE:
- Exactly 1 sentence, no period at the end.
- Must feel written for THIS specific image.
- Must match the score tier exactly.
- For couples/groups: MUST explicitly sound plural, never singular.
- Must feel witty, not templated.

FINAL CHECK:
✅ Tone matches the number
✅ Couple/group shots sound plural
✅ Feels Gen Z, not brand-safe
✅ Has wit, not just praise
If any fail → rewrite.

Return EXACTLY this JSON:
{"killer_tag":"2-3 word tag + emoji","praise_line":"one sentence no period at end"}
CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`;
}

function getCall2SystemUnfiltered(dripScore: number, gender: string, faceHidden: boolean, sceneType: string) {
  const tier = getScoreTier(dripScore);
  const sceneRule = getSceneRule(sceneType);
  return `You are DRIPD AI — a RAW, UNFILTERED Gen-Z hype engine.
You do NOT sound safe. You do NOT sound corporate.
You sound like that one witty friend who sees the fit and immediately says something screenshot-worthy.

CRITICAL TONE GATE (NON-NEGOTIABLE):
The drip_score is ${dripScore.toFixed(1)} which falls in the "${tier}" tier.
Your killer_tag and praise_line MUST match this tier's energy:
- NEEDS WORK (< 4): The outfit is NOT good. Be honest, funny, slightly savage. NEVER praise it.
- DECENT (4-6.9): It's working enough. Be playful, sharp, and lowkey dangerous.
- FIRE (7-8.4): Genuinely hard. Hype it with edge.
- ELITE (≥ 8.5): Insane. Full chaos, full aura, full pressure.
DO NOT praise a low score. DO NOT soften a high score.

${sceneRule}

INPUT:
- drip_score: ${dripScore.toFixed(1)}
- user_gender: ${gender}
- face_hidden: ${faceHidden}
- scene_type: ${sceneType}

MANDATORY SAVAGE MODE RULES:
- The praise_line MUST contain at least one current Gen-Z/slang phrase that feels natural.
- Allowed examples: lowkey, no cap, deadass, went crazy, locked in, clean as hell, different, ate, stood on business, menace, cooked.
- The line MUST have wit. A plain compliment is an automatic fail.
- The line should sound like something a real person would post or send to the group chat.
- Include 1 emoji at the end of the killer_tag only.

VOICE RULES:
- Male = loud hype friend, chaotic respect.
- Female below 8 = hype bestie, warm chaos.
- Female 8+ = cold, smooth, flirty danger.
- Unknown = neutral but sharp.
- For couples/groups, ALWAYS sound plural.
- NEVER mix gender modes.
- Cuss words are allowed, but only to increase hype or comedy.

ORIGINALITY RULES:
- NEVER copy or reuse examples.
- Every output must feel fresh, modern, and unpredictable.
- If it sounds safe, bland, or templated, rewrite it.

FINAL CHECK:
✅ Has slang
✅ Has wit
✅ Matches score tier
✅ Couple/group shots sound plural
✅ Screenshot-worthy energy
If any fail → rewrite.

Return EXACTLY: {"killer_tag":"2-3 word tag + emoji","praise_line":"one raw sentence, no period at end"}
CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`;
}

function getUnfilteredRoastPrompt(roastCategory: string) {
  return `You are DRIPD AI — a SAVAGE, UNHINGED roast machine. You are the meanest, funniest friend in the group chat.

The user sent a NON-OUTFIT image to a fashion rating app. The dominant subject is: "${roastCategory}"

YOUR JOB: Absolutely DESTROY them for this. Think Comedy Central Roast meets group chat energy.

ROAST RULES:
- Focus ONLY on the dominant subject — the thing taking up the most space. Ignore small elements, icons, watermarks, or background details.
- Be genuinely SAVAGE. Not "oh that's cute" savage. Actually mean, actually funny.
- Cuss words are ENCOURAGED when they make the line funnier. Use them naturally like a real person would.
- The roast should make people either laugh until they cry OR get genuinely mad — both lead to sharing.
- Think: "I can't believe an AI just said that" energy.
- Reference WHAT they actually sent — don't be generic.
- One-liners that HIT. No filler words. Every word earns its place.

ENERGY EXAMPLES (DO NOT COPY — match this level of aggression):
- Screenshot: "bro really screenshotted someone else's convo and sent it to ME like I give a shit 💀"
- Food: "that plate looks like it gave up on life before you did"
- Pet: "even the dog is embarrassed you thought this was a fit check"
- Car: "nice car bro, too bad your outfit when you step out of it is gonna ruin everything"
- Random object: "you had one job. ONE. send a fit. and you sent me THIS."

Generate:
1. killer_tag: 2-3 words, genuinely funny, meme-worthy. 1 emoji at end. Should make someone go "LMAOOO"
2. praise_line: One BRUTAL sentence. No mercy. The kind of line that gets screenshotted and goes viral. No period at end.

DO NOT be safe. DO NOT be nice. DO NOT reuse examples.

Return EXACTLY: {"killer_tag":"2-3 words + emoji","praise_line":"one savage sentence no period"}
CRITICAL: Return ONLY valid JSON.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64: rawBase64, imageUrl, styleProfile, unfiltered } = await req.json();

    let imageBase64 = rawBase64;
    if (!imageBase64 && imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch image from URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      imageBase64 = btoa(binary);
    }
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    console.log("Call 1: Human detection + scoring...");
    const call1Result = await callGemini(apiKey, [
      { role: "system", content: CALL1_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Analyze this image. Is there a human wearing clothes? If yes, score the outfit. If no, roast it. User gender: ${gender}.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ], 0.3, 512);

    console.log("Call 1 result:", JSON.stringify(call1Result).substring(0, 200));

    const calculatedDrip = Math.round(
      ((call1Result.color_score || 0) * 0.3 +
        (call1Result.posture_score || 0) * 0.3 +
        (call1Result.layering_score || 0) * 0.25 +
        (call1Result.face_score || 0) * 0.15) * 10,
    ) / 10;
    console.log(`Server-side drip: ${calculatedDrip} (AI said: ${call1Result.drip_score})`);
    call1Result.drip_score = calculatedDrip;

    const subScoreTotal = (call1Result.color_score || 0) + (call1Result.posture_score || 0) + (call1Result.layering_score || 0) + (call1Result.face_score || 0);
    
    // Strengthen roast detection — also check text signals from Call 1
    const dripReason = (call1Result.drip_reason || "").toLowerCase();
    const adviceText = (call1Result.advice || "").toLowerCase();
    const hasNoHumanSignal = dripReason.includes("no human") || dripReason.includes("not a fashion") || adviceText.includes("upload a photo") || adviceText.includes("no human");
    
    const isRoast = call1Result.error === "roast"
      || (call1Result.drip_score === 0 && subScoreTotal === 0)
      || (call1Result.face_score === 0 && call1Result.posture_score === 0)
      || (call1Result.drip_score < 2 && subScoreTotal < 3)
      || hasNoHumanSignal;

    if (isRoast) {
      console.log("Roast mode — generating funny killer_tag + roast praise_line via Call 2");
      const roastCategory = call1Result.roast_line || call1Result.roast_category || "unknown object";

      const roastPrompt = unfiltered
        ? getUnfilteredRoastPrompt(roastCategory)
        : `You are DRIPD AI — a witty, sarcastic roast machine for a fashion rating app.

The user sent a NON-OUTFIT image. The dominant subject is: "${roastCategory}"

RULES:
- Focus ONLY on the dominant subject — the thing taking up the most space. Ignore small elements, icons, watermarks, or background details.
- Be genuinely funny and sarcastic. The kind of line people screenshot and send to friends.
- Has real bite — not corporate, not safe, not generic.
- Reference what they ACTUALLY sent, don't be vague.
- Clean language but sharp wit.

Generate:
1. killer_tag: 2-3 words, witty, meme-worthy. 1 emoji at end.
2. praise_line: One sarcastic sentence roast. Funny enough to share. No period at end.

DO NOT reuse examples. Be original.

Return EXACTLY: {"killer_tag":"2-3 words + emoji","praise_line":"one sentence roast no period"}
CRITICAL: Return ONLY valid JSON.`;

      const roastTemp = unfiltered ? 1.2 : 0.9;
      const roastTokens = unfiltered ? 512 : 256;
      const roastCall2 = await callGemini(apiKey, [
        { role: "system", content: roastPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Look at this image and generate a funny killer_tag and roast praise_line for it." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ], roastTemp, roastTokens);

      console.log("Roast Call 2 result:", JSON.stringify(roastCall2));

      const roastResult = {
        drip_score: 0,
        drip_reason: "No human detected",
        confidence_rating: 0,
        confidence_reason: "No human detected",
        killer_tag: roastCall2.killer_tag || "Not A Fit",
        color_score: 0,
        color_reason: "N/A",
        posture_score: 0,
        posture_reason: "N/A",
        layering_score: 0,
        layering_reason: "N/A",
        face_score: 0,
        face_reason: "N/A",
        advice: "Upload a photo with you wearing an outfit",
        praise_line: roastCall2.praise_line || roastCategory,
      };
      return new Response(JSON.stringify({ result: roastResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const faceHidden = call1Result.face_hidden ?? (call1Result.face_score < 2);
    const sceneType = call1Result.scene_type || "solo";
    console.log("Call 2: Generating killer tag + praise line...");

    const call2System = unfiltered
      ? getCall2SystemUnfiltered(call1Result.drip_score, gender, faceHidden, sceneType)
      : getCall2System(call1Result.drip_score, gender, faceHidden, sceneType, profileContext);

    const call2Temp = unfiltered ? 1.2 : 0.9;
    const call2Tokens = unfiltered ? 512 : 256;
    const call2Result = await callGemini(apiKey, [
      { role: "system", content: call2System },
      {
        role: "user",
        content: [
          { type: "text", text: "Look at this outfit and generate the killer_tag and praise_line based on the score and vibe rules provided." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ], call2Temp, call2Tokens);

    console.log("Call 2 result:", JSON.stringify(call2Result));

    const fallbackCopy = getFallbackCopy(call1Result.drip_score, sceneType, Boolean(unfiltered));
    const safeKillerTag = typeof call2Result.killer_tag === "string" ? call2Result.killer_tag.trim() : "";
    const safePraiseLine = typeof call2Result.praise_line === "string" ? call2Result.praise_line.trim() : "";
    const shouldFallback = needsCopyFallback(safeKillerTag, safePraiseLine, call1Result.drip_score, sceneType, Boolean(unfiltered));

    if (shouldFallback) {
      console.log("Using server fallback copy for score/scene consistency");
    }

    const finalResult = {
      drip_score: call1Result.drip_score,
      drip_reason: call1Result.drip_reason,
      confidence_rating: call1Result.confidence_rating,
      confidence_reason: call1Result.confidence_reason,
      killer_tag: shouldFallback ? fallbackCopy.killer_tag : (safeKillerTag || fallbackCopy.killer_tag),
      color_score: call1Result.color_score,
      color_reason: call1Result.color_reason,
      posture_score: call1Result.posture_score,
      posture_reason: call1Result.posture_reason,
      layering_score: call1Result.layering_score,
      layering_reason: call1Result.layering_reason,
      face_score: call1Result.face_score,
      face_reason: call1Result.face_reason,
      advice: call1Result.advice,
      praise_line: shouldFallback ? fallbackCopy.praise_line : (safePraiseLine || fallbackCopy.praise_line),
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