## Fix AI Quality + Photo Cropping Issues

### Problems identified

1. **Image over-compressed to 512x512** — `runAnalysis` calls `compressImage(file, 512, 512, ...)` which squashes photos into a tiny square, destroying detail the AI needs to analyze outfits properly. This degrades killer tag and praise line quality because the model can't see the outfit clearly.
2. **Prompt conflicts** — The current prompt mixes your DRIPD AI spec with the old scoring prompt, creating confusion. The killer tag/praise line instructions are buried inside a massive prompt that also asks for scores, reasons, and advice — the model prioritizes the structured scoring over creative tag/praise generation.
3. **No photo aspect ratio preservation** — Photos get force-cropped to 3:4 aspect in display, and compressed to square for AI. Original proportions are lost.

### Implementation

**1. Fix image compression (`src/lib/imageCompression.ts` + `CameraScreen.tsx`)**

- Change `compressImage` call from `(file, 512, 512, 0.65, 200)` to `(file, 1024, 1024, 0.7, 300)` — larger resolution preserves outfit detail for the AI without meaningfully increasing latency
- The compression function already preserves aspect ratio (scales proportionally), so no changes needed there — just increasing the max dimensions

**2. Rewrite the AI prompt in `rate-outfit/index.ts**`

The current prompt tries to do everything in one go. The fix is to restructure it so the DRIPD AI killer tag/praise line spec is the PRIMARY instruction, not an afterthought:

- Move Steps 0-6 of your spec to the TOP of the prompt as the dominant instruction
- Keep the scoring JSON fields but make them secondary ("also return these scores")
- Add explicit instruction: "The killer_tag and praise_line are the MOST IMPORTANT outputs. Generate them UNIQUE to this specific image — the examples given are ONLY for tone reference, never copy them"
- Add `temperature: 0.9` (up from 0.7) to increase creativity/uniqueness of tags
- Keep `gemini-2.5-flash-lite` model — no speed change

**3. Remove forced aspect ratio on display (`CameraScreen.tsx`)**

- Change `aspect-[3/4]` to `aspect-auto` / natural sizing on the preview and the shared image so photos display in their original ratio
- Keep the upload area at 3:4 as a placeholder, but once an image is loaded, show it at its natural aspect

**4. Display the tag properly (`OutfitRatingCard.tsx`)**

- Ensure `killer_tag` renders as uppercase tracking-wide for maximum visual impact
- No other structural changes needed

### Files

- `supabase/functions/rate-outfit/index.ts` — prompt restructure + temperature bump
- `src/pages/CameraScreen.tsx` — compression params + aspect ratio fix
- `src/components/OutfitRatingCard.tsx` — tag display styling