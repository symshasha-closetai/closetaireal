import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { modelDescription, userId, occasion, facePhotoUrl, bodyPhotoUrl } = await req.json();
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const poseContext = occasion 
      ? `The model should be posing in a way appropriate for a ${occasion} setting.`
      : "The model should be standing in a natural, confident pose.";

    const textPrompt = `Generate a photorealistic full-body photograph of a real person with these exact physical characteristics: ${modelDescription}. 

CRITICAL REQUIREMENTS:
- This must look like a REAL PHOTOGRAPH taken by a professional photographer, NOT an illustration, cartoon, painting, or digital art
- The person should look natural, with real skin texture, real hair, natural lighting
- Match the reference photos as closely as possible - same face structure, skin color, body proportions, hair
- The person should be wearing a simple, clean outfit (plain white t-shirt and well-fitted jeans)
- Clean studio background with soft, professional lighting
- ${poseContext}
- Full body visible from head to toe
- Fashion editorial photography style, shot on a professional camera
${facePhotoUrl ? `\nReference face photo: ${facePhotoUrl}` : ""}
${bodyPhotoUrl ? `\nReference body photo: ${bodyPhotoUrl}` : ""}`;

    // Build message content - include reference images inline if available
    const contentParts: any[] = [{ type: "text", text: textPrompt }];
    
    if (facePhotoUrl) {
      contentParts.push({ type: "image_url", image_url: { url: facePhotoUrl } });
    }
    if (bodyPhotoUrl) {
      contentParts.push({ type: "image_url", image_url: { url: bodyPhotoUrl } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: contentParts.length === 1 ? textPrompt : contentParts }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("No image generated");
    }

    const b64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!b64Match) throw new Error("Invalid image data URL format");
    const imageB64 = b64Match[1];

    // Upload to storage
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const bytes = Uint8Array.from(atob(imageB64), c => c.charCodeAt(0));
      const path = `${userId}/model-avatar-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, bytes, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return new Response(JSON.stringify({ imageBase64: imageDataUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
      await supabase.from("style_profiles").update({ model_image_url: urlData.publicUrl }).eq("user_id", userId);

      return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ imageBase64: imageDataUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-model-avatar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
