import { supabase } from "@/integrations/supabase/client";

const R2_PUBLIC_URL = "https://pub-6946b34d456541bfb993b14cc2eaa2a7.r2.dev";

export const r2 = {
  /**
   * Upload a file to R2 via the r2-storage edge function
   */
  async upload(
    path: string,
    blob: Blob | File,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ publicUrl: string; error: Error | null }> {
    try {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("path", path);
      if (options?.contentType) formData.append("contentType", options.contentType);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/r2-storage`;

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": anonKey,
          "authorization": `Bearer ${session?.access_token || anonKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        return { publicUrl: "", error: new Error(err.error || "Upload failed") };
      }

      const data = await res.json();
      return { publicUrl: data.publicUrl, error: null };
    } catch (e) {
      return { publicUrl: "", error: e instanceof Error ? e : new Error("Upload failed") };
    }
  },

  /**
   * Get public URL for a path (no network call needed if R2_PUBLIC_URL is set)
   */
  getPublicUrl(path: string): { publicUrl: string } {
    if (R2_PUBLIC_URL) {
      return { publicUrl: `${R2_PUBLIC_URL.replace(/\/$/, "")}/${path}` };
    }
    // Fallback: will need to call edge function
    return { publicUrl: `${path}` };
  },

  /**
   * Delete files from R2
   */
  async remove(paths: string[]): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.functions.invoke("r2-storage", {
        body: { action: "delete", paths },
      });
      return { error: error ? new Error(String(error)) : null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Delete failed") };
    }
  },
};
