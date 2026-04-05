

## Fixes: "Try With Different Outfit" Button Style, Share Card Image Cropping, Couple-Aware Creative Output

### Issues from screenshots

1. **"Try With Different Outfit" button** looks flat — no shadow, no visual weight compared to buttons above it. Needs shadow/elevation to match.
2. **Share card crops the photo** — line 244 uses `Math.max` for cover-fit, cutting off parts of the image. Must switch to `object-contain` (use `Math.min`) so the full photo is always visible.
3. **Couple photos get generic tags** — the SOCIAL CONTEXT section in the prompt exists but is too vague ("chemistry + fit energy"). Needs explicit couple-specific examples that are screenshot-worthy, witty, and Instagram-shareable.
4. **Drip score 1.5 on a food photo** — the roast detection is still leaking scores through. Need to tighten the server-side validation.

### Changes

**1. `src/pages/CameraScreen.tsx`** — Style the "Try With Different Outfit" button
- Line 537: Add `shadow-lg shadow-black/30 bg-card` classes to match the visual weight of the buttons above it
- Change from `border border-border/40` flat look to elevated card-like style

**2. `src/components/OutfitRatingCard.tsx`** — Fix share card image cropping
- Line 244: Change `Math.max` to `Math.min` so image is contain-fit (no cropping)
- Fill letterbox bars with the dark background color (#0f0f0f) which already covers the canvas
- This ensures the full photo is always visible — couples, groups, no parts cut off

**3. `supabase/functions/rate-outfit/index.ts`** — Enhance couple/group creative output
- Expand the SOCIAL CONTEXT section in Call 2 prompt with explicit couple examples:
  - Couple killer_tag examples: "Power Duo", "Main Characters", "Matched Energy", "Couple Goals"
  - Couple praise_line examples: "y'all walked in and the room got nervous", "this duo doesn't need a caption", "the coordination is giving soulmate energy"
- Add instruction: "For couples, the tag and line MUST reference the duo/pair dynamic — never treat it as a solo shot"
- Add similar group-specific examples for squad energy
- Strengthen the "screenshot test" — add: "Would someone tag their partner/friend in this?"

**4. `supabase/functions/rate-outfit/index.ts`** — Tighten roast detection
- The food photo got drip_score 1.5 instead of 0 — the server-side validation (line ~185) checks `face_score === 0 && posture_score === 0` but the AI gave non-zero scores
- Add additional check: if `drip_score < 2` AND `color_score + posture_score + layering_score + face_score < 3`, force roast mode
- This catches edge cases where the AI leaks tiny scores for non-human images

### Files to edit
- `src/pages/CameraScreen.tsx` (button styling — 1 line)
- `src/components/OutfitRatingCard.tsx` (share card image: `Math.max` → `Math.min` — 1 line)
- `supabase/functions/rate-outfit/index.ts` (couple-aware prompt + tighter roast gate)

### Technical details
- Contain-fit uses `Math.min(W / imgW, IMG_H / imgH)` — this scales the image to fit entirely within the frame, with dark bars filling any gaps (already the canvas background)
- The couple/group detection comes from Call 1's `scene_type` field which is already passed to Call 2
- The tighter roast gate (`drip_score < 2 && total_sub < 3`) won't affect real outfit photos since even a bad outfit would score 3+ across sub-scores

