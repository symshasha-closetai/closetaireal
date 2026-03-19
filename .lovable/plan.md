

## Plan: Fix Category Button Icon, Allow Deleting Default Categories, Pluralization Matching

### Changes (all in `src/pages/WardrobeScreen.tsx`)

**1. Replace `FolderPlus` icon with `Pencil` icon**
- Line 795: Change `<FolderPlus size={16} />` to `<Pencil size={16} />`
- Update imports accordingly

**2. Allow deleting default categories too**
- In the category manager modal (lines 1136-1142), add delete buttons next to default categories (except "All")
- When a default category is deleted, store it in a local list (e.g. `hiddenDefaults` state) persisted to `localStorage`
- Filter `defaultCategories` through this hidden list when building `allCategories`

**3. Singular/plural matching for category filtering**
- In the `filtered` memo (lines 343-358), normalize category matching so "Shirt" matches "Shirts", "Pant" matches "Pants", "Hoodie" matches "Hoodies", etc.
- Simple approach: create a `normalizeCategory(name)` helper that lowercases and strips trailing "s"/"es"/"ies" for comparison
- Apply this normalization when filtering by custom category name against item `type` and `name` fields:
  ```typescript
  const normalize = (s: string) => s.toLowerCase().replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');
  // Then match: normalize(item.type) === normalize(activeCategory) || normalize(item.name) includes normalize(activeCategory)
  ```
- Also apply when checking duplicate category names in `addCustomCategory`

### Files Modified
- `src/pages/WardrobeScreen.tsx`

