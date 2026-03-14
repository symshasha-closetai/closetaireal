import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callWithFallback(models: string[], apiKey: string, body: any): Promise<any> {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      console.warn(`Model ${model} returned ${response.status}, trying fallback...`);
      if (i === models.length - 1) {
        const errText = await response.text();
        throw new Error(`All models failed. Last: ${response.status} ${errText}`);
      }
      continue;
    }
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }
  throw new Error("No models available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, wardrobeItems, styleProfile, type } = await req.json();
    if (!imageBase64 || !type) {
      return new Response(JSON.stringify({ error: "Missing imageBase64 or type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    let profileContext = "";
    if (styleProfile) {
      const parts = [];
      if (styleProfile.gender) parts.push(`Gender: ${styleProfile.gender}`);
      if (styleProfile.body_type) parts.push(`Body: ${styleProfile.body_type}`);
      if (styleProfile.skin_tone) parts.push(`Skin: ${styleProfile.skin_tone}`);
      if (styleProfile.style_type) parts.push(`Styles: ${styleProfile.style_type}`);
      if (parts.length > 0) profileContext = ` Profile: ${parts.join(", ")}.`;
    }

    let prompt: string;

    if (type === "wardrobe") {
      const wardrobeDesc = wardrobeItems?.length
        ? wardrobeItems.slice(0, 15).map((i: any) => `${i.name || i.type} (id:${i.id}, ${i.type}, ${i.color || "?"})`).join(", ")
        : "";

      prompt = `Fashion stylist AI.${profileContext} User's wardrobe: ${wardrobeDesc}

Look at this outfit photo. Suggest up to 3 items FROM THE USER'S WARDROBE that would complement or improve this outfit.

Return ONLY valid JSON:
{"suggestions":[{"item_name":"string","category":"string","reason":"string","wardrobe_item_id":"string"}]}

Rules:
- wardrobe_item_id MUST be an actual id from the wardrobe list above
- reason: 1 sentence explaining why this item works with the outfit
- STRICTLY NO profanity`;
    } else {
      prompt = `Fashion stylist AI.${profileContext}

Look at this outfit photo. Suggest up to 5 items the user could BUY to complement or upgrade this outfit.

Return ONLY valid JSON:
{"suggestions":[{"item_name":"string","category":"string","reason":"string","image_prompt":"string"}]}

Rules:
- image_prompt: a short product photo description for generating an image of the suggested item (e.g. "minimal white leather sneakers on white background")
- reason: 1 sentence explaining why this item works
- STRICTLY NO profanity`;
    }

    const data = await callWithFallback(
      ["gemini-2.5-flash-lite", "gemma-3-4b-it", "gemini-2.5-flash"],
      apiKey,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt + "\n\nAnalyze this outfit and suggest items. Return JSON only." },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            ],
          },
        ],
      }
    );

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let result = null;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    return new Response(JSON.stringify({ suggestions: result?.suggestions || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
