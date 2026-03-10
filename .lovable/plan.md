

## Plan: Enhanced Share Card & Clickable Profile Illustrations

Two changes: upgrade the share card visuals, and make profile section illustrations (option images) clickable with a fullscreen preview.

---

### 1. Share Card Visual Upgrade

**File: `src/components/OutfitRatingCard.tsx`** (lines 397-513 — the hidden share card)

- Replace the dark blue gradient background with a more striking gradient (e.g., deep purple → rose gold → dark, or a glassmorphic dark overlay)
- Upgrade typography: use `Playfair Display` for scores and praise line, `Montserrat` for labels
- Add subtle decorative elements: gradient border glow, sparkle emoji accents, a frosted glass sub-scores section
- Improve the score circles with gradient borders instead of solid colors
- Make the praise line larger with better font weight and letter spacing
- Add a subtle pattern or noise texture effect via CSS gradient overlay

**Specific changes:**
- Background: `linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)` with a rose-gold accent overlay
- Score numbers: larger font size (42px), gradient text effect via `-webkit-background-clip`
- Sub-score circles: double-ring effect with outer glow
- Praise line: serif font (`Playfair Display`), larger size (17px), gold/champagne color
- CTA: slightly more prominent with a subtle gradient underline
- Add thin gold separator lines

---

### 2. Clickable Profile Illustrations with Fullscreen Preview

**File: `src/components/StyleProfileEditor.tsx`**

- Add a fullscreen image preview dialog state: `previewImage: string | null`
- When any `OptionImageThumbnail` or the AI Model image is clicked, set `previewImage` to that URL
- Render an overlay/modal with:
  - Dark backdrop (`bg-black/80`)
  - The image displayed large (max-width/max-height constrained)
  - An X button in the top-right corner to close
  - Tap outside to close

**Changes to `OptionImageThumbnail` component:**
- Accept an `onClick` prop and wrap the image in a clickable button
- Pass click handler from parent that sets the preview image

**Changes to AI Model section:**
- Wrap the model image in a clickable button too

**New overlay (inside StyleProfileEditor):**
```
{previewImage && (
  <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={close}>
    <button className="absolute top-4 right-4 ..."><X /></button>
    <img src={previewImage} className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain" />
  </div>
)}
```

---

### 3. Realistic Illustrations Note

The profile option images are already generated via the `generate-option-images` edge function. To ensure they are "realistic, not just drawings," the prompt in the edge function would need updating. However, since the user's primary ask is about the UI behavior (clickable + expandable), I'll focus on that. If the generated images still look like drawings, we can update the edge function prompt separately.

**File: `supabase/functions/generate-option-images/index.ts`**
- Update the image generation prompt to explicitly request "photorealistic" style instead of illustrations

---

### Files to modify
- `src/components/OutfitRatingCard.tsx` — enhanced share card gradient, typography, decorative elements
- `src/components/StyleProfileEditor.tsx` — clickable images with fullscreen preview overlay, pass onClick to thumbnails
- `supabase/functions/generate-option-images/index.ts` — update prompt for photorealistic output

