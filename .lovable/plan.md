

## Plan: Multi-Key Gemini Rotation with 8s Fallback

### How It Helps
The main issue is 429 rate limits on a single API key. With 4 keys total, when key 1 gets rate-limited, the function instantly tries key 2, then key 3, then key 4. This dramatically reduces the chance of hitting fallback. Only if ALL 4 keys fail or 8 seconds pass does it return the randomized fallback.

### Changes

#### 1. Add 3 New Gemini API Keys as Secrets
I'll prompt you for 3 additional keys:
- `GOOGLE_AI_API_KEY_2`
- `GOOGLE_AI_API_KEY_3`
- `GOOGLE_AI_API_KEY_4`

The existing `GOOGLE_AI_API_KEY` stays as key 1.

#### 2. Update `supabase/functions/rate-outfit/index.ts`
- Collect all 4 keys into an array: `[GOOGLE_AI_API_KEY, GOOGLE_AI_API_KEY_2, ...]`
- Loop through keys sequentially — on 429 or 5xx, immediately try the next key
- Wrap the entire loop in an 8-second timeout (up from 15s single-call timeout)
- Only return `generateFallback()` if all keys fail OR the 8s timeout fires
- On success from any key, return the real AI result immediately

#### 3. Logic Flow
```text
Start timer (8s)
  → Try Key 1 → success? return result
  → 429/5xx? Try Key 2 → success? return result
  → 429/5xx? Try Key 3 → success? return result
  → 429/5xx? Try Key 4 → success? return result
  → All failed OR 8s elapsed → return fallback
```

### Files Modified
- `supabase/functions/rate-outfit/index.ts` — multi-key rotation + 8s timeout

