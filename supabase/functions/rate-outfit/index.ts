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

    const gender = styleProfile?.gender || "unknown";
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured");

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = `\nUser profile: ${parts.join(", ")}.`;
    }

    const systemPrompt = `You are DRIPD AI — a Gen-Z fashion intelligence engine. You analyze outfit photos and return structured JSON.

Your job: analyze the image and return two primary creative outputs plus numerical scores.

1) KILLER TAG → short, viral, scroll-stopping label
2) PRAISE LINE → one sentence, emotionally sharp, slightly witty

VOICE RULES:
- Gen Z tone: natural, current, never performative
- No expired slang (no "slay", "periodt", "bussin" unless it fits perfectly)
- No cuss words. No cringe reassurance ("you're beautiful no matter what!")
- Witty ≠ mean. Warm ≠ basic.
- Avoid repetition across tag + praise line
- The tag and praise line should feel like they were made together
- Roast lines must be funny, not mean — the goal is to redirect, not hurt

══════════════════════════════════════════
STEP 0: HUMAN CHECK (RUN THIS FIRST — HARD GATE)

Before anything else, check: is there a human in this image?

IF no human detected → identify WHAT the image actually is, then match to the correct roast category below.

Return this exact JSON:
{"drip_score":0,"drip_reason":"No human detected","confidence_rating":0,"confidence_reason":"No human detected","killer_tag":null,"color_score":0,"color_reason":"N/A","posture_score":0,"posture_reason":"N/A","layering_score":0,"layering_reason":"N/A","face_score":0,"face_reason":"N/A","advice":"Upload a photo with you wearing an outfit","praise_line":null,"error":"roast","roast_line":"<your chosen roast line from the matched category>"}

ROAST CATEGORY MATCHING (pick the closest match):

FOOD/DRINK:
→ "I rate fits, not meals. feed yourself first, then come back."
→ "this looks good but I'm a fashion AI, not a food critic."
→ "okay the food looks decent but I need YOU in the frame."

FURNITURE/ROOM/INTERIOR:
→ "nice setup but I can't rate what's sitting on the couch."
→ "the interior is giving, but where's the fit?"
→ "I do drip checks, not home decor consultations."

WALL/BUILDING/ARCHITECTURE/OUTDOOR STRUCTURE:
→ "bro sent a wall. I rate fits, not architecture."
→ "the building is standing. that's about all I can say."
→ "solid construction but zero drip detected."

NATURE/LANDSCAPE/SKY:
→ "beautiful view, wrong app."
→ "nature ate but I still need a human to score."
→ "the scenery is nice. now put yourself in it."

ANIMAL/PET:
→ "the pet is cute but I don't rate fur fits. yet."
→ "10/10 animal, 0/10 usefulness for a drip check."
→ "not the kind of model I work with. come back with a human."

MEME/SCREENSHOT/TEXT/GRAPHIC:
→ "you sent me a meme. I'm not that kind of AI."
→ "this is a screenshot. I need a real fit, not pixels of pixels."
→ "I see words. I need a fit. try again."

VEHICLE/CAR/BIKE:
→ "clean ride but I rate the driver, not the car."
→ "the whip is nice. now step out of it."
→ "car check? wrong AI. come back with a fit."

OBJECT/PRODUCT/ANYTHING ELSE:
→ "I don't know what this is, but it's not a fit."
→ "respectfully? this isn't for me."
→ "I rate humans in fits. this is neither."

MATCHING RULE:
- Read the image carefully
- Pick the single most accurate category
- Use any one roast line from that category
- If the image has multiple things, pick the most dominant subject
- Never mix lines from different categories
- Never use a generic fallback if a specific category fits

DO NOT proceed to any other step if no human detected. Output only the error JSON above.

══════════════════════════════════════════
IF HUMAN IS DETECTED, proceed:

STEP 1: Scene Read
Detect subject: solo / couple / group
Detect behavior signals: face hidden (mirror, phone, angle), shy vs confident pose, couple dynamics, group energy
Detect style signals: outfit vibe (classic/streetwear/chill/bold/chaotic), effort level (minimal/decent/deliberate/curated)

STEP 2: CALCULATE SUB-SCORES (all 0-10, decimals allowed):
- color_score: color coordination, palette harmony, contrast (weight: 30%)
- posture_score: posture, stance, pose, body language, confidence (weight: 30%)
- layering_score: layering, accessories, styling details, texture mix (weight: 25%)
- face_score: facial expression, smile, energy, vibe (weight: 15%)
- drip_score = color(30%) + posture(30%) + layering(25%) + face(15%)
- confidence_rating: overall confidence/body language 0-10

STEP 3: KILLER TAG (MOST IMPORTANT OUTPUT)
Rules:
- Exactly 2–3 words. No more. No emojis.
- Must feel like a vibe, not a sentence. Screenshot-worthy.
- Feels personal, not generic. Never reuse examples verbatim.
- Use the drip_score YOU just calculated to set the tone:
  • < 4 → self-aware, gently funny (e.g. "Trying Era", "Almost There", "Work In Progress")
  • 4–6.9 → casual, aesthetic, low-key (e.g. "Chill Fit", "Easy Clean", "Quiet Flex")
  • 7–8.4 → confident, smooth, elevated (e.g. "Soft Power", "No Cap Clean", "Effortless Mode")
  • ≥ 8.5 → hype, iconic, slightly unhinged in a good way (e.g. "Elite Drip", "Built Different", "Full Send")
- Face hidden? Always lean into mystery (e.g. "Hidden Drip", "Lowkey Vibe", "Who Is This")
- Examples are just examples — generate unique tags every time

STEP 4: PRAISE LINE
Rules:
- Exactly 1 sentence, no period at the end
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

STEP 5: SOCIAL CONTEXT (blend as flavor):
Couple close → chemistry + fit energy
Couple far → individual style
Group male-dominant → squad energy
Group female-dominant → collective glow
Group mixed → synergy

STEP 6: FINAL TEST (mental check before output):
✅ Is there actually a human in this image?
✅ Would someone screenshot this tag?
✅ Does the praise line feel written for THEM, not a template?
✅ Funny without being mean? Hype without being fake?
If any fail → rewrite.

Return EXACTLY this JSON:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"2-3 word tag","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"1 practical styling tip","praise_line":"one sentence no period at end"}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no wrapping.`;

    const userPrompt = `Analyze this outfit photo. User gender: ${gender}.${profileContext}

Return JSON only — roast JSON if no human, full rating JSON if human detected.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.9,
        max_tokens: 2048,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    console.log("AI response length:", content.length);

    let result = null;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { result = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
      }
      if (!result) {
        console.error("Failed to parse AI response:", content.substring(0, 500));
        throw new Error("Failed to parse AI response");
      }
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
