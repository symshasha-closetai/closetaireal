## Issues Identified

### 1. Absurd Scores (100/10, 0.5/10)

The `style-me` edge function prompt says `"score": number` but never constrains the range. The AI sometimes returns scores on a 0-100 scale (100, 95, 90) or fractional values (0.5). The detail view then calculates `matchPercent = Math.round(outfit.score * 10)` which breaks with values outside 0-10. Based on outfits's color combination, occassion, time of day, season, region, body type, skin tone.

**Fix in `supabase/functions/style-me/index.ts`:**

- Add explicit constraint in the prompt: `"score": number (MUST be between 1 and 10, e.g. 7.5, 8.2 — NEVER above 10, NEVER a percentage)`

**Fix in `src/pages/HomeScreen.tsx` (client-side safety net):**

- After parsing outfits, normalize scores: if score > 10, divide by 10; clamp to 0-10 range
- Fix `matchPercent` calculation to handle edge cases

### 2. Dark Mode Too Light

Current dark background is `0 0% 15%` (HSL) — a medium gray. Card is `266 4% 20.8%` which is lighter than background in some contexts.

**Fix in `src/index.css` `.dark` block:**

- Background: `0 0% 7%` (near-black)
- Card: `0 0% 11%` (subtle lift)
- Secondary: `0 0% 14%`
- Muted-foreground: bump lightness from 70% to 75% for brighter secondary text
- Foreground: keep at ~98%

### 3. Share Card Branding Dim

In `OutfitRatingCard.tsx`:

- Bottom URL uses `rgba(255,255,255,0.25)` — nearly invisible
- Top-left "ClosetAI" uses `rgba(255,255,255,0.6)` with no background

**Fix in `src/components/OutfitRatingCard.tsx`:**

- Top-left brand: wrap in a semi-transparent dark pill/box (`background: rgba(0,0,0,0.4)`, `borderRadius: 8px`, `padding`)
- Bottom URL: increase opacity to `rgba(255,255,255,0.5)` 
- Apply same treatment to the live preview branding overlay (the `absolute top-4 left-4` span)

### Summary of Files to Change


| File                                   | Change                                                |
| -------------------------------------- | ----------------------------------------------------- |
| `supabase/functions/style-me/index.ts` | Constrain score range in prompt                       |
| `src/pages/HomeScreen.tsx`             | Normalize/clamp scores client-side after API response |
| `src/index.css`                        | Darken dark-mode background, brighten muted text      |
| `src/components/OutfitRatingCard.tsx`  | Improve brand visibility on share card + live view    |
