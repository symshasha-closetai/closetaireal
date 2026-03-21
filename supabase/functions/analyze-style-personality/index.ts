import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wardrobeSummary, dripHistory } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured");

    const personalities = [
      "Dark Academia", "Cottagecore", "Y2K Nostalgia", "Techwear", "Preppy",
      "Grunge", "Quiet Luxury", "Streetcore", "Classic Sophisticate",
      "Elegant Minimalist", "Boho Spirit", "Athleisure Icon", "Vintage Rebel",
      "Smart Casual", "Eclectic Mix"
    ];

    const prompt = `You are a fashion style analyst. Analyze the user's style personality based on their data.

WARDROBE (20% weight): ${wardrobeSummary || "No wardrobe data"}

DRIP CHECK PHOTOS ANALYSIS (80% weight - these are the outfits they actually wear): ${dripHistory || "No drip history"}

Choose EXACTLY ONE style personality from: ${personalities.join(", ")}

Return ONLY valid JSON:
{"personality":"string","reason":"string"}

Rules:
- personality: one from the list above
- reason: 1-2 sentences explaining why, referencing specific patterns you noticed. Friendly Gen Z tone with 1-2 emojis.
- Weight drip check photos 80% and wardrobe composition 20% in your decision.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 256,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else throw new Error("Failed to parse response");
    }

    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-style-personality error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
