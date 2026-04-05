

## Roast Mode Full Result Card + Wardrobe-Only Suggestions + UI Tweaks

### What's changing

1. **Roast mode shows full result card** (not just a toast) — image displayed with all scores at 0, a funny killer_tag, and the roast as the praise_line. This makes it shareable/screenshot-worthy.
2. **Suggestions only from wardrobe** — remove shopping suggestions entirely. If wardrobe is empty, show "Add items to your wardrobe to get styling suggestions."
3. **"Check Another Photo" → "Try With Different Outfit"**
4. **Remove text labels from bottom nav** — icons only

### Files to edit

**1. `supabase/functions/rate-outfit/index.ts`** — Roast returns a full result instead of error-only
- When roast mode is triggered, still run Call 2 but with a roast-specific prompt that generates a funny killer_tag (2-3 words, category-aware humor) and uses the roast_line as the praise_line
- Return full result shape with all scores at 0 but with killer_tag and praise_line populated
- Remove the `error: "roast"` field so the frontend treats it as a normal result card (scores just happen to be 0)

**2. `src/pages/CameraScreen.tsx`** — Stop intercepting roast as special case
- Lines 317-324: Remove the roast toast-and-clear logic. Let roast results flow through as normal results so the full card renders
- Line 545: Change "Check Another Photo" to "Try With Different Outfit"

**3. `src/components/OutfitRatingCard.tsx`** — Wardrobe-only suggestions
- Remove the entire shopping suggestions section (lines 815-867)
- Remove the `fetchSuggestions("shopping")` button and `shoppingSuggestions` rendering
- When wardrobe is empty (`wardrobeItems.length === 0`), replace the "Get Wardrobe Suggestions" button with a styled message: "Add items to your wardrobe to unlock styling suggestions"
- Keep wardrobe suggestions flow as-is when items exist

**4. `src/components/BottomNav.tsx`** — Remove text labels
- Remove the `<span>` elements (lines 54-60) that show "Camera", "Home", "Wardrobe", "Profile" text
- Keep icons only, adjust padding/gap

### Technical details

- The roast-mode Call 2 prompt will be: "Generate a funny 2-3 word killer_tag for a non-human image that was submitted as an outfit. The image is [category]. Make it witty and shareable. The praise_line should be the roast itself."
- The edge function will identify the roast category in Call 1, then pass it to a modified Call 2 for creative roast output
- Result shape stays identical — frontend doesn't need to know it's a roast vs real outfit. Scores are just 0.
- Props cleanup: remove `shoppingSuggestions`, `onShoppingSuggestionsChange`, `loadingShopping` from OutfitRatingCard if they become unused

