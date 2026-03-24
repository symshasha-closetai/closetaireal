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
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured");

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
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","posture_score":number,"posture_reason":"string","layering_score":number,"layering_reason":"string","face_score":number,"face_reason":"string","advice":"string","praise_line":"string"}

Rules:
- All scores 0-10 decimals. drip_score = Color Combination(30%) + Posture & Pose(30%) + Layering & Accessories(25%) + Face & Smile(15%)
- color_score: Rate color coordination, palette harmony, contrast.
- posture_score: Rate posture, stance, pose, body language, confidence conveyed.
- layering_score: Rate layering, accessory use, styling details, texture mix.
- face_score: Rate facial expression, smile, energy, vibe conveyed.
- confidence_rating: Overall confidence/body language 0-10 (separate display metric).
- killer_tag: 1-3 words + 1-2 emojis. ${genderInstruction}
- praise_line: witty shareable sentence, Gen Z tone, emojis.
- reasons: 1 sentence each. NO profanity.

Analyze this outfit. Return JSON only.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.7,
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
      // Fallback: try to extract JSON object from content
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
