import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { modelImageUrl, outfitDescription, occasion, userId } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    if (!modelImageUrl) throw new Error("Model image URL required");

    const prompt = `Take this fashion model and dress them in the following outfit for a ${occasion || "casual"} occasion:

${outfitDescription}

Keep the model's body type, skin tone, and overall appearance exactly the same. Only change their clothes to match the described outfit. Make it look natural and realistic. Full body visible, clean background, fashion editorial style.`;

    // Download the model image to inline it
    let imageParts: any[] = [{ text: prompt }];
    try {
      const imgResp = await fetch(modelImageUrl);
      const imgBuffer = await imgResp.arrayBuffer();
      const imgB64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      imageParts.push({ inlineData: { mimeType: "image/png", data: imgB64 } });
    } catch (imgErr) {
      console.error("Failed to download model image:", imgErr);
      imageParts.push({ text: `Reference model image URL: ${modelImageUrl}` });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: imageParts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const responseParts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = responseParts.find((p: any) => p.inlineData);
    const imageB64 = imagePart?.inlineData?.data;

    if (!imageB64) throw new Error("No image generated");

    const imageDataUrl = `data:image/png;base64,${imageB64}`;

    // Upload to storage if userId provided
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const bytes = Uint8Array.from(atob(imageB64), c => c.charCodeAt(0));

      const path = `${userId}/tryon-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, bytes, { contentType: "image/png" });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
        return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ imageBase64: imageDataUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("virtual-tryon error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
