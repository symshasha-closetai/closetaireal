import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { wardrobeItems, occasion, timeOfDay, weather, styleProfile, surpriseMe, gender } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const wardrobeDesc = wardrobeItems.map((i: any) =>
      `ID:${i.id} - ${i.name || i.type} (${i.type}, color: ${i.color || "unknown"}, material: ${i.material || "unknown"})`
    ).join("\n");

    const genderInfo = gender || styleProfile?.gender || "";
    const profileDesc = styleProfile
      ? `Gender: ${genderInfo || "unknown"}, Body type: ${styleProfile.body_type || "unknown"}, Skin tone: ${styleProfile.skin_tone || "unknown"}, Style preference: ${styleProfile.style_type || "any"}, Face shape: ${styleProfile.face_shape || "unknown"}`
      : "No style profile available";

    const bodyAnalysis = styleProfile?.ai_body_analysis ? `\nAI Body Analysis: ${JSON.stringify(styleProfile.ai_body_analysis)}` : "";
    const faceAnalysis = styleProfile?.ai_face_analysis ? `\nAI Face Analysis: ${JSON.stringify(styleProfile.ai_face_analysis)}` : "";
    const weatherInfo = weather && weather !== "Any" ? `\nWeather conditions: ${weather}` : "";

    const surpriseInstruction = surpriseMe
      ? `\n\n## SURPRISE ME MODE:\nThe user wants you to pick the BEST possible outfit without any occasion/time/weather constraints. Choose the most stylish, versatile, and flattering combination from their wardrobe. Pick an occasion that suits the outfit best and mention it. Be creative and bold!`
      : "";

    const systemPrompt = `You are an expert fashion stylist AI with deep knowledge of color theory, fabric science, and seasonal dressing. Given the user's wardrobe items, occasion, time of day, weather, body profile, and face analysis, suggest 3-5 complete outfit combinations using ONLY items from their wardrobe.${surpriseInstruction}

## COLOR RULES (Critical — apply rigorously):
- **Complementary**: Pair opposites on the color wheel (navy + burnt orange, burgundy + olive).
- **Analogous**: Pair neighbors (blue + teal, pink + coral) for harmonious looks.
- **Neutral anchoring**: Black, white, gray, beige, navy anchor bold pieces. Don't pair two bold statement colors without a neutral.
- **Skin tone**: Warm skin → earthy tones, warm reds, olive. Cool skin → jewel tones, blues, emerald. Neutral skin → both work.
- **Time of day**: Day → lighter, softer tones. Evening → deeper, richer tones. Night → dark, bold, or metallic accents.
- **Occasion**: Formal → monochromatic or tonal dressing. Casual → playful contrast. Party → one statement piece.

## MATERIAL & FABRIC RULES (Critical — apply rigorously):
- **Hot weather**: Prioritize Cotton, Linen, Chiffon (breathable, lightweight). AVOID Wool, Velvet, Leather, Nylon.
- **Cold weather**: Prioritize Wool, Velvet, Leather, Denim (insulating). Layer with Cotton underneath.
- **Rainy weather**: Prioritize Nylon, Polyester, Leather (water-resistant). AVOID Silk, Chiffon, Linen.
- **Cool/Warm weather**: Cotton, Denim, Polyester are versatile mid-range options.
- **Formal occasions**: Silk, Satin, Wool suit fabrics. Avoid casual Cotton tees, Denim (unless smart-casual).
- **Never pair**: Velvet + Denim, Satin + Cotton jersey — clashing formality levels.

## SEASONAL AWARENESS:
- Spring: Pastels, florals, light layers. Cotton, Linen.
- Summer: Bright or earthy tones, minimal layers. Linen, Cotton, Chiffon.
- Autumn: Warm earth tones (rust, mustard, olive, burgundy). Denim, Wool, Leather.
- Winter: Deep jewel tones, dark neutrals, rich textures. Wool, Velvet, Leather.
- Infer season from weather: Hot/Warm → Summer, Cool → Autumn/Spring, Cold → Winter, Rainy → Monsoon.

## ADDITIONAL FACTORS:
- Body type flattery and proportions
- Style coherence — don't mix clashing aesthetics (e.g., sporty top + formal bottom)
- Occasion appropriateness (College ≠ Formal, Party ≠ Business)

Each outfit must use real item IDs from the provided wardrobe. In the explanation, briefly mention WHY the colors and materials work together for the given context.

For each outfit, also provide a "reasoning" object with structured analysis across these categories:
- "season": Why these fabrics/colors suit the season (1 sentence)
- "mood": The vibe or mood this outfit conveys (1 sentence)
- "time_of_day": Why these tones work for the time of day (1 sentence)
- "color_combination": How the colors complement each other (1 sentence)
- "body_type": How this outfit flatters the user's body type (1 sentence)
- "skin_tone": How these colors complement the user's skin tone (1 sentence)

Also provide a "score_breakdown" object with per-factor scores (each a number between 1.0 and 10.0):
- "color": How well the colors harmonize (1.0-10.0)
- "occasion": How appropriate for the occasion (1.0-10.0)
- "season": How suitable for the season/weather (1.0-10.0)
- "body_type": How flattering for the body type (1.0-10.0)
- "skin_tone": How complementary to the skin tone (1.0-10.0)
- "fabric": How appropriate the fabric choices are (1.0-10.0)
The overall "score" should be a weighted average of these factors.

CRITICAL SCORING RULES:
- "score" MUST be a number between 1.0 and 10.0 (e.g. 6.5, 7.8, 8.2, 9.0)
- All score_breakdown values MUST also be between 1.0 and 10.0
- NEVER return a score above 10. NEVER use a percentage scale (0-100).
- NEVER return a score below 1.0.
- Base the score on how well the outfit matches: color harmony, fabric suitability, occasion fit, body type flattery, skin tone complement, and season appropriateness.
- A score of 10 means absolutely perfect match across ALL dimensions. 7-8 is a good match. 5-6 is average. Below 5 means poor match.

Return ONLY valid JSON (no markdown) with this structure:
{"outfits":[{"name":"string","top_id":"string or null","bottom_id":"string or null","shoes_id":"string or null","accessories":["string"],"score":"number between 1.0 and 10.0","explanation":"string","reasoning":{"season":"string","mood":"string","time_of_day":"string","color_combination":"string","body_type":"string","skin_tone":"string"},"score_breakdown":{"color":"number 1-10","occasion":"number 1-10","season":"number 1-10","body_type":"number 1-10","skin_tone":"number 1-10","fabric":"number 1-10"}}]}`;

    const userPrompt = `Wardrobe items:\n${wardrobeDesc}\n\nOccasion: ${occasion}\nTime of day: ${timeOfDay}${weatherInfo}\nProfile: ${profileDesc}${bodyAnalysis}${faceAnalysis}\n\nSuggest 3-5 outfits. Return JSON only.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited — please try again in a minute." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

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
