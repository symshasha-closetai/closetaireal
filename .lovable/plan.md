## Plan: Fix Drip History Viewer + Wardrobe Pinning + Home Streak & Share

### 3 Features

---

### 1. Fix Drip History Card Viewer (ProfileScreen)

**Problem**: Clicking a drip history entry shows only the raw photo in a lightbox — no scores, killer tag, or drip card UI like the Camera/Drip Check screen shows.

**Fix**: 

- Expand `DripHistoryEntry` type to include `fullResult` (the full `RatingResult` object from the DB's `full_result` JSONB column)
- When syncing from DB, map `full_result` into the entry
- Replace the plain image lightbox (lines 358-380) with a full-screen overlay that renders `OutfitRatingCard` with the stored result — same component used in the Drip Check screen
- Keep Share and Delete buttons below the card  
keep drip check data in cache and db for 14 days

### 2. Wardrobe Pinning

**Database**: Add `pinned boolean DEFAULT false` column to `wardrobe` table.

**WardrobeScreen changes**:

- Add `pinned` to `ClothingItem` type
- Fetch with `pinned` column, sort pinned items first
- Add a pin toggle button (📌) on each item card
- `togglePin(id, current)` → `supabase.from("wardrobe").update({ pinned: !current }).eq("id", id)`
- Show a small pin badge on pinned items

**HomeScreen changes**:

- Fetch pinned wardrobe items first and then rest, latest first)
  &nbsp;

### 3. Streak Counter + Share on Today's Look (HomeScreen)

**Streak**:

- Track consecutive days of "Today's Look" uploads using localStorage: `streak-{userId}` → `{count, lastDate}`
- On photo upload, check if `lastDate` was yesterday → increment, else reset to 1
- Display a 🔥 streak badge on the Today's Look card (e.g., "🔥 5 day streak")

**Share button**:

- Add a Share2 icon button on the Today's Look card (next to camera button)
- Use `html2canvas` to capture the Today's Look card (photo + daily tag + streak + date)
- Use `navigator.share` with fallback to download

---

### Files Modified

- `src/pages/ProfileScreen.tsx` — full drip card viewer with OutfitRatingCard instead of plain image
- `src/pages/WardrobeScreen.tsx` — pin/unpin toggle, sort pinned first
- `src/pages/HomeScreen.tsx` — pinned items section, streak counter, share button
- Migration: `ALTER TABLE public.wardrobe ADD COLUMN pinned boolean DEFAULT false;`