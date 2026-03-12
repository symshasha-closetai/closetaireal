

## Plan

### Issues from Screenshots
1. **Label naming**: "Drip Score" and "Style Score" labels — both should say "Drip" (since "Style" is already a sub-score)
2. **Share card brand**: The "ClosetAI" text in the shareable card's `<span>` has `background` style but `html2canvas` may not render it properly — need to use a wrapping `<div>` with explicit background instead
3. **Share card sub-score rings**: The score numbers aren't visually centered in the circles — the current inline-styled circles use `display: flex` but the text may overflow or misalign at certain font sizes

### Changes in `src/components/OutfitRatingCard.tsx`

**1. Rename labels**
- Line 204: `"Drip Score"` → `"Drip"`
- Line 253: `"Style Score Analysis"` → `"Drip Analysis"`
- Line 450 (share card): `"Style Score"` → `"Drip"`

**2. Fix share card brand box**
- Lines 428-432: Replace the `<span>` with a `<div>` wrapper that has explicit `background`, `borderRadius`, `padding`, and `display: inline-block` so `html2canvas` renders the box correctly

**3. Fix share card sub-score rings**
- Lines 484-496: Increase circle size slightly (50→54px), use explicit `lineHeight` and `fontSize` to ensure the number is properly centered within the ring. Add `boxSizing: border-box` to prevent overflow.

### Files to Change
| File | Change |
|------|--------|
| `src/components/OutfitRatingCard.tsx` | Rename labels, fix share card brand box, fix sub-score ring centering |

