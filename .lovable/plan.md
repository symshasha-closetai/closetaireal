## Plan: UI/UX Fixes and Wardrobe History Feature

### Changes Overview

**1. Remove Pinned Items section from Home Screen**

- Delete lines 630-648 in `HomeScreen.tsx` (the "Pinned Items" card)

**2. Wardrobe card buttons — stack vertically on right side**

- Currently buttons are positioned horizontally across top (pin, edit, refresh, delete) causing overlap on small cards
- Rearrange to a vertical stack on the right and left side: pin, edit, refresh, share, delete — each spaced 9px apart vertically (`top-2`, `top-11`, `top-20`, `top-[74px]`, `top-[102px]`) pin, refresh at left; edit, delete at right
- File: `WardrobeScreen.tsx` lines 83-119

**3. Image generation prompt updates**

- In `generate-clothing-image/index.ts`:
  - Eyewear: change to mannequin face only (not full person)
  - Jewelry/watch: specify mannequin neck for necklaces, wrist for watches/bracelets, ear for earrings
  - Regular clothes: change from flat-lay to "clothing item with background removed, transparent/white background, no person"
- This is a prompt-only change; no structural code changes

**4. Reduce top padding on Camera, Wardrobe, Profile screens**

- `CameraScreen.tsx` line 428: `pt-14` → `pt-4`
- `WardrobeScreen.tsx` line 590: `pt-14` → `pt-4`
- `ProfileScreen.tsx` line 346: `pt-6` → `pt-2`

**5. History as collapsible sections in Profile**

- Wrap Drip History, Saved Outfits, and Saved Suggestions in `<Collapsible>` components (from shadcn) instead of always-open lists
- Each section header becomes a toggle; collapsed by default to avoid long scroll
- File: `ProfileScreen.tsx` lines 739-865

**6. Wardrobe soft-delete with history + re-add**

**Database migration:**

```sql
ALTER TABLE public.wardrobe ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Update RLS: existing policies already filter by user_id, 
-- but we need app-level filtering for deleted_at
```

**Code changes:**

- `WardrobeScreen.tsx`:
  - `deleteItem()`: Instead of `supabase.from("wardrobe").delete()`, do `.update({ deleted_at: new Date().toISOString() })`
  - `fetchItems()`: Add `.is("deleted_at", null)` filter to exclude soft-deleted items
  - Add a "Deleted Items" collapsible section under history section showing soft-deleted items with a "Re-add" button
  - "Re-add" sets `deleted_at = null`
  - Add "Permanently Delete" option for truly removing items

### Files Modified

- `src/pages/HomeScreen.tsx` — remove pinned items section
- `src/pages/WardrobeScreen.tsx` — vertical buttons, soft-delete, deleted items section, reduce padding
- `src/pages/CameraScreen.tsx` — reduce padding
- `src/pages/ProfileScreen.tsx` — reduce padding, collapsible history sections
- `supabase/functions/generate-clothing-image/index.ts` — updated prompts
- Database migration: add `deleted_at` column to `wardrobe`