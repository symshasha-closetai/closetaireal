

## Unfiltered Mode Toggle + Share Card Space Fix + Domain Fix

### Changes

**1. `src/pages/CameraScreen.tsx`** — Add "Unfiltered" toggle + pass to edge function
- Add `unfiltered` state (boolean, default false) to `CameraScreen` and persist it in `globalDripState`
- Below the "Drip Check" heading / subtitle line, add a small toggle: label "Unfiltered 🔥" with a Switch component
- Pass `unfiltered` flag through to `runAnalysis` → edge function body
- The toggle should be subtle — small text, right-aligned on the same line as the subtitle

**2. `supabase/functions/rate-outfit/index.ts`** — Unfiltered mode prompt
- Accept `unfiltered` boolean from request body
- When `unfiltered === true`, use a completely different Call 2 system prompt (the user's full prompt above) instead of the current `getCall2System`
- Create `getCall2SystemUnfiltered(dripScore, gender, faceHidden, sceneType)` function with the full unfiltered prompt
- When `unfiltered === true` for roast mode, also use unfiltered roast categories from the user's prompt
- Keep the existing filtered prompt as default

**3. `src/components/OutfitRatingCard.tsx`** — Fix share card space below image
- Line 227: Change `IMG_H = Math.round(H * 0.58)` to `Math.round(H * 0.68)` — gives the image 68% of the canvas height, reducing the bottom panel space significantly
- Adjust `panelY`, score positions, and CTA to fit tighter in the remaining 32%
- Reduce spacing between elements: score area, sub-scores, praise line, and CTA should pack more tightly

**4. `supabase/functions/send-notifications/index.ts`** — Domain fix
- Line 117: Change `dripd.app` to `dripd.me`

### Technical details

- The unfiltered prompt is large (~4KB) but that's fine for an edge function string
- The toggle state persists in `globalDripState` so it survives tab switches
- Gender is already available from `styleProfile.gender` and passed to the edge function
- The unfiltered prompt includes cuss words as hype (never insults) — this is the user's core differentiator
- Share card layout: increasing image from 58% to 68% reduces bottom panel from ~400px to ~300px at 960px height — still enough for scores + praise + CTA with tighter spacing
- Score text sizes may need slight reduction (56px → 48px) to fit in the compressed panel

### Files to edit
- `src/pages/CameraScreen.tsx` (toggle UI + state + pass to edge function)
- `supabase/functions/rate-outfit/index.ts` (unfiltered prompt + accept flag)
- `src/components/OutfitRatingCard.tsx` (share card image height ratio)
- `supabase/functions/send-notifications/index.ts` (domain fix, 1 line)

