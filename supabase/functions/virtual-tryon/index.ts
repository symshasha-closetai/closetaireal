import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function waitForPrediction(predictionUrl: string, apiKey: string, maxWait = 120000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(predictionUrl, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const prediction = await res.json();
    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Prediction ${prediction.status}: ${prediction.error || "unknown"}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Prediction timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { modelImageUrl, outfitDescription, occasion, userId } = await req.json();
    const replicateKey = Deno.env.get("REPLICATE_API_KEY");
    if (!replicateKey) throw new Error("REPLICATE_API_KEY not configured");
    if (!modelImageUrl) throw new Error("Model image URL required");

    const prompt = `A photorealistic fashion photograph of this exact same person wearing: ${outfitDescription}. For a ${occasion || "casual"} occasion. Keep the person's face, body type, skin tone exactly the same. Only change their clothes. Full body visible, clean background, fashion editorial style, professional photography.`;

    // Use FLUX img2img to edit the model image with new outfit
    const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${replicateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt,
          image: modelImageUrl,
          num_outputs: 1,
          aspect_ratio: "2:3",
          output_format: "png",
          output_quality: 90,
          prompt_strength: 0.65,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Replicate create error:", createRes.status, errText);
      if (createRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Replicate error: ${createRes.status}`);
    }

    const prediction = await createRes.json();
    const result = await waitForPrediction(prediction.urls.get, replicateKey);

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    if (!imageUrl) throw new Error("No image generated");

    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const imgRes = await fetch(imageUrl);
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
      const path = `${userId}/tryon-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, imgBytes, { contentType: "image/png" });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
        return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("virtual-tryon error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
