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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const wardrobeDesc = wardrobeItems?.length
      ? `User's wardrobe contains: ${wardrobeItems.map((i: any) => `${i.name || i.type} (id: ${i.id}, ${i.type}, ${i.color || "unknown"} color)`).join(", ")}`
      : "No wardrobe data available";

    const systemPrompt = `You are an expert fashion stylist and outfit rater who speaks Gen Z language fluently. Analyze the outfit in the photo and provide detailed scoring, improvement suggestions, and a killer Gen Z vibe tag. Consider color harmony, style cohesion, fit, and occasion appropriateness. ${wardrobeDesc}

Return ONLY valid JSON (no markdown) with this exact structure:
{"drip_score":number,"confidence_rating":number,"killer_tag":"string","color_score":number,"color_reason":"string","style_score":number,"style_reason":"string","fit_score":number,"fit_reason":"string","occasion":"string","advice":"string","praise_line":"string","wardrobe_suggestions":[{"item_name":"string","category":"string","reason":"string","wardrobe_item_id":"string or null"}],"shopping_suggestions":[{"item_name":"string","category":"string","reason":"string","image_prompt":"string"}]}

IMPORTANT RULES:
- drip_score: Overall drip/outfit score as a decimal (e.g. 8.5, 7.6, 9.2). Range 0-10.
- confidence_rating: How confident/powerful the person looks in this outfit, as a decimal (e.g. 8.5, 9.0). Range 0-10.
- killer_tag: A 1-2 word Gen Z attention-grabbing tag like "Bombshell", "Patakha Kudi", "Aesthetic Queen", "Main Character", "It Girl", "Slay Machine", "Vibe Check", "Street King", "Drip Lord". Pick something that fits the outfit vibe. Make it bold and catchy.
- praise_line: A one-liner compliment with PROPER grammar and capitalization. Start with a capital letter. Make it punchy and Gen Z.
- All score reasons should use proper grammar and capitalization.
- color_score, style_score, fit_score: integers 1-10.`;

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
              { type: "text", text: "Rate this outfit — give a drip score, confidence rating, killer tag, and suggest improvements. If the user has wardrobe items, suggest swaps from their wardrobe too. Return JSON only." },
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
