

## Plan: Fix Score Ring Visibility & Bottom Nav Border

### Issues
1. **Score rings on the photo overlay** — the score text uses `text-foreground` which is dark in light mode but gets lost against the dark gradient overlay on the photo. On dark backgrounds over the image, the numbers and ring tracks are nearly invisible.
2. **Bottom nav has a visible border** — the `glass-card-elevated` class applies `border border-border/40`. The screenshot shows the user wants a borderless bottom nav (matching what they see on desktop).

### Changes

#### 1. ScoreRing — make text white when over photo (`src/components/ScoreRing.tsx`)
- Add an optional `light` prop (boolean) to render white text and a white/20 track circle for use on dark photo overlays
- When `light` is true: score text → `text-white`, background circle stroke → `white/20`
- Default behavior unchanged for sub-scores in the analysis card

#### 2. OutfitRatingCard — pass `light` to hero score rings (`src/components/OutfitRatingCard.tsx`)
- The two ScoreRing instances inside the photo overlay (Drip + Confidence at lines 274, 293) get `light` prop
- Sub-score rings in the analysis section below remain unchanged

#### 3. BottomNav — remove border (`src/components/BottomNav.tsx`)
- Replace `glass-card-elevated` with direct classes: `bg-card/90 backdrop-blur-xl` without `border`
- Keep `rounded-t-3xl` and `safe-bottom`

### Files Modified
- `src/components/ScoreRing.tsx` — add `light` prop for white-on-dark rendering
- `src/components/OutfitRatingCard.tsx` — pass `light` to hero rings
- `src/components/BottomNav.tsx` — remove border from nav

