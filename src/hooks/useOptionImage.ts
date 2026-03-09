import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export const useOptionImage = (category: string, label: string) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      // 1. Check localStorage cache
      const cacheKey = `option-img-${category}-${label}`;
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

      // 2. Check cloud storage via HEAD
      const cachePath = `option-images/${category}/${label.toLowerCase().replace(/\s+/g, "-")}.png`;
      const { data: urlData } = supabase.storage.from("wardrobe").getPublicUrl(cachePath);

      try {
        const res = await fetch(urlData.publicUrl, { method: "HEAD" });
        if (res.ok) {
          if (!cancelled) {
            setImageUrl(urlData.publicUrl);
            localStorage.setItem(cacheKey, JSON.stringify({ url: urlData.publicUrl, ts: Date.now() }));
          }
          return;
        }
      } catch {}

      // 3. Generate via edge function
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-option-images", {
          body: { category, label },
        });
        if (!error && data?.imageUrl && !cancelled) {
          setImageUrl(data.imageUrl);
          localStorage.setItem(cacheKey, JSON.stringify({ url: data.imageUrl, ts: Date.now() }));
        }
      } catch {}
      if (!cancelled) setLoading(false);
    };

    loadImage();
    return () => { cancelled = true; };
  }, [category, label]);

  return { imageUrl, loading };
};
