import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const folders = ["body_type", "style", "face_shape"];
    let deleted = 0;

    for (const folder of folders) {
      const { data: files } = await supabase.storage.from("wardrobe").list(`option-images/${folder}`);
      if (files && files.length > 0) {
        const paths = files.map(f => `option-images/${folder}/${f.name}`);
        const { data } = await supabase.storage.from("wardrobe").remove(paths);
        deleted += data?.length || 0;
      }
    }

    return new Response(JSON.stringify({ deleted, message: `Cleared ${deleted} cached images` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clear-option-cache error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
