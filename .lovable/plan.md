

## Plan: Full-Screen Item Detail View with Original Photo

### What Changes

**1. Database migration — add `original_image_url` column**
```sql
ALTER TABLE public.wardrobe ADD COLUMN original_image_url text DEFAULT NULL;
```
This stores the original uploaded photo per item so the "eye" button can show it.

**2. Save original photo URL during item creation**
- In `processQueue` (AI flow): after uploading the compressed file to storage, store that public URL as `original_image_url` on each inserted item
- In `handleManualSave`: store the uploaded photo URL as `original_image_url`
- Update the `ClothingItem` type to include `original_image_url`
- Update all `select` queries to include `original_image_url`

**3. Full-screen item detail overlay**
When clicking a wardrobe card (non-select mode), open a full-screen overlay showing:
- Large item image taking most of the screen
- **X** close button at top-right
- Action buttons along the side or bottom: **Pin**, **Edit** (opens existing edit modal), **Eye** (toggle to original photo), **Refresh** (regenerate image), **Delete** (soft-delete)
- Item metadata below image: name, color, material, brand, quality badge

**4. Eye button behavior**
- Toggles between AI-generated image (`image_url`) and original uploaded photo (`original_image_url`)
- When showing original, displays it in a zoomable/full view
- If no `original_image_url` exists (legacy items), button is disabled or hidden

**5. Cache original image URLs**
- Include `original_image_url` in the `precacheImages` call alongside `image_url`
- localStorage cache key per item for fast access

### Files Modified
- `src/pages/WardrobeScreen.tsx` — add detail overlay, eye toggle, onClick handler, save original URL during creation
- Database migration — add `original_image_url` column

