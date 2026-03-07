import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wardrobeItems, occasion, timeOfDay, styleProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const systemPrompt = `You are an expert fashion stylist AI. Given the user's wardrobe items, occasion, time of day, body profile, and face analysis, suggest 2-3 complete outfit combinations using ONLY items from their wardrobe.

Consider these factors when making suggestions:
1. Color combination and harmony - ensure colors complement each other and the user's skin tone
2. Body type flattery - choose pieces that flatter the user's body type
3. Occasion appropriateness - match the formality and vibe of the occasion
4. Season and time of day - appropriate for the selected time
5. Material compatibility - fabrics that work well together
6. Style coherence - a unified look that tells a story

Each outfit must use real item IDs from the provided wardrobe.`;

    const userPrompt = `Wardrobe items:\n${wardrobeDesc}\n\nOccasion: ${occasion}\nTime of day: ${timeOfDay}\nProfile: ${profileDesc}${bodyAnalysis}${faceAnalysis}\n\nSuggest 2-3 outfits that best complement this person's features.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_outfits",
            description: "Return outfit suggestions from the wardrobe",
            parameters: {
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
                      explanation: { type: "string", description: "Why this outfit works for this person's body type, skin tone, and the occasion" },
                    },
                    required: ["name", "score", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["outfits"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_outfits" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let outfits = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      outfits = parsed.outfits || [];
    }

    return new Response(JSON.stringify({ outfits }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("style-me error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
