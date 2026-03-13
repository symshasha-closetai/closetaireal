import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const systemPrompt = `You are a fashion AI that analyzes clothing images. Given an image of a person wearing clothes or a group of clothing items, identify and categorize each visible clothing item or accessory.

For each item found, return a JSON array of objects with these fields:
- "name": descriptive name of the item (e.g., "Blue Denim Jacket", "Gold Watch")
- "type": one of "Tops", "Bottoms", "Shoes", "Dresses", "Accessories"
- "color": primary color
- "material": material if identifiable (e.g., "Denim", "Leather", "Cotton", "Linen", "Polyester", "Silk", "Wool", "Nylon", "Chiffon", "Velvet", "Satin"), or null
- "quality": estimated quality based on visible fabric texture, stitching, brand indicators, and overall construction. One of "Premium", "Mid-range", "Budget", or "Unknown"
- "brand": brand name if visible or identifiable from logos, tags, or distinctive design patterns (e.g., "Nike", "Zara", "Gucci"), or null if not identifiable

Return ONLY valid JSON array, no markdown, no explanation. Example:
[{"name":"White Cotton T-Shirt","type":"Tops","color":"White","material":"Cotton","quality":"Mid-range","brand":null},{"name":"Blue Slim Jeans","type":"Bottoms","color":"Blue","material":"Denim","quality":"Premium","brand":"Levi's"}]`;

    const resolvedMime = mimeType || "image/jpeg";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt + "\n\nAnalyze this image and identify all clothing items and accessories. Return JSON array only." },
                { inlineData: { mimeType: resolvedMime, data: imageBase64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly", retryable: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 400) {
        return new Response(JSON.stringify({ error: "Could not process this image. Try a different photo.", retryable: false }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Temporary issue — please try again.", retryable: true }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    let items;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) items = [];
    } catch {
      console.error("Failed to parse AI response:", content);
      items = [];
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-clothing:", error);
    return new Response(JSON.stringify({ error: error.message, retryable: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
