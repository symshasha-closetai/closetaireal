import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { r2Upload, r2Delete, r2List, r2PublicUrl } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";

    // Binary upload via multipart or raw body
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const path = formData.get("path") as string;
      const fileContentType = formData.get("contentType") as string || file.type || "image/jpeg";
      if (!file || !path) throw new Error("file and path required");

      const bytes = new Uint8Array(await file.arrayBuffer());
      const publicUrl = await r2Upload(path, bytes, fileContentType);
      return new Response(JSON.stringify({ publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JSON actions
    const body = await req.json();
    const { action } = body;

    if (action === "upload-from-url") {
      const { url, path, contentType: ct } = body;
      if (!url || !path) throw new Error("url and path required");
      const res = await fetch(url);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const publicUrl = await r2Upload(path, bytes, ct || "image/png");
      return new Response(JSON.stringify({ publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { paths } = body;
      if (!paths?.length) throw new Error("paths required");
      await r2Delete(paths);
      return new Response(JSON.stringify({ deleted: paths.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { prefix } = body;
      const keys = await r2List(prefix || "");
      return new Response(JSON.stringify({ keys }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-public-url") {
      const { path } = body;
      if (!path) throw new Error("path required");
      return new Response(JSON.stringify({ publicUrl: r2PublicUrl(path) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("r2-storage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
