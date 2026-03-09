

## Plan: Cache Option Images Locally on Device

Currently, every time the app loads, each option image does a `HEAD` request to check if it exists in cloud storage, which adds latency. We can cache images locally using `localStorage` so they load instantly on repeat visits.

### Approach

Create a shared `useOptionImage` hook in `src/hooks/useOptionImage.ts` that:

1. **Check localStorage first** — store `{ url, timestamp }` keyed by `option-img-{category}-{label}`. If found and not expired (e.g. 7-day TTL), use it immediately with no network call.
2. **Fall back to HEAD check** on cloud storage — if cache miss, do the existing HEAD request.
3. **Fall back to edge function** — generate if not cached anywhere.
4. **Save to localStorage** after any successful load so next time is instant.

### Files

| File | Change |
|------|--------|
| `src/hooks/useOptionImage.ts` | **New** — shared hook with localStorage caching |
| `src/components/StyleProfileEditor.tsx` | Import shared hook, remove duplicate `useOptionImage` |
| `src/pages/OnboardingScreen.tsx` | Import shared hook, remove duplicate `useOptionImage` |

### Key Detail

```typescript
const CACHE_KEY = `option-img-${category}-${label}`;
const cached = localStorage.getItem(CACHE_KEY);
if (cached) {
  const { url, ts } = JSON.parse(cached);
  if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
    setImageUrl(url);
    return; // Instant, no network
  }
}
// ... existing HEAD check + edge function fallback
// On success: localStorage.setItem(CACHE_KEY, JSON.stringify({ url: imageUrl, ts: Date.now() }));
```

This eliminates repeated HEAD requests and makes images appear instantly on return visits. The 7-day TTL ensures images refresh periodically.

