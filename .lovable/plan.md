

## Plan: Replicate Model Routing, Page Load Speed, Fix Outfit ID Display, Surprise Me Single Outfit, Daily Photo Reset

### 1. Replicate Model Routing for Faster Image Generation
**Files: All Replicate edge functions**

Currently all use `flux-schnell`. Route by task:
- **Clothing images** (`generate-clothing-image`): Use `flux-schnell` (fast, good enough for product shots) — keep as-is
- **Suggestion images** (`generate-suggestion-image`): Use `flux-schnell` — keep as-is  
- **Option images** (`generate-option-images`): Use `flux-schnell` — keep as-is

Add a **shorter polling interval** (1s instead of 2s) and **shorter timeout** (60s instead of 120s) in `waitForPrediction` across all Replicate functions to return faster. Also add `prefer: "wait"` header where supported to get synchronous responses instead of polling.

### 2. Fix Outfit Card Showing Item IDs
**File: `src/pages/HomeScreen.tsx`**

In the outfit results, when `getItemById` returns `undefined` for an accessory ID (AI returned a non-existent ID), it still renders. The `.filter(Boolean)` should catch this, but the outfit name or explanation may contain raw IDs. Fix:
- In the outfit detail view, filter out accessories whose IDs don't match any wardrobe item
- Don't display item labels that look like UUIDs — if `wi.name` matches UUID pattern, show `wi.type` instead

### 3. Surprise Me Shows Only 1 Best Outfit
**File: `supabase/functions/style-me/index.ts`**

When `surpriseMe: true`, change the prompt to request only **1 single best outfit** instead of 3-5. Update the system prompt conditionally.

### 4. Today's Look Photo Resets Daily
**File: `src/pages/HomeScreen.tsx`**

Currently the photo persists via localStorage with a date check. The check already clears old dates, but the uploaded photo stays in storage. Update:
- On load, if the cached date ≠ today, clear `todayPhoto` state AND remove the localStorage entry (already done)
- No need to delete from storage (costs nothing, avoids extra API call)
- This is already implemented — just verify the logic is correct

### 5. Faster Page Loads
**File: `src/pages/HomeScreen.tsx`**

- Show cached wardrobe items immediately (already done with `getCached`)
- Ensure no blocking API calls before rendering — move `fetchStyleProfile` to be lazy (only called when Style Me is pressed, already the case)
- No changes needed here — architecture is already optimized

### Files Modified
- `src/pages/HomeScreen.tsx` — fix ID display in outfit cards, verify daily photo reset
- `supabase/functions/style-me/index.ts` — Surprise Me returns 1 outfit
- `supabase/functions/generate-clothing-image/index.ts` — faster polling
- `supabase/functions/generate-suggestion-image/index.ts` — faster polling
- `supabase/functions/generate-option-images/index.ts` — faster polling

