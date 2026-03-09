

## Plan: Fix Share Card Image, Reposition Killer Tag, Add Cancel Button, Brighten Analyzing Spinner

### Issues

1. **Share card not showing photo** — The `imageToBase64` conversion likely fails silently or `html2canvas` still can't render it. Need to store base64 at upload time (when we have the raw `File`) instead of converting blob URLs later.
2. **Killer tag position** — Currently at `bottom-24 right-4` on the photo. User wants it between Drip Score and Confidence Score in the bottom gradient area.
3. **No cancel button during analysis** — The X button calls `clearImage` but doesn't abort the ongoing API call. Need an `AbortController` to actually cancel the fetch, and make the X button more prominent.
4. **Analyzing spinner too transparent** — The overlay uses `bg-background/60` making the Sparkles icon hard to see. Increase opacity and make the icon brighter.

### Changes

**1. `src/pages/CameraScreen.tsx`**
- Store base64 data URL at upload time (read file as data URL and keep it alongside the blob URL) so `OutfitRatingCard` receives a base64 image that `html2canvas` can render.
- Add `AbortController` ref to `analyzeOutfit`. The X button during analysis calls `controller.abort()` + `clearImage()`.
- Change analyzing overlay from `bg-background/60` to `bg-background/80` and make Sparkles icon use `text-accent drop-shadow-lg` with larger size for brightness.

**2. `src/components/OutfitRatingCard.tsx`**
- **In-app card**: Move killer tag from `absolute bottom-24 right-4` on the photo to inside the bottom gradient div, positioned between Drip Score and Confidence Score (centered).
- **Share card**: Move killer tag from `position: absolute; bottom: 120` to inside the scores gradient section, centered between the two score columns.
- Accept `imageBase64` prop (optional) for the share card image source, falling back to the `image` prop.

### Files

| File | Change |
|------|--------|
| `src/pages/CameraScreen.tsx` | Store base64 at upload, add AbortController for cancel, brighten analyzing overlay |
| `src/components/OutfitRatingCard.tsx` | Move killer tag between scores, use base64 prop for share card image |

