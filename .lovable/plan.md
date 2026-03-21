# Multi-Feature Update Plan

## 1. Switch all edge functions to `gemini-2.5-flash-lite`

Update the `model` field in all 5 edge functions from `gemini-2.5-flash` to `gemini-2.5-flash-lite` for faster responses and lower cost.

**Files:** `rate-outfit`, `analyze-clothing`, `analyze-body-profile`, `generate-suggestions`, `style-me` (all under `supabase/functions/`)

## 2. Wardrobe cards: remove all action buttons except Pinned

Strip Edit, Pin, Refresh, Delete, Send, and Drag buttons from `WardrobeCardContent`. Keep only the Pinned button on each card. All other actions (edit, pin, delete, share, refresh, send) remain available in the existing full-screen detail view when the user taps the card image.

**File:** `src/pages/WardrobeScreen.tsx` — lines ~141-168 in `WardrobeCardContent`

## 3. Fix filter case/synonym insensitivity

Two changes:

**a) Normalize filter values at display and match time.** When building `uniqueColors`, `uniqueMaterials`, etc., normalize to lowercase and merge synonyms (grey→gray, etc.). Apply the same normalization when filtering items.

**b) Create a synonym map** for common color/material variants:

```text
grey → gray, grey → gray (already lowercase)
```

Apply this in a `normalizeFilterValue()` helper used in both the unique value extraction and the filter comparison logic.

**File:** `src/pages/WardrobeScreen.tsx` — filter-related code (~lines 393-427)

## 4. Style Me: return only 2 outfits, tag best one

**a) Edge function change:** Update `style-me/index.ts` prompt to request exactly 2 outfits instead of 3-5. Add instruction: "Return exactly 2 outfits. Mark the highest-scoring one with `\"best_choice\": true`."

**b) Frontend change:** In `HomeScreen.tsx`, show a "Best Choice ✨" badge on the outfit card that has the highest score (or `best_choice: true`). Sort results so the best one appears first.

**Files:** `supabase/functions/style-me/index.ts`, `src/pages/HomeScreen.tsx` (~lines 795-823)

## Technical Details

- **Model swap**: Simple string replacement `gemini-2.5-flash` → `gemini-2.5-flash-lite` in 5 files
- **Card cleanup**: Remove ~25 lines of button JSX from `WardrobeCardContent`, keep only the edit button
- **Filter normalization**: Add a `normalizeFilterValue(val: string)` function with a synonym map; apply it in `useMemo` for unique values and in filter comparisons
- **Style Me prompt**: Change `outfitCount` from `"3-5"` to `"2"` and add `best_choice` field to JSON schema in the system prompt
- **Best Choice badge**: Conditional rendering of a small gradient badge on the top outfit card