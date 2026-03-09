import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, itemName, itemType, itemColor, itemMaterial, userId, bodyType } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const colorDesc = itemColor ? ` in ${itemColor} color` : "";
    const materialDesc = itemMaterial ? ` made of ${itemMaterial}` : "";
    const bodyDesc = bodyType ? ` The mannequin should have ${bodyType} body proportions.` : "";

    const prompt = `Look at this photo and find the ${itemName || itemType}${colorDesc}${materialDesc}. 

Generate a photorealistic image of ONLY that specific clothing item displayed on a mannequin/dress form:
- Display the garment on a clean, minimal mannequin/dress form against a pure white or light gray background${bodyDesc}
- The mannequin should be faceless — just a body form
- Show the complete garment properly fitted on the form
- Photorealistic, high-quality fashion photography
- Natural fabric texture and accurate colors
- Professional fashion store display quality
- Well-lit with soft, even lighting and minimal shadows
- No person, no face, just the mannequin form with the clothing`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;

    if (!imageUrl || !userId) {
      return new Response(JSON.stringify({ imageBase64: imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upload to Supabase storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract base64 data from data URL
    const b64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(b64Data), c => c.charCodeAt(0));

    const path = `${userId}/clothing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
    const { error: uploadError } = await supabase.storage
      .from("wardrobe")
      .upload(path, bytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ imageBase64: imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);

    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-clothing-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
