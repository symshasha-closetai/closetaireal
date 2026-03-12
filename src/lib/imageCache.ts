const IMAGE_CACHE_NAME = 'closetai-images-v1';

/**
 * Cache an image URL in the browser Cache API for offline/fast access.
 */
export async function cacheImage(url: string): Promise<void> {
  if (!('caches' in window) || !url) return;
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const existing = await cache.match(url);
    if (!existing) {
      await cache.add(url);
    }
  } catch {
    // Silently fail — caching is best-effort
  }
}

/**
 * Get a cached image URL, returning the cached response URL or the original.
 */
export async function getCachedImageUrl(url: string): Promise<string> {
  if (!('caches' in window) || !url) return url;
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) {
      // Return object URL from cached blob for faster rendering
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
  } catch {}
  return url;
}

/**
 * Pre-cache an array of image URLs in parallel.
 */
export async function precacheImages(urls: string[]): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const validUrls = urls.filter(Boolean);
    // Only cache ones we don't already have
    const uncached = await Promise.all(
      validUrls.map(async (url) => {
        const existing = await cache.match(url);
        return existing ? null : url;
      })
    );
    const toCache = uncached.filter(Boolean) as string[];
    if (toCache.length > 0) {
      await Promise.allSettled(toCache.map((url) => cache.add(url)));
    }
  } catch {}
}

/**
 * Clear old cached images to free storage.
 */
export async function clearImageCache(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    await caches.delete(IMAGE_CACHE_NAME);
  } catch {}
}
