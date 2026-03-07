import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, wardrobeItems } = await req.json();
    if (!imageBase64) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const wardrobeDesc = wardrobeItems?.length
      ? `User's wardrobe contains: ${wardrobeItems.map((i: any) => `${i.name || i.type} (id: ${i.id}, ${i.type}, ${i.color || "unknown"} color)`).join(", ")}`
      : "No wardrobe data available";

    const systemPrompt = `You are an expert fashion stylist and outfit rater who speaks Gen Z language fluently. Analyze the outfit in the photo and provide detailed scoring, improvement suggestions, and a fire Gen Z praising caption. Consider color harmony, style cohesion, fit, and occasion appropriateness. ${wardrobeDesc}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Rate this outfit and suggest improvements. If the user has wardrobe items, suggest swaps from their wardrobe too. Give a trending Gen Z praise caption and explain reasoning for each score." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "rate_outfit",
            description: "Return outfit rating with scores, reasons, advice, Gen Z praise, and improvement suggestions with image prompts",
            parameters: {
              type: "object",
              properties: {
                overall_score: { type: "number", description: "Overall outfit score 1-10" },
                overall_reason: { type: "string", description: "Why this overall score was given, 1-2 sentences" },
                color_score: { type: "number", description: "Color harmony score 1-10" },
                color_reason: { type: "string", description: "Why this color score was given, 1-2 sentences" },
                style_score: { type: "number", description: "Style cohesion score 1-10" },
                style_reason: { type: "string", description: "Why this style score was given, 1-2 sentences" },
                fit_score: { type: "number", description: "Fit score 1-10" },
                fit_reason: { type: "string", description: "Why this fit score was given, 1-2 sentences" },
                occasion: { type: "string", description: "Detected occasion (e.g. Casual, Formal, Date Night)" },
                advice: { type: "string", description: "Main styling advice in 1-2 sentences" },
                praise_line: { type: "string", description: "A trending Gen Z praising caption like 'main character energy fr fr 🔥' or 'this fit is giving everything it needs to give 💅' or 'slay certified no cap 👑'. Make it sound authentic, trendy, and hype." },
                wardrobe_suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item_name: { type: "string" },
                      category: { type: "string" },
                      reason: { type: "string" },
                      wardrobe_item_id: { type: "string", description: "The id of the matching wardrobe item if available" },
                    },
                    required: ["item_name", "category", "reason"],
                    additionalProperties: false,
                  },
                  description: "Suggestions to swap from user's existing wardrobe. Include wardrobe_item_id when referencing a specific item.",
                },
                shopping_suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item_name: { type: "string" },
                      category: { type: "string" },
                      reason: { type: "string" },
                      image_prompt: { type: "string", description: "A short description for generating a product image of this item, e.g. 'white leather sneakers with minimal design' or 'gold chain necklace with small pendant'" },
                    },
                    required: ["item_name", "category", "reason", "image_prompt"],
                    additionalProperties: false,
                  },
                  description: "New items to buy that would improve the look",
                },
              },
              required: ["overall_score", "overall_reason", "color_score", "color_reason", "style_score", "style_reason", "fit_score", "fit_reason", "occasion", "advice", "praise_line", "wardrobe_suggestions", "shopping_suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rate_outfit" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = null;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
