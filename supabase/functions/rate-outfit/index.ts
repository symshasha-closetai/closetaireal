import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, wardrobeItems, styleProfile } = await req.json();
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const wardrobeDesc = wardrobeItems?.length
      ? `User's wardrobe: ${wardrobeItems.slice(0, 15).map((i: any) => `${i.name || i.type} (${i.type}, ${i.color || "?"})`).join(", ")}`
      : "";

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = ` Profile: ${parts.join(", ")}.`;
    }

    const systemPrompt = `Fashion stylist AI. ${wardrobeDesc}${profileContext}

Return ONLY valid JSON:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string","wardrobe_suggestions":[{"item_name":"string","category":"string","reason":"string","wardrobe_item_id":"string or null"}],"shopping_suggestions":[{"item_name":"string","category":"string","reason":"string","image_prompt":"string"}]}

Rules:
- All scores 0-10 decimals. drip_score = Color(25%)+Style(20%)+Fit(25%)+Occasion(20%)+Accessories(10%)
- killer_tag: 1-3 word catchy tag. MUST be playful, quirky, Gen Z energy. Include 1-2 relevant emojis. Examples: "Main Character 🔥", "Slay Protocol 💅", "CEO of Drip 👑", "Vibes on Lock 🧊", "Ate & Left No Crumbs ✨"
- praise_line: one stylish, shareable, hype-worthy sentence. Gen Z tone — witty, confident, emoji-sprinkled. Examples: "you walked in and the room said yes 🫡✨", "this fit goes harder than a monday alarm 🔥", "bestie you understood the assignment 💯"
- STRICTLY NO profanity, cuss words, or vulgar language in any field. Keep it clean but fire 🔥
- reasons: 1-2 sentences each
- Up to 3 wardrobe_suggestions, up to 5 shopping_suggestions
- Each shopping suggestion needs image_prompt for product photo`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt + "\n\nAnalyze this outfit. Return JSON only." },
                { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
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
