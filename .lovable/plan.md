## Plan: Fix Killer Tag Position, Share Card Photo, Centering, "Check Another" Button, and Improve AI Prompts

### Issues Identified

1. **Killer tag covers face** — hardcoded at `top-16 right-4` / `top: 60` in share card. Need to move it to bottom-right of the photo area instead, so it never overlaps the face.
2. **Share card not showing photo** — `html2canvas` can't load blob URLs (`blob:...`) created by `URL.createObjectURL`. Need to convert the image to a base64 data URL before passing to html2canvas.
3. **Text not centered** in share card — occasion tag and some elements lack `textAlign: center`.
4. **No "Check Another Photo" button** — need a button after results to reset and try another photo.
5. **Killer tags too region-specific** (e.g. "Patakha Kudi") — update AI prompt to use region specific Gen Z slangs which shouldn't hurt anyone's feelings.
6. **Praise line not Gen Z enough** — update prompt to require trendy Gen Z slangs with emojis.

### Changes

**1. `supabase/functions/rate-outfit/index.ts**` — Update system prompt:

- `killer_tag`: Require region specific and universal english Gen Z tags (e.g. "Miss Marvelous", "Aura Farming", "Main Character", "Slay Architect", "Drip Deity", "Vibe Curator"). 
- `praise_line`: Require Gen Z slangs that are universally hype (e.g. "ate and left no crumbs", "you're literally giving", "serving looks"). Include emojis.

**2. `src/components/OutfitRatingCard.tsx**`:

- **Killer tag position**: Move from `top-16 right-4` to `bottom-20 right-4` (above the gradient scores area, away from face). Same for share card: move from `top: 60` to `bottom: 120`.
- **Share card photo fix**: Convert blob URL image to base64 data URL before rendering the share card, so html2canvas can capture it.
- **Center alignment**: Fix occasion tag and scores to be centered in the share card.
- **Add `onReset` prop** or handle internally — add a "Check Another Photo" button below the card.

**3. `src/pages/CameraScreen.tsx**`:

- Add a "Check Another Photo" button below `OutfitRatingCard` that calls `clearImage()`.

### Files


| File                                      | Change                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/rate-outfit/index.ts` | Update killer_tag and praise_line prompt instructions                                                                |
| `src/components/OutfitRatingCard.tsx`     | Move killer tag to bottom-right, fix share card image (base64 conversion), center texts, add share card layout fixes |
| `src/pages/CameraScreen.tsx`              | Add "Check Another Photo" button after results                                                                       |
