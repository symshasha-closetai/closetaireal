

## Plan: Remove Fallback & Timeout from rate-outfit

Remove the 8-second global timeout and all fallback logic so the function always waits for a real Gemini API response, regardless of how long it takes.

### Changes to `supabase/functions/rate-outfit/index.ts`

1. **Remove `GLOBAL_TIMEOUT` constant and timer checks** — no more `Date.now() - startTime > GLOBAL_TIMEOUT` guards
2. **Remove `generateFallback()` function and all fallback arrays** (killer tags, praise lines, etc.)
3. **Remove the fallback return** at the end — if all keys fail, return an error response instead
4. **Keep multi-key rotation** — still try keys 1→4 on 429/5xx, but without time pressure
5. **Set a generous per-request timeout** (~30s) via `Promise.race` so it doesn't hang forever, but returns an error (not fake data) if it truly times out

### Result
- You'll see exact real response times from Gemini
- No fake/random scores ever returned
- If all 4 keys fail, you get a clear error message instead of hidden fallback data

