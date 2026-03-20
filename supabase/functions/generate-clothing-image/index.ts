import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { r2Upload, r2PublicUrl } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { itemName, itemType, itemColor, itemMaterial, userId, bodyType, gender } = await req.json();
    const replicateKey = Deno.env.get("REPLICATE_API_KEY");
    if (!replicateKey) throw new Error("REPLICATE_API_KEY not configured");

    const colorDesc = itemColor ? ` in ${itemColor} color` : "";
    const materialDesc = itemMaterial ? ` made of ${itemMaterial}` : "";
    const typeLower = (itemType || "").toLowerCase();
    const nameLower = (itemName || "").toLowerCase();
    const combined = `${typeLower} ${nameLower}`;

    const isEyewear = ["glasses", "eyewear", "sunglasses", "shades"].some(k => combined.includes(k));
    const isJewelry = ["jewelry", "jewellery", "necklace", "bracelet", "ring", "watch", "earring", "chain", "pendant", "anklet"].some(k => combined.includes(k));

    const isWatch = ["watch", "wristwatch"].some(k => combined.includes(k));
    const isBracelet = ["bracelet", "anklet", "bangle"].some(k => combined.includes(k));
    const isNecklace = ["necklace", "chain", "pendant"].some(k => combined.includes(k));
    const isEarring = ["earring"].some(k => combined.includes(k));

    let prompt: string;
    const colorEmphasis = itemColor ? ` The color MUST be exactly ${itemColor} — this is critical, do not use any other color.` : "";
    const mannequinBase = "plain white featureless mannequin, completely smooth, no hair, no skin texture, no facial features, no skin color, solid white mannequin body";
    if (isEyewear) {
      prompt = `A photorealistic close-up of a ${mannequinBase} head wearing ${itemName || itemType}${colorDesc}${materialDesc}. Smooth white featureless mannequin head, no hair, no face details. Front-facing eye-level camera angle. Pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else if (isWatch || isBracelet) {
      prompt = `A photorealistic close-up of a ${mannequinBase} wrist wearing ${itemName || itemType}${colorDesc}${materialDesc}. Show only the smooth white mannequin wrist area. Front-facing eye-level camera angle. Pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else if (isNecklace) {
      prompt = `A photorealistic close-up of a ${mannequinBase} neck wearing ${itemName || itemType}${colorDesc}${materialDesc}. Show only the smooth white mannequin neck and upper chest. Front-facing eye-level camera angle. Pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else if (isEarring) {
      prompt = `A photorealistic close-up of a ${mannequinBase} ear wearing ${itemName || itemType}${colorDesc}${materialDesc}. Smooth white featureless mannequin head, no hair. Front-facing eye-level camera angle. Pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else if (isJewelry) {
      prompt = `A photorealistic close-up of a ${mannequinBase} wearing ${itemName || itemType}${colorDesc}${materialDesc}. Focus on the jewelry piece on the appropriate body part of the smooth white mannequin. Front-facing eye-level camera angle. Pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else {
      prompt = `A photorealistic photograph of a full ${itemColor ? itemColor + " " : ""}${itemName || itemType}${materialDesc} displayed on a ${mannequinBase}. Full garment visible from top to bottom, front-facing eye-level camera angle, 2D flat style. The mannequin is completely white and featureless with no hair, no skin, no face. Pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
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
          aspect_ratio: "2:3",
          output_format: "png",
          output_quality: 90,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Replicate create error:", createRes.status, errText);
      if (createRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Replicate error: ${createRes.status}`);
    }

    const prediction = await createRes.json();
    const result = await waitForPrediction(prediction.urls.get, replicateKey);
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    if (!imageUrl) throw new Error("No image generated");

    if (!userId) {
      return new Response(JSON.stringify({ imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upload to R2
    const imgRes = await fetch(imageUrl);
    const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `${userId}/clothing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
    const publicUrl = await r2Upload(path, imgBytes, "image/png");

    return new Response(JSON.stringify({ imageUrl: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-clothing-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
