import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wardrobeItems, occasion, timeOfDay, weather, styleProfile } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const wardrobeDesc = wardrobeItems.map((i: any) =>
      `ID:${i.id} - ${i.name || i.type} (${i.type}, color: ${i.color || "unknown"}, material: ${i.material || "unknown"})`
    ).join("\n");

    const profileDesc = styleProfile
      ? `Body type: ${styleProfile.body_type || "unknown"}, Skin tone: ${styleProfile.skin_tone || "unknown"}, Style preference: ${styleProfile.style_type || "any"}, Face shape: ${styleProfile.face_shape || "unknown"}`
      : "No style profile available";

    const bodyAnalysis = styleProfile?.ai_body_analysis
      ? `\nAI Body Analysis: ${JSON.stringify(styleProfile.ai_body_analysis)}`
      : "";

    const faceAnalysis = styleProfile?.ai_face_analysis
      ? `\nAI Face Analysis: ${JSON.stringify(styleProfile.ai_face_analysis)}`
      : "";

    const weatherInfo = weather ? `\nWeather conditions: ${weather}` : "";

    const systemPrompt = `You are an expert fashion stylist AI. Given the user's wardrobe items, occasion, time of day, weather, body profile, and face analysis, suggest 2-3 complete outfit combinations using ONLY items from their wardrobe.

Consider these factors when making suggestions:
1. Color combination and harmony - ensure colors complement each other and the user's skin tone
2. Body type flattery - choose pieces that flatter the user's body type
3. Occasion appropriateness - match the formality and vibe of the occasion
4. Season and time of day - appropriate for the selected time
5. Material compatibility - fabrics that work well together. Consider weather conditions, material breathability and comfort, and how fabrics interact with temperature and humidity.
6. Style coherence - a unified look that tells a story
7. Weather awareness - ensure the outfit is comfortable and practical for the current weather conditions

Each outfit must use real item IDs from the provided wardrobe.

You must respond by using the suggest_outfits tool.`;

    const userPrompt = `Wardrobe items:\n${wardrobeDesc}\n\nOccasion: ${occasion}\nTime of day: ${timeOfDay}${weatherInfo}\nProfile: ${profileDesc}${bodyAnalysis}${faceAnalysis}\n\nSuggest 2-3 outfits that best complement this person's features and are appropriate for the weather.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "suggest_outfits",
          description: "Return outfit suggestions from the wardrobe",
          input_schema: {
            type: "object",
            properties: {
              outfits: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Creative outfit name" },
                    top_id: { type: "string", description: "Wardrobe item ID for top, or null" },
                    bottom_id: { type: "string", description: "Wardrobe item ID for bottom, or null" },
                    shoes_id: { type: "string", description: "Wardrobe item ID for shoes, or null" },
                    accessories: { type: "array", items: { type: "string" }, description: "Wardrobe item IDs for accessories" },
                    score: { type: "number", description: "Outfit score 1-10" },
                    explanation: { type: "string", description: "Why this outfit works" },
                  },
                  required: ["name", "score", "explanation"],
                },
              },
            },
            required: ["outfits"],
          },
        }],
        tool_choice: { type: "tool", name: "suggest_outfits" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("Anthropic error:", errText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    let outfits = [];

    // Anthropic returns tool use in content blocks
    const toolUseBlock = data.content?.find((b: any) => b.type === "tool_use");
    if (toolUseBlock?.input?.outfits) {
      outfits = toolUseBlock.input.outfits;
    }

    return new Response(JSON.stringify({ outfits }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("style-me error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
