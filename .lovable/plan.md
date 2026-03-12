

## Plan

### 1. Score Breakdown Tooltip in Outfit Detail View
The reasoning grid (lines 661-699) already shows each factor. Add a **score contribution breakdown** by requesting per-factor scores from the AI and displaying them as mini progress bars inside the existing reasoning cards.

**`supabase/functions/style-me/index.ts`**: Add to the prompt's JSON schema a `"score_breakdown"` object alongside `"reasoning"`:
```
"score_breakdown": { "color": number 1-10, "occasion": number 1-10, "season": number 1-10, "body_type": number 1-10, "skin_tone": number 1-10, "fabric": number 1-10 }
```

**`src/pages/HomeScreen.tsx`**:
- Add `score_breakdown` to `OutfitSuggestion` type
- In the reasoning grid cards, append a small colored progress bar showing the per-factor score (e.g., 8.2/10)
- Show a "Score Breakdown" header above the reasoning grid with mini score indicators

### 2. Cache Style Profile & Wardrobe Locally

**Style profile cache** (`HomeScreen.tsx`):
- In `fetchStyleProfile`, check `localStorage` for `style_profile_cache_{userId}` with a 10-minute TTL before hitting the DB
- After fetching, write to localStorage

**Wardrobe cache** (`HomeScreen.tsx`):
- In the `useEffect` that fetches wardrobe, check `localStorage` for `wardrobe_cache_{userId}` with a 5-minute TTL
- On cache hit, use cached data immediately; still fetch in background to update if stale
- Write fetched data to localStorage after DB call

### 3. Remove "Rate Your Outfit" from Detail View

**`src/pages/HomeScreen.tsx`** (lines 703-706): Remove the "Rate Your Outfit" button that navigates to `/camera` from the outfit detail overlay's action buttons section.

### 4. Immediate Try-On Animation on Click

**`src/pages/HomeScreen.tsx`**:
- When "Generate Try-On Preview" is clicked, immediately show a loading animation in the try-on image area (shimmer skeleton with pulsing text like "Creating your virtual try-on...")
- Add a `generatingTryOnIdx` state to track which outfit is generating
- Replace the try-on button with the animation placeholder while loading
- When the image arrives, crossfade it in with a `motion.div` transition

### Files to Change
| File | Change |
|------|--------|
| `supabase/functions/style-me/index.ts` | Add `score_breakdown` to prompt schema |
| `src/pages/HomeScreen.tsx` | All 4 changes: score breakdown UI, caching, remove rate button, try-on animation |

