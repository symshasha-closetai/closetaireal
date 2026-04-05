

## Fixes: Image Collapse, Share/Download Reliability, Savage Mode Rename, Unfiltered Prompt Creativity

### Issues identified

1. **Image collapsed** — The hero image in `OutfitRatingCard` uses `object-contain` on a `w-full` img without a fixed height, so if the image blob URL expires or CORS blocks it, the `<img>` collapses to 0 height. Need to add `min-h-[300px]` and a fallback `aspect-ratio` to prevent collapse.

2. **Download and share sometimes fail** — The `captureCard()` function fetches the image URL via `fetch(image)` which can fail due to CORS (R2 URLs) or blob URL expiration. Fix: try using the original `imageBase64` data URL as primary source (already available via prop `imageBase64`), only falling back to fetch. Also increase error specificity in toasts.

3. **"Unfiltered" label** → Replace with **"Savage Mode 😏"** (user's choice). Keep it on one line by using shorter text.

4. **Unfiltered/Savage mode gives same output as filtered** — Two root causes:
   - `max_tokens: 256` may truncate longer unfiltered responses with cuss words
   - Temperature is already 0.9 but the model (gemini-2.5-flash-lite) may not be creative enough for this persona. Bump to `temperature: 1.2` for unfiltered Call 2, increase `max_tokens` to `512`, and add stronger "DO NOT use the examples verbatim" instruction.
   - The unfiltered prompt has examples that the model copies verbatim — add explicit "NEVER copy examples. Generate completely original content every single time."

5. **Remaining "dripd.app" references** — All found instances already say "dripd.me". No remaining issues.

### Changes

**1. `src/components/OutfitRatingCard.tsx`** — Fix image collapse + share/download reliability
- Line 568: Add `min-h-[300px]` and `aspect-auto` to the `<img>` to prevent collapse
- Line 213-241 (`captureCard`): Use `imageBase64` prop as primary image source instead of fetching `image` URL. Only fall back to fetch if `imageBase64` is not available. This eliminates CORS/blob-expiry failures.
- Add `imageBase64` to the `captureCard` dependency array

**2. `src/pages/CameraScreen.tsx`** — Rename toggle
- Line 453: Change `"Unfiltered 🔥"` to `"Savage Mode 😏"`

**3. `supabase/functions/rate-outfit/index.ts`** — Fix unfiltered creativity
- Line 23: For unfiltered Call 2, use `temperature: 1.2` and `max_tokens: 512` instead of `0.9` and `256`
- Modify `callGemini` or the call site to pass different params for unfiltered mode
- In `getCall2SystemUnfiltered`: Add stronger anti-copying instruction: "NEVER reuse examples verbatim. Every killer_tag and praise_line must be 100% original, never seen before."
- In unfiltered roast prompt: Same creativity boost

### Technical details

- Image collapse fix: `min-h-[300px]` ensures the card never collapses even if the image fails to load; the gradient overlay and scores still render correctly
- Share card fix: Using `imageBase64` (data URL) directly as the image source for `createImageBitmap` or `new Image()` avoids all CORS issues since it's already in memory
- Temperature 1.2 with gemini-2.5-flash-lite produces more varied outputs; the JSON format constraint keeps it structured
- Increasing max_tokens from 256 to 512 for unfiltered prevents truncation of longer praise lines with cuss words

### Files to edit
- `src/components/OutfitRatingCard.tsx` (image collapse fix + share card reliability)
- `src/pages/CameraScreen.tsx` (toggle label rename)
- `supabase/functions/rate-outfit/index.ts` (creativity boost for unfiltered mode)

