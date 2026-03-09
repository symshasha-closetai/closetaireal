import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wardrobeItems, occasion, timeOfDay, weather, styleProfile } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const wardrobeDesc = wardrobeItems.map((i: any) =>
      `ID:${i.id} - ${i.name || i.type} (${i.type}, color: ${i.color || "unknown"}, material: ${i.material || "unknown"})`
    ).join("\n");

    const profileDesc = styleProfile
      ? `Body type: ${styleProfile.body_type || "unknown"}, Skin tone: ${styleProfile.skin_tone || "unknown"}, Style preference: ${styleProfile.style_type || "any"}, Face shape: ${styleProfile.face_shape || "unknown"}`
      : "No style profile available";

    const bodyAnalysis = styleProfile?.ai_body_analysis ? `\nAI Body Analysis: ${JSON.stringify(styleProfile.ai_body_analysis)}` : "";
    const faceAnalysis = styleProfile?.ai_face_analysis ? `\nAI Face Analysis: ${JSON.stringify(styleProfile.ai_face_analysis)}` : "";
    const weatherInfo = weather ? `\nWeather conditions: ${weather}` : "";

    const systemPrompt = `You are an expert fashion stylist AI. Given the user's wardrobe items, occasion, time of day, weather, body profile, and face analysis, suggest 2-3 complete outfit combinations using ONLY items from their wardrobe.

Consider these factors:
1. Color combination and harmony
2. Body type flattery
3. Occasion appropriateness
4. Season and time of day
5. Material compatibility and weather
6. Style coherence
7. Weather awareness

Each outfit must use real item IDs from the provided wardrobe.

Return ONLY valid JSON (no markdown) with this structure:
{"outfits":[{"name":"string","top_id":"string or null","bottom_id":"string or null","shoes_id":"string or null","accessories":["string"],"score":number,"explanation":"string"}]}`;

    const userPrompt = `Wardrobe items:\n${wardrobeDesc}\n\nOccasion: ${occasion}\nTime of day: ${timeOfDay}${weatherInfo}\nProfile: ${profileDesc}${bodyAnalysis}${faceAnalysis}\n\nSuggest 2-3 outfits. Return JSON only.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let outfits = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      outfits = parsed.outfits || [];
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    return new Response(JSON.stringify({ outfits }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("style-me error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
