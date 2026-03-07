import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { modelDescription, userId, occasion } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const poseContext = occasion 
      ? `The model should be posing in a way appropriate for a ${occasion} setting.`
      : "The model should be standing in a natural, confident pose.";

    const prompt = `Generate a full-body fashion model illustration/avatar with these exact physical characteristics: ${modelDescription}. 

The model should be shown in a clean, minimal outfit (plain white t-shirt and jeans) on a clean white/light gray background. ${poseContext}

Style: Fashion illustration, realistic proportions, clean lines, editorial fashion photography feel. The model should look approachable and stylish. Full body from head to toe visible.`;

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
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      throw new Error("No image generated");
    }

    // Upload to storage
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Convert base64 to bytes
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const path = `${userId}/model-avatar-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(path, bytes, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // Return base64 as fallback
        return new Response(JSON.stringify({ imageBase64: imageData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(path);
      
      // Update style profile
      await supabase.from("style_profiles").update({ model_image_url: urlData.publicUrl }).eq("user_id", userId);

      return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ imageBase64: imageData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-model-avatar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
