import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { r2List, r2Delete } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const folders = ["body_type", "style", "face_shape"];
    let deleted = 0;

    for (const folder of folders) {
      const keys = await r2List(`option-images/${folder}/`);
      if (keys.length > 0) {
        await r2Delete(keys);
        deleted += keys.length;
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
