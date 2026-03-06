

# Plan: Skin Tone Swatches, Camera Fix, Share Fix, Suggestion Images, and Editable Detected Items

## 1. Skin Tone Color Swatches (OnboardingScreen.tsx)

Replace the text-only skin tone chips with circular color swatches that visually represent each tone:

| Tone | Color |
|------|-------|
| Fair | #F5DEB3 |
| Light | #F0C8A0 |
| Medium | #D4A574 |
| Olive | #B08D57 |
| Dark | #8B6D4A |
| Deep | #5C3D2E |

Each swatch: a 40px circle filled with the color, label below, selected state with ring border.

## 2. Camera Button Fix (CameraScreen.tsx, WardrobeScreen.tsx)

The `capture="environment"` attribute only works on mobile browsers. On desktop it falls back to gallery. However, both camera inputs currently have `capture="environment"` which is correct for mobile. The issue may be that the same `onChange` handler resets the input. Will ensure:
- Camera input has `capture="environment"` (back camera) 
- Gallery input has NO `capture` attribute
- Add `onClick` to reset input value so re-selection works: `e.currentTarget.value = ""`

## 3. Share Button Fix (OutfitRatingCard.tsx)

The share button uses `navigator.share` which requires a secure context and user gesture. The current implementation only shares text. Issues:
- On desktop, `navigator.share` may not be available, falls back to clipboard — but `navigator.clipboard.writeText` also requires secure context
- Fix: wrap both in try/catch properly, add a more robust fallback

The share button click handler needs to be properly bound. Will also add `type="button"` to prevent any form submission issues.

## 4. Images in Suggestions (OutfitRatingCard.tsx + rate-outfit edge function)

Currently suggestions are text-only. To show images:

**For wardrobe suggestions**: The AI returns item names that match wardrobe items. Pass `wardrobeItems` (with `image_url`) to `OutfitRatingCard` so it can match suggestion `item_name` to actual wardrobe items and show their photos.

**For shopping suggestions**: Use AI image generation (`google/gemini-2.5-flash-image`) to generate small preview images for each shopping suggestion. However, this would be slow and expensive. Instead, use a simpler approach: add an `image_url` field to the suggestion that the `rate-outfit` function can populate by matching against wardrobe items, and for shopping suggestions use placeholder category icons.

Better approach: Pass wardrobe items with image_urls to OutfitRatingCard. Match wardrobe suggestions by name/type. For shopping suggestions, show category-specific icons (Shirt, shoe, etc.).

**Changes:**
- `CameraScreen.tsx`: Pass `wardrobeItems` to `OutfitRatingCard`
- `OutfitRatingCard.tsx`: Accept `wardrobeItems` prop, match suggestions to wardrobe item images, show thumbnails. For shopping suggestions, show styled category icons.
- `rate-outfit/index.ts`: Update wardrobe_suggestions to include `wardrobe_item_id` field so we can match exactly.

## 5. Editable Detected Items in Wardrobe (WardrobeScreen.tsx)

When AI detects items, allow users to edit each detected item's properties before saving:
- Show each detected item in an editable card
- Editable fields: name (text input), type (dropdown: Tops/Bottoms/Shoes/Dresses/Accessories), color (text input), material (text input)
- User can toggle select/deselect and edit inline before saving

**Changes to `WardrobeScreen.tsx`:**
- Make `detectedItems` state mutable
- Add inline edit fields for each detected item in the AI results view
- Add a function to update a specific detected item's properties

## Files to Edit

| Action | File |
|--------|------|
| Edit | `src/pages/OnboardingScreen.tsx` — skin tone swatches |
| Edit | `src/pages/CameraScreen.tsx` — camera fix, pass wardrobe items to rating card |
| Edit | `src/pages/WardrobeScreen.tsx` — camera fix, editable detected items |
| Edit | `src/components/OutfitRatingCard.tsx` — fix share, add images to suggestions |
| Edit | `supabase/functions/rate-outfit/index.ts` — add wardrobe_item_id to suggestions schema |

