## Plan

### 1. Full-size model on desktop — match reference image style

The reference shows the AI model taking up the full right panel height with no cropping. Currently `lg:h-[520px]` is set. Will increase to `lg:h-[600px]` or use `lg:min-h-[600px]` with `object-contain` instead of `object-cover` so the full body is visible without cropping, matching the reference screenshot.

### 2. Remove logo from top center of HomeScreen

The `AppHeader` component renders a centered logo + "ClosetAI" text. Will remove the center logo section, keeping only the brand's name, theme toggle (left) and profile avatar (right).

### 3. Fix share card — ensure photo is included and texts are centered

In `OutfitRatingCard.tsx`, the hidden share card (lines 342-457):

- The photo uses `imageBase64 || image` which should work, but will verify the `crossOrigin` attribute is set correctly.
- Sub-scores text and praise line need `textAlign: "center"` — scores section already has `justifyContent: "space-around"` but individual score labels/numbers need centering verification.
  &nbsp;

### 4. Reduce space above brand name in share card

The brand tag is at `top: 16` — reduce this and also check if the share card container has extra top padding. Will tighten the spacing.

5. The brand name at top has excessive space above it (padding). Will reduce top padding on  move the brand tag closer to the top edge on the home page.

### Files to modify

- `src/components/AppHeader.tsx` — Remove center logo section
- `src/pages/HomeScreen.tsx` — Update model image sizing to show full body (`object-contain`, taller height)
- `src/components/OutfitRatingCard.tsx` — Fix share card: ensure photo renders, center all text, reduce top spacing above brand