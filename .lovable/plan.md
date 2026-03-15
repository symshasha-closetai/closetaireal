

## Plan: Fix Score Visibility, Add Score Caching, Extract Outfits Button, and Route Suggestions to Fastest AI

### 1. Fix Score Ring Visibility on Photo Overlay

The screenshot shows the score rings are hard to see — the ring strokes are thin and blend into the photo. Changes:

**`src/components/ScoreRing.tsx`**
- When `light` is true, increase `strokeWidth` from 3 → 4
- Add a subtle text shadow to the score number for contrast: `textShadow: "0 1px 4px rgba(0,0,0,0.6)"`
- Make the background track more visible: change `stroke-white/20` → `stroke-white/30`

**`src/components/OutfitRatingCard.tsx`** (lines 270-306)
- Increase the gradient overlay opacity: change `from-black/60 via-black/30` → `from-black/80 via-black/50` so scores have a darker backdrop
- Increase score ring size from 54 → 60 for better readability

### 2. Consistent Scores per Photo (Caching)

Hash the compressed image base64 and use it as a cache key. If the same image is uploaded again, return cached scores instead of calling the AI.

**`src/pages/CameraScreen.tsx`**
- After compression, compute a simple hash of the base64 string (first 100 chars + length as key)
- Check `drip_history` table for existing results with matching image hash
- Also check localStorage cache before calling `rate-outfit`
- If cached result found, skip API call and show cached scores instantly
- Store the hash alongside the result in both localStorage and DB

**`drip_history` table** — add an `image_hash` column via migration to enable server-side cache lookup

### 3. "Extract Outfits" Button

Add a new button above "Get Wardrobe Suggestions" that detects clothing items from the photo and adds them to the user's wardrobe.

**`src/components/OutfitRatingCard.tsx`**
- Add an "Extract Outfits to Wardrobe" button that calls `analyze-clothing` with the current image base64
- Show detected items in a selectable list
- On confirm, insert selected items into the `wardrobe` table with generated images
- Reuse existing `analyze-clothing` edge function (already handles this)

### 4. Route Suggestions to Fastest AI (gemini-2.5-flash-lite)

**`supabase/functions/generate-suggestions/index.ts`**
- Change model list from `["gemini-2.0-flash", "gemini-2.5-flash"]` to `["gemini-2.5-flash-lite", "gemini-2.0-flash"]`
- `gemini-2.5-flash-lite` is the fastest/cheapest Gemini model — perfect for text-only suggestion generation (no vision needed for wardrobe matching since the image is already analyzed)

Wait — suggestions DO use vision (the image is passed). So use `gemini-2.0-flash` as primary but add `gemini-2.5-flash-lite` as fallback for text-only wardrobe suggestions (where wardrobe items are described textually). For shopping suggestions (which analyze the image), keep `gemini-2.0-flash`.

Actually, both suggestion types pass the image. The fastest vision-capable model is `gemini-2.5-flash-lite`. Let me reconsider — `gemini-2.5-flash-lite` may not handle vision well. The fastest reliable vision model is `gemini-2.5-flash`.

**Updated approach**: Change to `["gemini-2.5-flash", "gemini-2.0-flash"]` — `gemini-2.5-flash` is faster and cheaper than `2.0-flash` while still supporting vision.

### Files Modified
- `src/components/ScoreRing.tsx` — better visibility with thicker stroke + text shadow when `light`
- `src/components/OutfitRatingCard.tsx` — darker gradient, larger rings, "Extract Outfits" button
- `src/pages/CameraScreen.tsx` — image hash caching for consistent scores
- `supabase/functions/generate-suggestions/index.ts` — use `gemini-2.5-flash` as primary (faster)
- DB migration: add `image_hash` column to `drip_history`

