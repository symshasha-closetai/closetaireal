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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const wardrobeDesc = wardrobeItems?.length
      ? `User's wardrobe contains: ${wardrobeItems.map((i: any) => `${i.name || i.type} (id: ${i.id}, ${i.type}, ${i.color || "unknown"} color)`).join(", ")}`
      : "No wardrobe data available";

    const systemPrompt = `You are an expert fashion stylist and outfit rater who speaks Gen Z language fluently. Analyze the outfit in the photo and provide detailed scoring, improvement suggestions, and a fire Gen Z praising caption. Consider color harmony, style cohesion, fit, and occasion appropriateness. ${wardrobeDesc}

You must respond by using the rate_outfit tool.`;

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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "Rate this outfit and suggest improvements. If the user has wardrobe items, suggest swaps from their wardrobe too. Give a trending Gen Z praise caption and explain reasoning for each score.",
              },
            ],
          },
        ],
        tools: [{
          name: "rate_outfit",
          description: "Return outfit rating with scores, reasons, advice, Gen Z praise, and improvement suggestions",
          input_schema: {
            type: "object",
            properties: {
              overall_score: { type: "number", description: "Overall outfit score 1-10" },
              overall_reason: { type: "string" },
              color_score: { type: "number" },
              color_reason: { type: "string" },
              style_score: { type: "number" },
              style_reason: { type: "string" },
              fit_score: { type: "number" },
              fit_reason: { type: "string" },
              occasion: { type: "string" },
              advice: { type: "string" },
              praise_line: { type: "string", description: "A trending Gen Z praising caption" },
              wardrobe_suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item_name: { type: "string" },
                    category: { type: "string" },
                    reason: { type: "string" },
                    wardrobe_item_id: { type: "string" },
                  },
                  required: ["item_name", "category", "reason"],
                },
              },
              shopping_suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item_name: { type: "string" },
                    category: { type: "string" },
                    reason: { type: "string" },
                    image_prompt: { type: "string" },
                  },
                  required: ["item_name", "category", "reason", "image_prompt"],
                },
              },
            },
            required: ["overall_score", "overall_reason", "color_score", "color_reason", "style_score", "style_reason", "fit_score", "fit_reason", "occasion", "advice", "praise_line", "wardrobe_suggestions", "shopping_suggestions"],
          },
        }],
        tool_choice: { type: "tool", name: "rate_outfit" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("Anthropic error:", errText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    let result = null;

    const toolUseBlock = data.content?.find((b: any) => b.type === "tool_use");
    if (toolUseBlock?.input) {
      result = toolUseBlock.input;
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rate-outfit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
