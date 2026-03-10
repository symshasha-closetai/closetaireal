## Plan: Clear Cache, Gender-Aware Illustrations, Gym Style, Cloth Quality Detection

### 1. Clear Cached Option Images from Storage

**Create a one-time cleanup edge function** or use the existing storage API to delete all files under `option-images/` in the `wardrobe` bucket. Also clear localStorage cache keys (`option-img-*`) on the client side.

- **New edge function: `supabase/functions/clear-option-cache/index.ts**` — lists and deletes all files under `option-images/` in wardrobe bucket
- `**src/components/StyleProfileEditor.tsx**` — add a "Refresh Illustrations" button that invokes the cleanup function and clears localStorage `option-img-*` keys

### 2. Gender-Aware Illustrations

Currently `useOptionImage` doesn't pass gender to the edge function, so all illustrations are gender-neutral.

- `**src/hooks/useOptionImage.ts**` — accept optional `gender` parameter, include it in the cache key and pass to the edge function
- `**src/components/StyleProfileEditor.tsx**` — pass current `gender` state to all `OptionImageThumbnail` components
- `**OptionImageThumbnail` component** — accept and forward `gender` prop to `useOptionImage`
- The edge function already supports `gender` parameter and adjusts prompts accordingly — no changes needed there

### 3. Add "Gym" Style Option

- `**src/components/StyleProfileEditor.tsx**` — add `"Gym"` to `styleOptions` array
- `**src/pages/OnboardingScreen.tsx**` — add `"Gym"` to the `styleOptions` array there too
- `**supabase/functions/generate-option-images/index.ts**` — add a `Gym` prompt to the `style` prompts object (e.g., "Ultra-realistic fashion photograph of a complete gym/workout outfit, compression leggings, tank top, training shoes...")

### 4. AI Cloth Quality Detection

- `**supabase/functions/analyze-clothing/index.ts**` — update the system prompt to also detect `"quality"` (e.g., "Premium", "Mid-range", "Budget", "Unknown")and material of cloth(cotton, linen, polyster,wool, etc.)  based on visible fabric quality, stitching, brand indicators
- `**src/pages/WardrobeScreen.tsx**` — add `quality` to `DetectedItem` type and display it in the detected items UI and wardrobe cards
- **Database migration** — add `quality` column (text, nullable) to `wardrobe` table
- **Save quality** when inserting wardrobe items

### 5. Fix Pear Body Shape Illustration

The prompt for "Pear" already exists in the edge function. The issue is likely that the cached image failed to generate or was corrupted. Clearing the cache (step 1) will force regeneration. Additionally, the gender-aware cache path change will generate fresh images.

---

### Files to modify

- `src/hooks/useOptionImage.ts` — add gender param, update cache key
- `src/components/StyleProfileEditor.tsx` — pass gender to thumbnails, add Gym style, add refresh button
- `src/pages/OnboardingScreen.tsx` — add Gym to style options, pass gender to thumbnails
- `supabase/functions/generate-option-images/index.ts` — add Gym prompt
- `supabase/functions/analyze-clothing/index.ts` — add quality detection to prompt
- `src/pages/WardrobeScreen.tsx` — handle quality field in detected items
- Database migration: add `quality` column to `wardrobe` table
- New edge function: `supabase/functions/clear-option-cache/index.ts`