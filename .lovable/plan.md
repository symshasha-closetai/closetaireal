## Plan: Wardrobe-style History Section + Move Deleted Items to Profile History

The user wants the Profile history tab to use a horizontal scrollable card layout like the "My Wardrobe" section on the Home screen (reference image), and move the "Deleted Items" section from Wardrobe to the Profile history tab. No collapsibles — just visual card sections.

### Changes

**1. ProfileScreen.tsx — Replace collapsible history sections with card-style layout**

Remove `Collapsible` wrappers from Drip History, Saved Outfits, and Saved Suggestions. Replace with always-visible sections using a horizontal scrollable row of image cards (like the wardrobe preview on Home), each with a category label overlay at the bottom. when clciked on sview all it will open in a page completely for that only, scrollable vertically

Layout per section:

- Section header with title, count badge, and "Clear All" button
- Horizontal scroll row of square image cards (aspect-square, rounded-xl) with bottom label overlay
- If more than 4 items, show a "View all" style indicator

**2. Move Deleted Items from WardrobeScreen to ProfileScreen history tab**

- **WardrobeScreen.tsx**: Remove the "Deleted Items History" collapsible section (lines 834-867). Keep the `deletedItems` fetch logic and `restoreItem`/`permanentlyDeleteItem` functions — or move them.
- **ProfileScreen.tsx**: Add a "Deleted Items" section in the history tab that fetches wardrobe items where `deleted_at IS NOT NULL`. Display them in the same horizontal card layout with Re-add and Permanently Delete buttons.
- Add `restoreItem` and `permanentlyDeleteItem` functions to ProfileScreen.

**3. Remove Collapsible imports** from both files where no longer needed.

### Files Modified

- `src/pages/ProfileScreen.tsx` — new card-style history sections, add deleted items section
- `src/pages/WardrobeScreen.tsx` — remove deleted items section