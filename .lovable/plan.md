

## Plan: Fix Duplicate "Accessories" in Category Manager

### Problem
"Accessories" exists in both `defaultCategories` and as a user-created custom category in the database. The `allCategories` memo merges both lists without deduplicating, causing two entries. Deleting one (hiding the default) visually removes both because they share the same key/name.

### Fix (`src/pages/WardrobeScreen.tsx`)

**1. Deduplicate `allCategories` memo (lines 270-285)**
- When building the `visible` array, filter out custom categories whose normalized name matches any default category name. This prevents duplicates.

**2. Prevent adding duplicate custom categories**
- The `addCustomCategory` function already checks for duplicates via `normalizeCategory`, but since the user already has one in the DB, the dedup in step 1 handles the display issue going forward.

### Single file change
- `src/pages/WardrobeScreen.tsx` — filter custom categories that duplicate default names in the `allCategories` memo

