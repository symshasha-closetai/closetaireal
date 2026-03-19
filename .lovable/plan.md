## Plan: Wardrobe UI Fixes, Custom Categories, and Analysis Caching

### Issues Identified

1. **Bottom nav overlaps detail overlay buttons** — the detail view action buttons sit at `pb-8` but the fixed bottom nav covers them. The detail overlay and nav share `z-50`.
2. **Eye button not visible** — 5 buttons crammed in one row on mobile makes them too small/hidden.
3. **Custom categories** — add a pencil button next to categories to create/delete user-defined category groups. Items with matching `type` auto-appear under them.
4. **AI analysis cache** — when AI detects items but saving fails, cache the detected results (keyed by image hash) so the user can retry without re-analyzing.
5. **Drag reorder not working** — likely touch activation issues on mobile.

### Changes

**1. Fix bottom nav overlap in detail overlay**

- Detail overlay already has `z-50` — bump it to `z-[60]` so it sits above the nav
- Add `pb-24` to the action buttons area to ensure they clear the nav bar
- Restructure detail view action buttons into a 2-row grid layout so each button is large and visible:
  - Row 1: Pin, Edit, Original (Eye)
  - Row 2: Refresh, Share, Delete

**2. Custom Categories**

- Add a new database table `wardrobe_categories` with columns: `id`, `user_id`, `name`, `created_at`
- Add a pencil/edit icon next to the category tabs
- Clicking it opens a modal to: create a new category (text input), see existing custom categories, delete them
- remove the dresses category
- Custom categories appear in the category tab bar alongside the defaults
- Filtering: custom category name matches against item `type` field — OR we add a `category` column to wardrobe. Better approach: match custom category name against item `type` so no schema change needed on wardrobe table. Users name categories matching their item types.
- Actually, better: custom categories are just user-defined groupings. When user creates "Shirts", it filters items where `type === "Tops"` AND `name` contains "shirt" (case-insensitive). But this is fragile.
  &nbsp;

**3. Cache AI analysis results**

- After successful AI detection, store results in `localStorage` keyed by a hash of the image (use first 100 chars of base64 + file size)
- Before calling `analyze-clothing`, check cache first
- If `processQueue` fails to insert, the detected items remain in cache so user can retry from the cached result
- images are also in db and cache for eye button
- Add a "Retry from cache" flow: when opening add modal, check if there's a cached analysis and offer to use it

**4. Fix drag reorder**

- Increase touch sensor tolerance and reduce delay for better mobile response

### Database Migration

```sql
-- Custom categories table
CREATE TABLE public.wardrobe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.wardrobe_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories" ON public.wardrobe_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.wardrobe_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.wardrobe_categories FOR DELETE USING (auth.uid() = user_id);

-- Add custom_category to wardrobe
ALTER TABLE public.wardrobe ADD COLUMN custom_category text DEFAULT NULL;
```

### Files Modified

- `src/pages/WardrobeScreen.tsx` — fix detail overlay z-index and padding, restructure action buttons, add custom category UI (modal + tab bar), cache AI analysis, fix drag sensor
- Database migration — `wardrobe_categories` table + `custom_category` column on `wardrobe`