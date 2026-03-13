import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function waitForPrediction(predictionUrl: string, apiKey: string, maxWait = 120000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(predictionUrl, { headers: { "Authorization": `Bearer ${apiKey}` } });
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
    const { imagePrompt } = await req.json();
    if (!imagePrompt) return new Response(JSON.stringify({ error: "No prompt provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const replicateKey = Deno.env.get("REPLICATE_API_KEY");
    if (!replicateKey) throw new Error("REPLICATE_API_KEY not configured");

    const prompt = `A photorealistic product photograph of: ${imagePrompt}. Clean professional e-commerce product photo, pure white background, high-quality sharp well-lit, natural colors and fabric textures, studio product photography style.`;

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
      if (createRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await createRes.text();
      console.error("Replicate error:", createRes.status, errText);
      throw new Error(`Replicate error: ${createRes.status}`);
    }

    const prediction = await createRes.json();
    const result = await waitForPrediction(prediction.urls.get, replicateKey);
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    return new Response(JSON.stringify({ imageUrl: imageUrl || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-suggestion-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
