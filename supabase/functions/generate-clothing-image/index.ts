import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const genderWord = gender === "female" ? "female" : gender === "male" ? "male" : "";

    let prompt: string;
    const colorEmphasis = itemColor ? ` The color MUST be exactly ${itemColor} — this is critical, do not use any other color.` : "";
    if (isEyewear) {
      prompt = `A photorealistic close-up portrait of a ${genderWord} person wearing ${itemName || itemType}${colorDesc}${materialDesc}. Focus on the face showing the eyewear clearly, pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else if (isJewelry) {
      prompt = `A photorealistic close-up photograph of a ${genderWord} person wearing ${itemName || itemType}${colorDesc}${materialDesc}. Focus on the jewelry piece, pure white background, professional fashion photography, well-lit with soft even lighting, minimal shadows.${colorEmphasis}`;
    } else {
      prompt = `A photorealistic flat-lay product photograph of exactly one ${itemColor ? itemColor + " " : ""}${itemName || itemType}${materialDesc} neatly arranged on a pure white background. No mannequin, no person, no dress form. Clean e-commerce style product shot, natural fabric texture, well-lit with soft even lighting, minimal shadows, top-down view.${colorEmphasis}`;
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

    // Upload to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const imgRes = await fetch(imageUrl);
    const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
    const path = `${userId}/clothing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;

    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(path, imgBytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-clothing-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
