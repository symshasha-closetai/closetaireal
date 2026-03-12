## Plan

### 1. Make Style Personality consistent & wardrobe-based

**Problem**: The personality is computed with a rule-based heuristic that can fluctuate — it re-runs every time the profile page loads and depends on style preferences + wardrobe items in a non-deterministic priority order. The 24h cache doesn't help if the user navigates back.

**Fix** (`ProfileScreen.tsx`):

- Generate a **hash** of the wardrobe items + style preferences (sorted JSON of types, styles, materials, colors, brands + selected styles)
- Store this hash alongside the personality tag in localStorage: `{ tag, hash, ts }`
- On load, compute the hash from current wardrobe data. If hash matches cached hash → use cached tag (no TTL expiry needed)
- Only recompute when hash differs (i.e., wardrobe or preferences actually changed)
- This makes the personality **deterministic** and only changes when the underlying data changes

### 2. Toast duration — reduce to 2 seconds

**Fix** (`ProfileScreen.tsx`): Add `{ duration: 2000 }` to the `toast.success("Profile updated!")` call in `handleSavePersonal` (line 241). Also apply to `handleSaveStylesOnly` in `StyleProfileEditor.tsx` and other profile save toasts.

### 3. Reduce top padding

**Fix** (`ProfileScreen.tsx` line 301): Change `pt-14` to `pt-6` on the root container to reduce the excessive top padding.

The button box at the bottom is in a box, remove it and replace it with just buttons rest animations same,  remove outfit check history section

### Files to Change


| File                          | Change                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| `src/pages/ProfileScreen.tsx` | Hash-based personality caching, toast duration, reduce top padding |
