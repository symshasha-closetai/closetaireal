import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const prompts: Record<string, Record<string, string>> = {
  body_type: {
    Hourglass: "A fashion silhouette illustration of an hourglass body type, balanced bust and hips with defined waist, elegant standing pose, minimalist style on clean white background",
    Pear: "A fashion silhouette illustration of a pear body type, hips wider than shoulders, elegant standing pose, minimalist style on clean white background",
    Rectangle: "A fashion silhouette illustration of a rectangle body type, even proportions straight silhouette, elegant standing pose, minimalist style on clean white background",
    Apple: "A fashion silhouette illustration of an apple body type, broader midsection slimmer legs, elegant standing pose, minimalist style on clean white background",
    "Inverted Triangle": "A fashion silhouette illustration of an inverted triangle body type, broad shoulders narrow hips, elegant standing pose, minimalist style on clean white background",
    Athletic: "A fashion silhouette illustration of an athletic body type, muscular well-defined build, elegant standing pose, minimalist style on clean white background",
    Slim: "A fashion silhouette illustration of a slim body type, lean frame narrow build, elegant standing pose, minimalist style on clean white background",
    "Plus Size": "A fashion silhouette illustration of a plus size body type, fuller curvier figure, elegant standing pose, minimalist style on clean white background",
  },
  style: {
    Casual: "A casual style outfit mood board, relaxed comfortable clothing, jeans t-shirt sneakers, lifestyle photography on clean background",
    Formal: "A formal style outfit mood board, sharp polished suit or elegant dress, professional attire, studio photography on clean background",
    Streetwear: "A streetwear style outfit mood board, urban trendy clothing, hoodies graphic tees chunky sneakers, dynamic photography on clean background",
    Minimalist: "A minimalist style outfit mood board, clean simple clothing, neutral colors basic shapes, elegant photography on clean background",
    Bohemian: "A bohemian style outfit mood board, free-spirited artsy clothing, flowing fabrics patterns, warm photography on clean background",
    Classic: "A classic style outfit mood board, timeless elegant clothing, blazer chinos oxford shoes, refined photography on clean background",
    Sporty: "A sporty style outfit mood board, active athletic clothing, performance wear trainers, energetic photography on clean background",
  },
  face_shape: {
    Oval: "A simple elegant illustration of an oval face shape, slightly longer than wide, beauty reference sketch on clean white background",
    Round: "A simple elegant illustration of a round face shape, equal width and length, beauty reference sketch on clean white background",
    Square: "A simple elegant illustration of a square face shape, strong jawline, beauty reference sketch on clean white background",
    Heart: "A simple elegant illustration of a heart face shape, wide forehead narrow chin, beauty reference sketch on clean white background",
    Oblong: "A simple elegant illustration of an oblong face shape, longer face, beauty reference sketch on clean white background",
    Diamond: "A simple elegant illustration of a diamond face shape, narrow forehead and chin wide cheekbones, beauty reference sketch on clean white background",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { category, label, gender } = await req.json();
    if (!category || !label) {
      return new Response(JSON.stringify({ error: "category and label required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Check cache in storage first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cachePath = `option-images/${category}/${label.toLowerCase().replace(/\s+/g, "-")}${gender ? `-${gender}` : ""}.png`;
    
    const { data: existingFile } = await supabase.storage.from("wardrobe").download(cachePath);
    if (existingFile && existingFile.size > 0) {
      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(cachePath);
      return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate image
    let prompt = prompts[category]?.[label] || `A professional fashion reference image for ${category}: ${label}, studio photography on clean white background`;
    if (gender) {
      prompt = prompt.replace("A fashion silhouette", `A ${gender} fashion silhouette`);
      prompt = prompt.replace("A casual style", `A ${gender} casual style`);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      return new Response(JSON.stringify({ error: "No image generated" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache to storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    await supabase.storage.from("wardrobe").upload(cachePath, binaryData, { contentType: "image/png", upsert: true });
    const { data: publicUrlData } = supabase.storage.from("wardrobe").getPublicUrl(cachePath);

    return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-option-images error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
