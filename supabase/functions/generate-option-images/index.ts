import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const prompts: Record<string, Record<string, string>> = {
  body_type: {
    Hourglass: "Professional fashion photography of a real person with hourglass body type, balanced bust and hips with clearly defined waist, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    Pear: "Professional fashion photography of a real person with pear body type, hips visibly wider than shoulders, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    Rectangle: "Professional fashion photography of a real person with rectangle body type, even proportions and straight silhouette, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    Apple: "Professional fashion photography of a real person with apple body type, broader midsection with slimmer legs, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    "Inverted Triangle": "Professional fashion photography of a real person with inverted triangle body type, broad shoulders narrower hips, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    Athletic: "Professional fashion photography of a real person with athletic body type, muscular well-defined build, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    Slim: "Professional fashion photography of a real person with slim body type, lean frame narrow build, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
    "Plus Size": "Professional fashion photography of a real person with plus size body type, fuller curvier figure, wearing fitted neutral clothing, full body standing pose, studio lighting, crisp sharp focus, clean white studio background",
  },
  style: {
    Casual: "Professional fashion photography of a single complete casual outfit on a person, relaxed jeans with t-shirt and sneakers, full body shot, studio lighting, crisp sharp focus, clean white studio background",
    Formal: "Professional fashion photography of a single complete formal outfit on a person, sharp tailored suit with dress shoes, full body shot, studio lighting, crisp sharp focus, clean white studio background",
    Streetwear: "Professional fashion photography of a single complete streetwear outfit on a person, oversized hoodie with cargo pants and chunky sneakers, full body shot, studio lighting, crisp sharp focus, clean white studio background",
    Minimalist: "Professional fashion photography of a single complete minimalist outfit on a person, clean simple neutral toned clothing with basic shapes, full body shot, studio lighting, crisp sharp focus, clean white studio background",
    Bohemian: "Professional fashion photography of a single complete bohemian outfit on a person, flowing maxi dress with layered jewelry and sandals, full body shot, studio lighting, crisp sharp focus, clean white studio background",
    Classic: "Professional fashion photography of a single complete classic outfit on a person, timeless blazer with chinos and oxford shoes, full body shot, studio lighting, crisp sharp focus, clean white studio background",
    Sporty: "Professional fashion photography of a single complete sporty outfit on a person, athletic tracksuit with trainers, full body shot, studio lighting, crisp sharp focus, clean white studio background",
  },
  face_shape: {
    Oval: "Professional close-up portrait photograph showing a real person with an oval face shape, slightly longer than wide with balanced proportions, clear skin, neutral expression, studio lighting, crisp sharp focus, clean white background",
    Round: "Professional close-up portrait photograph showing a real person with a round face shape, equal width and length with soft cheekbones, clear skin, neutral expression, studio lighting, crisp sharp focus, clean white background",
    Square: "Professional close-up portrait photograph showing a real person with a square face shape, strong defined jawline and angular features, clear skin, neutral expression, studio lighting, crisp sharp focus, clean white background",
    Heart: "Professional close-up portrait photograph showing a real person with a heart face shape, wide forehead tapering to narrow chin, clear skin, neutral expression, studio lighting, crisp sharp focus, clean white background",
    Oblong: "Professional close-up portrait photograph showing a real person with an oblong face shape, longer face with straight cheeks, clear skin, neutral expression, studio lighting, crisp sharp focus, clean white background",
    Diamond: "Professional close-up portrait photograph showing a real person with a diamond face shape, narrow forehead and chin with wide cheekbones, clear skin, neutral expression, studio lighting, crisp sharp focus, clean white background",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { category, label, gender } = await req.json();
    if (!category || !label) {
      return new Response(JSON.stringify({ error: "category and label required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cachePath = `option-images/${category}/${label.toLowerCase().replace(/\s+/g, "-")}${gender ? `-${gender}` : ""}.png`;
    
    // Check cache
    const { data: existingFile } = await supabase.storage.from("wardrobe").download(cachePath);
    if (existingFile && existingFile.size > 0) {
      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(cachePath);
      return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let prompt = prompts[category]?.[label] || `A professional fashion reference image for ${category}: ${label}, studio photography on clean white background`;
    if (gender) {
      prompt = prompt.replace("a real person", `a ${gender} person`).replace("a person", `a ${gender} person`);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const images = data.choices?.[0]?.message?.images;
    const imageDataUrl = images?.[0]?.image_url?.url;

    if (!imageDataUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "No image generated" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Extract base64 from data URL
    const b64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!b64Match) {
      throw new Error("Invalid image data URL format");
    }
    const imageB64 = b64Match[1];

    const binaryData = Uint8Array.from(atob(imageB64), c => c.charCodeAt(0));
    await supabase.storage.from("wardrobe").upload(cachePath, binaryData, { contentType: "image/png", upsert: true });
    const { data: publicUrlData } = supabase.storage.from("wardrobe").getPublicUrl(cachePath);

    return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-option-images error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
