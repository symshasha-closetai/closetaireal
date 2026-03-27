import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_KEYS = [
  Deno.env.get("GOOGLE_AI_API_KEY"),
  Deno.env.get("GOOGLE_AI_API_KEY_2"),
  Deno.env.get("GOOGLE_AI_API_KEY_3"),
  Deno.env.get("GOOGLE_AI_API_KEY_4"),
].filter(Boolean) as string[];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wardrobeItems, styleProfile, startDate } = await req.json();

    if (!wardrobeItems || wardrobeItems.length === 0) {
      return new Response(JSON.stringify({ error: "No wardrobe items provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "long" });
    const season = (() => {
      const m = now.getMonth();
      if (m >= 2 && m <= 4) return "Spring";
      if (m >= 5 && m <= 7) return "Summer";
      if (m >= 8 && m <= 10) return "Autumn/Fall";
      return "Winter";
    })();

    const itemsSummary = wardrobeItems.map((item: any) =>
      `- ID: ${item.id} | Type: ${item.type} | Name: ${item.name || "unnamed"} | Color: ${item.color || "unknown"} | Material: ${item.material || "unknown"}`
    ).join("\n");

    const profileContext = styleProfile
      ? `Body type: ${styleProfile.body_type || "unknown"}, Skin tone: ${styleProfile.skin_tone || "unknown"}, Gender: ${styleProfile.gender || "unknown"}, Style: ${styleProfile.style_type || "any"}`
      : "No style profile available";

    const prompt = `You are a personal fashion stylist. Plan 7 casual daily outfits for the next 7 days starting from ${startDate || new Date().toISOString().split("T")[0]}.

RULES:
- Use ONLY items from the wardrobe below. Reference items by their exact ID.
- Each outfit must have at least a top and bottom (or a dress). Shoes are optional but preferred.
- Vary outfits across the 7 days — avoid repeating the same top+bottom combo.
- Consider the current season (${season}, ${month}) and the user's profile.
- Keep it casual and practical for daily wear.

USER PROFILE: ${profileContext}

WARDROBE ITEMS:
${itemsSummary}

Return a JSON array of exactly 7 objects:
[
  {
    "day_offset": 0,
    "name": "Outfit name (creative, short)",
    "items": ["item_id_1", "item_id_2", "item_id_3"],
    "occasion": "Casual",
    "explanation": "Brief 1-sentence explanation of why this works"
  }
]

day_offset 0 = today, 1 = tomorrow, etc. Return ONLY the JSON array, no markdown.`;

    const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 2048,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "[]";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let outfits;
    try {
      outfits = JSON.parse(content);
    } catch {
      // Try to extract array from response
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        outfits = JSON.parse(match[0]);
      } else {
        outfits = [];
      }
    }

    return new Response(JSON.stringify({ outfits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-outfit-calendar error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
