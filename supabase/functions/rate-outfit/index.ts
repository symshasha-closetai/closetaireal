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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const wardrobeDesc = wardrobeItems?.length
      ? `User's wardrobe contains: ${wardrobeItems.map((i: any) => `${i.name || i.type} (id: ${i.id}, ${i.type}, ${i.color || "unknown"} color)`).join(", ")}`
      : "No wardrobe data available";

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body type: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin tone: ${styleProfile.skin_tone}`);
      if (styleProfile.face_shape) parts.push(`Face shape: ${styleProfile.face_shape}`);
      if (styleProfile.style_type) parts.push(`Preferred styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = `\n\nUser's profile: ${parts.join(", ")}`;
      if (styleProfile.ai_body_analysis) profileContext += `\nDetailed body analysis: ${JSON.stringify(styleProfile.ai_body_analysis)}`;
      if (styleProfile.ai_face_analysis) profileContext += `\nDetailed face analysis: ${JSON.stringify(styleProfile.ai_face_analysis)}`;
    }

    const systemPrompt = `You are a world-class fashion stylist and AI outfit analyst. You combine expert fashion knowledge with Gen Z cultural awareness to deliver sharp, credible, and shareable outfit analysis. ${wardrobeDesc}${profileContext}

Return ONLY valid JSON (no markdown) with this exact structure:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string","wardrobe_suggestions":[{"item_name":"string","category":"string","reason":"string","wardrobe_item_id":"string or null"}],"shopping_suggestions":[{"item_name":"string","category":"string","reason":"string","image_prompt":"string"}]}

SCORING METHODOLOGY:
- drip_score: Weighted composite as a decimal (e.g. 8.5, 7.6). Range 0-10. Calculated from:
  • Color Harmony (25%): How well colors complement each other and the wearer
  • Style Impact (20%): Visual coherence, trend awareness, and personal expression
  • Fit & Silhouette (25%): How garments drape, proportion balance, tailoring quality
  • Occasion Match (20%): Appropriateness and intentionality for the setting
  • Accessories Balance (10%): Complementary accessories, jewelry, bags, shoes coordination
- drip_reason: 2-3 sentences explaining the score. Reference specific elements — color combinations, silhouette choices, styling details. Be analytical and credible.

- confidence_rating: How confident and powerful the person appears in this outfit, as a decimal. Range 0-10. Based on: outfit boldness, how well it suits them, posture cues, overall energy projected.
- confidence_reason: 2-3 sentences explaining the confidence rating. Be specific about what projects confidence or could improve it.

- killer_tag: A 1-3 word creative, catchy tag that captures the outfit's vibe. Think editorial fashion meets Gen Z shareability. Examples: "Effortless Chic", "Main Character", "Vibe Curator", "Golden Hour", "Certified Stunner", "Icon Mode", "Plot Twist", "Walk of Fame", "Mic Drop Moment", "Slay Architect". With appropriate emojis. Must be universally understood — no regional slang.

- praise_line: A one-liner that's stylish, shareable, and screenshot-worthy. Use proper grammar and capitalization. Allow tasteful emojis (1-2 max). Examples: "Serving festive elegance ✨", "Main character energy, no auditions needed.", "Fit check: passed with distinction.", "The outfit said everything without saying a word." Keep it refined but relatable.

- color_score, style_score, fit_score: integers 1-10 with clear reasoning.
- color_reason, style_reason, fit_reason: 1-2 sentences each explaining the sub-score.
- occasion: Brief occasion descriptor (e.g. "Casual Brunch", "Evening Out", "Street Style").
- advice: Professional stylist-grade advice. 2-3 sentences with specific, actionable suggestions. Reference current 2025-2026 trends when relevant.

- PERSONALIZED SUGGESTIONS: If user profile data is available, ALL suggestions MUST reference the user's specific body type, skin tone, face shape, gender, and preferred styles. Be hyper-specific with brand-style descriptions. Reference current 2025-2026 fashion trends.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this outfit. Provide a comprehensive style score with weighted breakdown, confidence rating, a creative killer tag, and actionable improvement suggestions. If the user has wardrobe items, suggest swaps from their wardrobe too. Make all suggestions personalized to their body/style profile. Return JSON only." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted, please try later" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

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
