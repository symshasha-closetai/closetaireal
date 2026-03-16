

## Plan: Gender-Specific Killer Tags + 12s Loading Animation

### Problem
1. Killer tags use gendered words like "King", "Emperor", "Baron" regardless of the user's gender
2. The staged loading animation runs 8s (4 steps x 2s) -- needs to be 12s (4 steps x 3s)

### Changes

#### 1. Edge Function: Gender-aware fallback tags (`supabase/functions/rate-outfit/index.ts`)

- Replace single `KILLER_TAGS` array with two arrays: `KILLER_TAGS_MALE` (~45 tags) and `KILLER_TAGS_FEMALE` (~45 tags), plus a small `KILLER_TAGS_NEUTRAL` set for unknown gender
- Male tags: use King, Boss, Emperor, Don, Baron, etc.
- Female tags: use Queen, Empress, Goddess, Diva, Boss Lady, etc.
- Update `generateFallback()` to accept a `gender` parameter and pick from the appropriate list
- Pass `styleProfile.gender` to `generateFallback()` at all 3 call sites (no API key, AI parse failure, timeout/error)
- Also update the AI prompt to instruct: "Use gender-appropriate language in killer_tag — Queen/Empress/Goddess for female, King/Emperor/Boss for male"

#### 2. Client-side fallback tags (`src/pages/CameraScreen.tsx`)

- Replace `CLIENT_KILLER_TAGS` with `CLIENT_KILLER_TAGS_MALE` and `CLIENT_KILLER_TAGS_FEMALE` arrays (~45 each)
- Update `clientFallbackResult()` to accept a `gender` parameter and pick accordingly
- Pass `styleProfile?.gender` when calling `clientFallbackResult()` (3 call sites in `runAnalysis` + error handler)

#### 3. Increase staged animation to 12s (`src/pages/CameraScreen.tsx`)

- Line 245: Change `(i + 1) * 2000` to `(i + 1) * 3000` (3s per step)
- Line 279: Change `setTimeout(r, 8000)` to `setTimeout(r, 12000)` (minimum delay)

### Files Modified
- `supabase/functions/rate-outfit/index.ts` — gender-split tags, updated fallback + prompt
- `src/pages/CameraScreen.tsx` — gender-split client tags, updated timing

