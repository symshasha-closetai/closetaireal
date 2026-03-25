export const CACHE_KEYS = {
  WARDROBE: "dripd-wardrobe",
  DRIP_HISTORY: "dripd-drip-history",
  SAVED_OUTFITS: "dripd-saved-outfits",
  SAVED_SUGGESTIONS: "dripd-saved-suggestions",
  LEADERBOARD_DAILY: "dripd-leaderboard-daily",
  LEADERBOARD_WEEKLY: "dripd-leaderboard-weekly",
} as const;

const DEFAULT_TTL = 48 * 60 * 60 * 1000; // 48 hours

export function getCache<T>(key: string, userId: string, ttlMs = DEFAULT_TTL): T | null {
  try {
    const raw = localStorage.getItem(`${key}-${userId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) {
      localStorage.removeItem(`${key}-${userId}`);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export function setCache(key: string, userId: string, data: unknown): void {
  try {
    localStorage.setItem(`${key}-${userId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function invalidateCache(key: string, userId: string): void {
  try {
    localStorage.removeItem(`${key}-${userId}`);
  } catch {}
}
