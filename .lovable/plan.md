

## Plan: Accessories Category + Improved Image Prompts

### Changes

**1. Fix Accessories category filtering** (`src/pages/WardrobeScreen.tsx`)
- Update the filtering logic so "Accessories" matches items whose `type` includes any of: `Eyewear`, `Glasses`, `Sunglasses`, `Watch`, `Jewelry`, `Jewellery`, `Bracelet`, `Necklace`, `Ring`, `Earring`, `Purse`, `Bag`, `Handbag`, `Belt`, `Hat`, `Scarf`, `Chain`, `Pendant`, `Anklet`, `Bangle`, `Accessories`
- Keep exact match for other default categories (Tops, Bottoms, Shoes)

**2. Update image generation prompts** (`supabase/functions/generate-clothing-image/index.ts`)
- **Tops/Bottoms/general clothing**: Change prompt to show the item on a plain white mannequin (no hair, no skin texture, featureless), front-facing eye-level camera angle, full garment visible, 2D flat style on pure white background
- **Accessories (eyewear, jewelry, watches, etc.)**: Keep accessory-specific prompts but update to use a clean white featureless mannequin where needed (e.g., glasses on a smooth white mannequin head with no hair/features)
- Emphasize: "plain white featureless mannequin, no hair, no skin color, no facial features, front-facing eye-level angle, full garment shown, pure white background"

### Files Modified
- `src/pages/WardrobeScreen.tsx` — update filtering for Accessories
- `supabase/functions/generate-clothing-image/index.ts` — rewrite prompts

