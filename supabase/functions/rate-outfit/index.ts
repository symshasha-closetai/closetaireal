import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callWithFallback(models: string[], apiKey: string, body: any): Promise<any> {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      console.warn(`Model ${model} returned ${response.status}, trying fallback...`);
      if (i === models.length - 1) {
        const errText = await response.text();
        throw new Error(`All models failed. Last: ${response.status} ${errText}`);
      }
      continue;
    }
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }
  throw new Error("No models available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, styleProfile } = await req.json();
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = ` Profile: ${parts.join(", ")}.`;
    }

    const systemPrompt = `Fashion stylist AI.${profileContext}

Return ONLY valid JSON:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string"}

Rules:
- All scores 0-10 decimals. drip_score = Color(25%)+Style(20%)+Fit(25%)+Occasion(20%)+Accessories(10%)
- killer_tag: 1-3 words + 1-2 emojis. MUST be SPECIFIC to the actual outfit style/vibe detected — reference the colors, patterns, era, subculture, or energy of THIS outfit. Never use generic tags like "Looking Good" or "Nice Outfit". Think TikTok caption energy. Examples by style: streetwear → "Hypebeast Protocol 🔥", formal/suit → "Board Meeting Baddie 💼✨", casual/cozy → "Soft Era Activated 🧸☁️", colorful → "Dopamine Dealer 🌈", all-black → "Shadow Royalty 🖤👑", vintage → "Thrift Lord Energy 🪩", sporty → "Gym to Slay Pipeline 💪🔥", minimalist → "Less is Luxe ✨", desi/ethnic → "Desi Drip Dynasty 👑", y2k → "2000s Called, Said Keep It 📱💅"
- praise_line: one stylish shareable sentence SPECIFIC to the outfit. Reference actual items/colors/style detected. Gen Z tone — witty, confident, emoji-sprinkled.
- STRICTLY NO profanity, cuss words, or vulgar language in any field. Keep it clean but fire 🔥
- reasons: 1-2 sentences each
- DO NOT include wardrobe_suggestions or shopping_suggestions`;

    const data = await callWithFallback(
      ["gemini-2.5-flash-lite", "gemma-3-4b-it", "gemini-2.5-flash"],
      apiKey,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt + "\n\nAnalyze this outfit. Return JSON only." },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            ],
          },
        ],
      }
    );

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let result = null;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
