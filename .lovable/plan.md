

# Fix Wardrobe Deleted Items + Device-First Caching

## Problem

**HomeScreen wardrobe query (line 428) has no `deleted_at` filter** — it fetches ALL items including soft-deleted ones, so deleted wardrobe items still show up on the Home screen.

WardrobeScreen correctly uses `.is("deleted_at", null)` but HomeScreen does not.

## Changes

### 1. Fix HomeScreen wardrobe query
**File: `src/pages/HomeScreen.tsx`** (line ~428)
- Add `.is("deleted_at", null)` to the wardrobe select query so soft-deleted items are excluded

### 2. Create shared device cache utility
**New file: `src/lib/deviceCache.ts`**
- `getCache<T>(key, ttlMs)` / `setCache(key, data)` / `invalidateCache(key)` helpers
- `CACHE_KEYS` constant with `WARDROBE = "wardrobe-items"` (appends userId at call site)
- Standardizes the caching pattern already used inline in HomeScreen

### 3. Add device-first caching to WardrobeScreen
**File: `src/pages/WardrobeScreen.tsx`**
- On mount: load from localStorage cache instantly, then fetch from DB in background to update
- After every mutation (add, delete, pin, edit, restore, drag-reorder): write updated `items` array to cache
- Use same cache key as HomeScreen so both screens share one source of truth

### 4. Sync HomeScreen to shared cache
**File: `src/pages/HomeScreen.tsx`**
- Replace inline `getCached`/`setCache` with imports from `deviceCache.ts`
- Use the same `CACHE_KEYS.WARDROBE` key that WardrobeScreen writes to

### 5. Auto-purge after 7 days
The existing logic in `ProfileScreen.tsx` (line 224) already permanently deletes items where `deleted_at` is older than 7 days. No changes needed there — just confirming it works as described.

## Files Modified
1. `src/lib/deviceCache.ts` — New, ~25 lines
2. `src/pages/HomeScreen.tsx` — Add `deleted_at` filter + use shared cache
3. `src/pages/WardrobeScreen.tsx` — Add cache-first loading + write-through on mutations

