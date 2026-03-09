import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { faceImageBase64, bodyImageBase64 } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const systemPrompt = `You are an expert body and face analyzer for a fashion styling app. Analyze the provided photos and extract precise physical attributes to help with clothing recommendations. Be respectful and objective.

You MUST respond with a JSON object (no markdown) containing:
{
  "face_analysis": {
    "face_shape": "Oval|Round|Square|Heart|Oblong|Diamond|Triangle",
    "skin_tone": "Fair|Light|Medium|Olive|Dark|Deep",
    "skin_undertone": "Warm|Cool|Neutral",
    "hair_color": "string",
    "eye_color": "string",
    "facial_features": "string"
  },
  "body_analysis": {
    "body_type": "Hourglass|Pear|Rectangle|Apple|Inverted Triangle|Athletic|Slim|Plus Size",
    "build": "Slim|Average|Athletic|Curvy|Plus Size",
    "height_estimate": "Petite|Average|Tall",
    "proportions": "string",
    "shoulder_type": "Narrow|Average|Broad",
    "best_features": "string",
    "styling_notes": "string"
  },
  "model_description": "A detailed visual description of the person for generating an AI fashion model avatar..."
}`;

    const parts: any[] = [
      { text: "Analyze these photos. The first is a face photo and the second is a full body photo. Extract detailed physical attributes for fashion styling purposes. Return JSON only." },
    ];

    if (faceImageBase64) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: faceImageBase64 } });
    }
    if (bodyImageBase64) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: bodyImageBase64 } });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let result = {};
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Gemini response:", content);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-body-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
