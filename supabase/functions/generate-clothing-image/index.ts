import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, itemName, itemType, itemColor, itemMaterial, userId, bodyType } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const colorDesc = itemColor ? ` in ${itemColor} color` : "";
    const materialDesc = itemMaterial ? ` made of ${itemMaterial}` : "";
    const bodyDesc = bodyType ? ` The mannequin should have ${bodyType} body proportions.` : "";

    const prompt = `Look at this photo and find the ${itemName || itemType}${colorDesc}${materialDesc}. 

Generate a photorealistic image of ONLY that specific clothing item displayed on a mannequin/dress form:
- Display the garment on a clean, minimal mannequin/dress form against a pure white or light gray background${bodyDesc}
- The mannequin should be faceless — just a body form
- Show the complete garment properly fitted on the form
- Photorealistic, high-quality fashion photography
- Natural fabric texture and accurate colors
- Professional fashion store display quality
- Well-lit with soft, even lighting and minimal shadows
- No person, no face, just the mannequin form with the clothing`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            ],
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    // Extract image from Gemini response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    const generatedImageB64 = imagePart?.inlineData?.data;

    if (!generatedImageB64 || !userId) {
      return new Response(JSON.stringify({ imageBase64: generatedImageB64 ? `data:image/png;base64,${generatedImageB64}` : null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upload to Supabase storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bytes = Uint8Array.from(atob(generatedImageB64), c => c.charCodeAt(0));

    const path = `${userId}/clothing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(path, bytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ imageBase64: `data:image/png;base64,${generatedImageB64}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);

    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-clothing-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
