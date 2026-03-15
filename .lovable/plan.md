

## Plan: Drag-and-Drop Pinned Items + Streak Visibility Fix + Text Shadow Improvements

### 3 Changes

---

### 1. Drag-and-Drop Reorder for Pinned Items (WardrobeScreen)

**Approach**: Use `@dnd-kit/core` and `@dnd-kit/sortable` for smooth drag-and-drop on pinned wardrobe items.

- Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- In `WardrobeScreen.tsx`, wrap the pinned items subset in a `DndContext` + `SortableContext`
- Each pinned item card becomes a `useSortable` draggable
- On drag end, reorder the pinned items array and persist the new order via a `pin_order` integer column in the `wardrobe` table
- Sort pinned items by `pin_order` ASC, then unpinned by `created_at` DESC
- When toggling pin ON, set `pin_order` to max existing + 1

**Database migration**: Add `pin_order integer DEFAULT 0` to `wardrobe` table.

### 2. Fix Streak Visibility on Today's Look Card (HomeScreen)

The streak badge and daily tag text are hard to read against light photo backgrounds (as shown in the screenshot). Fix by:

- Strengthen bottom gradient: change `from-black/70 via-transparent` → `from-black/90 via-black/40 to-transparent`
- Add `textShadow: "0 2px 8px rgba(0,0,0,0.9)"` to the daily killer tag text
- Add `textShadow: "0 1px 4px rgba(0,0,0,0.8)"` to the date text
- Change date text from `text-white/60` → `text-white/80`
- Add stronger shadow to the streak badge and "Today's Look" badge

### 3. Text Shadow Consistency (HomeScreen top badges + buttons)

- Add `backdrop-blur-md` and darker backgrounds to the share/camera buttons (from `bg-foreground/30` → `bg-black/50`)
- Add `text-shadow` to badge text inside the gradient overlay area

### Files Modified
- `src/pages/WardrobeScreen.tsx` — drag-and-drop for pinned items using dnd-kit
- `src/pages/HomeScreen.tsx` — stronger gradient, text shadows on daily tag/date/badges
- Migration: add `pin_order` column to `wardrobe`

