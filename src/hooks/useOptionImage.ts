import { useState, useEffect, useCallback } from "react";
import { r2 } from "@/lib/r2Storage";

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export const useOptionImage = (category: string, label: string, gender?: string | null) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCached = async () => {
      const genderSuffix = gender ? `-${gender}` : "";
      const cacheKey = `option-img-${category}-${label}${genderSuffix}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { url, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            if (!cancelled) setImageUrl(url);
            return;
          }
        }
      } catch {}

      const cachePath = `option-images/${category}/${label.toLowerCase().replace(/\s+/g, "-")}${genderSuffix}.png`;
      const { publicUrl } = r2.getPublicUrl(cachePath);

      try {
        const res = await fetch(publicUrl, { method: "HEAD" });
        if (res.ok) {
          if (!cancelled) {
            setImageUrl(publicUrl);
            localStorage.setItem(cacheKey, JSON.stringify({ url: publicUrl, ts: Date.now() }));
          }
          return;
        }
      } catch {}

      // No cached image found — do NOT auto-generate
    };

    loadCached();
    return () => { cancelled = true; };
  }, [category, label, gender]);

  const generate = useCallback(async () => {
    setLoading(true);
    const genderSuffix = gender ? `-${gender}` : "";
    const cacheKey = `option-img-${category}-${label}${genderSuffix}`;
    try {
      // Still uses the edge function which now uploads to R2
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("generate-option-images", {
        body: { category, label, gender: gender || null },
      });
      if (!error && data?.imageUrl) {
        setImageUrl(data.imageUrl);
        localStorage.setItem(cacheKey, JSON.stringify({ url: data.imageUrl, ts: Date.now() }));
      }
    } catch {}
    setLoading(false);
  }, [category, label, gender]);

  return { imageUrl, loading, generate };
};
