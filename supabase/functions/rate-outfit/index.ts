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

    // Build personalized profile context
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

    const systemPrompt = `You are an expert fashion stylist and outfit rater who speaks Gen Z language fluently. Analyze the outfit in the photo and provide detailed scoring, improvement suggestions, and a killer Gen Z vibe tag. Consider color harmony, style cohesion, fit, and occasion appropriateness. ${wardrobeDesc}${profileContext}

Return ONLY valid JSON (no markdown) with this exact structure:
{"drip_score":number,"drip_reason":"string","confidence_rating":number,"confidence_reason":"string","killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string","wardrobe_suggestions":[{"item_name":"string","category":"string","reason":"string","wardrobe_item_id":"string or null"}],"shopping_suggestions":[{"item_name":"string","category":"string","reason":"string","image_prompt":"string"}]}

IMPORTANT RULES:
- drip_score: Overall drip/outfit score as a decimal (e.g. 8.5, 7.6, 9.2). Range 0-10.
- drip_reason: A 2-3 sentence explanation of WHY this drip score was given. Reference specific elements like color combinations, style coherence, accessories, and how the outfit works as a whole. Be specific, not generic.
- confidence_rating: How confident/powerful the person looks in this outfit, as a decimal (e.g. 8.5, 9.0). Range 0-10.
- confidence_reason: A 2-3 sentence explanation of WHY this confidence rating was given. Reference posture, outfit boldness, how well the outfit suits them, and the overall energy/vibe projected. Be specific.
- killer_tag: A 1-3 word creative, universally understood English Gen Z tag. Examples: "Miss Marvelous", "Aura Farming", "Slay Architect", "Drip Deity", "Vibe Curator", "Main Character", "It Girl Energy", "Walk of Fame", "Certified Stunner", "Icon Mode", "Golden Hour Glow", "Mic Drop Moment", "Plot Twist Queen". Pick something creative that fits the outfit vibe. Make it bold, catchy, and universally understood. Do NOT use regional/non-English slang (no Hindi, Spanish, etc.). Every tag must make sense to someone in London, NYC, Lagos, or Tokyo.
- praise_line: A one-liner Gen Z hype compliment with PROPER grammar, capitalization, and emojis. Use trendy Gen Z expressions like "ate and left no crumbs", "you're literally giving main character", "serving looks on a silver platter", "the vibes are immaculate", "understood the assignment fr fr", "no cap this is elite". Start with a capital letter. Make it punchy, universally hype, and guaranteed to make anyone smile. Include 1-2 relevant emojis.
- All score reasons should use proper grammar and capitalization.
- color_score, style_score, fit_score: integers 1-10.
- PERSONALIZED SUGGESTIONS: If user profile data is available, ALL suggestions (wardrobe and shopping) MUST reference the user's specific body type, skin tone, face shape, gender, and preferred styles. For example: "A V-neck olive cotton top to complement your warm skin tone and pear body type" instead of generic "A nice top". Reference current 2025-2026 fashion trends. Shopping suggestions should be hyper-specific with brand-style descriptions.`;

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
              { type: "text", text: "Rate this outfit — give a drip score with reasoning, confidence rating with reasoning, killer tag, and suggest improvements. If the user has wardrobe items, suggest swaps from their wardrobe too. Make all suggestions personalized to their body/style profile. Return JSON only." },
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
