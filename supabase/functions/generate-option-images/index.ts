import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { r2Upload, r2PublicUrl, r2Download, r2Head } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const prompts: Record<string, Record<string, string>> = {
  body_type: {
    Hourglass: "Ultra-realistic high-resolution photograph of a real person with hourglass body type, balanced bust and hips with clearly defined waist, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    Pear: "Ultra-realistic high-resolution photograph of a real person with pear body type, hips visibly wider than shoulders, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    Rectangle: "Ultra-realistic high-resolution photograph of a real person with rectangle body type, even proportions and straight silhouette, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    Apple: "Ultra-realistic high-resolution photograph of a real person with apple body type, broader midsection with slimmer legs, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    "Inverted Triangle": "Ultra-realistic high-resolution photograph of a real person with inverted triangle body type, broad shoulders narrower hips, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    Athletic: "Ultra-realistic high-resolution photograph of a real person with athletic body type, muscular well-defined build, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    Slim: "Ultra-realistic high-resolution photograph of a real person with slim body type, lean frame narrow build, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
    "Plus Size": "Ultra-realistic high-resolution photograph of a real person with plus size body type, fuller curvier figure, wearing fitted neutral clothing, full body standing pose, professional studio lighting, photorealistic skin texture, sharp focus, clean white studio background",
  },
  style: {
    Casual: "Ultra-realistic fashion photograph of a complete casual outfit on a person, relaxed jeans with t-shirt and sneakers, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Formal: "Ultra-realistic fashion photograph of a complete formal outfit on a person, sharp tailored suit with dress shoes, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Streetwear: "Ultra-realistic fashion photograph of a complete streetwear outfit on a person, oversized hoodie with cargo pants and chunky sneakers, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Minimalist: "Ultra-realistic fashion photograph of a complete minimalist outfit on a person, clean simple neutral toned clothing, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Bohemian: "Ultra-realistic fashion photograph of a complete bohemian outfit on a person, flowing maxi dress with layered jewelry and sandals, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Classic: "Ultra-realistic fashion photograph of a complete classic outfit on a person, timeless blazer with chinos and oxford shoes, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Sporty: "Ultra-realistic fashion photograph of a complete sporty outfit on a person, athletic tracksuit with trainers, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
    Gym: "Ultra-realistic fashion photograph of a complete gym workout outfit on a person, compression leggings performance tank top training shoes, full body shot, professional studio lighting, photorealistic fabric textures, sharp focus, clean white studio background",
  },
  face_shape: {
    Oval: "Ultra-realistic close-up portrait photograph of a real person with an oval face shape, slightly longer than wide with balanced proportions, clear skin, neutral expression, professional studio lighting, photorealistic skin texture, sharp focus, clean white background",
    Round: "Ultra-realistic close-up portrait photograph of a real person with a round face shape, equal width and length with soft cheekbones, clear skin, neutral expression, professional studio lighting, photorealistic skin texture, sharp focus, clean white background",
    Square: "Ultra-realistic close-up portrait photograph of a real person with a square face shape, strong defined jawline and angular features, clear skin, neutral expression, professional studio lighting, photorealistic skin texture, sharp focus, clean white background",
    Heart: "Ultra-realistic close-up portrait photograph of a real person with a heart face shape, wide forehead tapering to narrow chin, clear skin, neutral expression, professional studio lighting, photorealistic skin texture, sharp focus, clean white background",
    Oblong: "Ultra-realistic close-up portrait photograph of a real person with an oblong face shape, longer face with straight cheeks, clear skin, neutral expression, professional studio lighting, photorealistic skin texture, sharp focus, clean white background",
    Diamond: "Ultra-realistic close-up portrait photograph of a real person with a diamond face shape, narrow forehead and chin with wide cheekbones, clear skin, neutral expression, professional studio lighting, photorealistic skin texture, sharp focus, clean white background",
  },
};

async function waitForPrediction(predictionUrl: string, apiKey: string, maxWait = 60000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(predictionUrl, { headers: { "Authorization": `Bearer ${apiKey}` } });
    const prediction = await res.json();
    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(`Prediction ${prediction.status}: ${prediction.error || "unknown"}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Prediction timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { category, label, gender } = await req.json();
    if (!category || !label) {
      return new Response(JSON.stringify({ error: "category and label required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const replicateKey = Deno.env.get("REPLICATE_API_KEY");
    if (!replicateKey) throw new Error("REPLICATE_API_KEY not configured");

    const cachePath = `option-images/${category}/${label.toLowerCase().replace(/\s+/g, "-")}${gender ? `-${gender}` : ""}.png`;

    // Check cache in R2
    const exists = await r2Head(cachePath);
    if (exists) {
      return new Response(JSON.stringify({ imageUrl: r2PublicUrl(cachePath) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let prompt = prompts[category]?.[label] || `A professional fashion reference image for ${category}: ${label}, studio photography on clean white background`;
    if (gender) {
      prompt = prompt.replace("a real person", `a ${gender} person`).replace("a person", `a ${gender} person`);
    }

    const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${replicateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "png",
          output_quality: 90,
        },
      }),
    });

    if (!createRes.ok) {
      if (createRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await createRes.text();
      console.error("Replicate error:", createRes.status, errText);
      throw new Error(`Replicate error: ${createRes.status}`);
    }

    const prediction = await createRes.json();
    const result = await waitForPrediction(prediction.urls.get, replicateKey);
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    if (!imageUrl) throw new Error("No image generated");

    // Download and cache to R2
    const imgRes = await fetch(imageUrl);
    const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
    const publicUrl = await r2Upload(cachePath, imgBytes, "image/png");

    return new Response(JSON.stringify({ imageUrl: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-option-images error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
