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
    const { modelDescription, userId, occasion, gender, facePhotoUrl, bodyPhotoUrl } = await req.json();
    const replicateKey = Deno.env.get("REPLICATE_API_KEY");
    if (!replicateKey) throw new Error("REPLICATE_API_KEY not configured");

    const poseContext = occasion
      ? `posing appropriately for a ${occasion} setting`
      : "standing in a natural, confident pose";

    const genderDesc = gender ? `${gender} ` : "";

    const prompt = `A photorealistic full-body photograph of a real ${genderDesc}person with these physical characteristics: ${modelDescription}. ${poseContext}. Wearing a simple white t-shirt and well-fitted jeans. Clean studio background, soft professional lighting, fashion editorial photography style, full body visible head to toe, shot on professional camera. NOT an illustration or cartoon.`;

    const input: Record<string, any> = {
      prompt,
      num_outputs: 1,
      aspect_ratio: "2:3",
      output_format: "png",
      output_quality: 90,
    };

    if (facePhotoUrl) {
      input.prompt = `${prompt} The person's face should match the reference photo exactly.`;
    }

    const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${replicateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
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
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const imgRes = await fetch(imageUrl);
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
      const path = `${userId}/model-avatar-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, imgBytes, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return new Response(JSON.stringify({ imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
      await supabase.from("style_profiles").update({ model_image_url: urlData.publicUrl }).eq("user_id", userId);

      return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-model-avatar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
