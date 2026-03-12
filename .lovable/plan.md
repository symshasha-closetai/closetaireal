

## Plan: Restore Sub-Score Rings to Interactive Card

The previous changes incorrectly removed the Color/Style/Fit score rings from both the interactive card AND the share card. You only wanted them removed from the share card. The share card (lines 416-502) already has them removed — that's correct. But the interactive card is missing them.

### Changes

**`src/components/OutfitRatingCard.tsx`** — Add back the sub-score rings and their tooltips to the Analysis Section (around line 292, after the Drip/Confidence tooltip block):

1. Re-add the 3 small score rings (Color, Style, Fit) in a horizontal row using the existing `subScores` array (already defined at lines 205-209)
2. Re-add the sub-score tooltip that shows reasoning when tapped
3. Re-add the "Tap for details" hint text

This restores the interactive card to show Color/Style/Fit rings while keeping the share card clean without them.

No changes needed to `App.tsx` — the loading fix there looks correct already.

