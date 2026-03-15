## Plan: Fix Wardrobe Image Issues — Retry Button, Fallback to Original Photo, Better Prompts

### Problems

1. **Images not generated**: Some wardrobe items show a placeholder "Item" — the AI image generation failed and the fallback uploaded photo isn't displaying properly. No way to retry.
2. **Image doesn't match description**: `generate-clothing-image` creates images purely from text prompts (e.g., "Navy Blue Long-Sleeve") without seeing the actual photo. If AI detection gets the color/style wrong, the generated image will be completely wrong (orange top labeled "Navy Blue").

### Changes

#### 1. Add Retry Button + Show Original Photo as Fallback (`src/pages/WardrobeScreen.tsx`)

In the wardrobe grid (lines 563-603), detect broken/placeholder images using an `onError` handler on `<img>`. When an image fails to load or looks like a placeholder:

- Show a **"Retry"** button (refresh icon) overlaid on the card
- Track items with failed images via local state `failedImages: Set<string>`
- The retry calls `generate-clothing-image` with the item's metadata and updates the DB `image_url` on success
- Add `onError` to each `<img>` to catch broken URLs and flag them

#### 2. Use Original Photo When AI Generation Fails (`src/pages/WardrobeScreen.tsx`)

In `processQueue` (lines 208-266), the current fallback already uploads the compressed photo when generation fails. But the issue is that even the fallback upload may produce a URL that doesn't render (CORS, missing file, etc.).

- After fallback upload, verify the URL is accessible before inserting
- Store the original uploaded photo URL more reliably as the default

#### 3. Add Regenerate Image to Edit Modal

In the edit modal, add a **"Regenerate Image"** button that calls `generate-clothing-image` with the current (possibly corrected) item metadata. This lets users fix the description first, then regenerate a matching image.

#### 4. Improve Image-Description Match (`supabase/functions/generate-clothing-image/index.ts`)

The function generates images from text only. To reduce mismatches when AI detection is wrong, pass the **original image as a reference** using Lovable AI (Gemini) to first verify/correct the item description before generating the image. However, this adds complexity. 

Simpler approach: In the prompt, emphasize the exact color and name more strongly so the AI model pays closer attention to the specified attributes. and strictly don't use lovable AI anywhere

### Files Modified

- `src/pages/WardrobeScreen.tsx` — add retry button on failed images, regenerate in edit modal, better fallback handling
- `supabase/functions/generate-clothing-image/index.ts` — strengthen color/description emphasis in prompt