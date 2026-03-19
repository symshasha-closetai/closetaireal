

## Plan: Drag-to-Reorder Categories in Manage Modal

### What Changes

Add drag-and-drop reordering to both default and custom categories inside the "Manage Categories" modal, using the existing `@dnd-kit` library already in the project.

### Implementation

**1. Add order tracking**
- Store category display order in `localStorage` (key: `closetai-category-order`) as an array of category names
- Both default (visible) and custom categories share one ordered list
- On load, merge any new/missing categories to the end of the saved order

**2. Drag-and-drop in the modal**
- Wrap the combined category list inside a `DndContext` + `SortableContext` (already imported)
- Create a small `SortableCategoryRow` component (similar to existing `SortableCard`) with a `GripVertical` drag handle
- On drag end, reorder the list and persist to `localStorage`

**3. Apply order to the tab bar**
- The category tab bar (`allCategories`) will respect the saved order instead of always showing defaults first
- "All" always stays first regardless of order

### Files Modified
- `src/pages/WardrobeScreen.tsx` — add `SortableCategoryRow`, wrap category lists in DndContext, persist order to localStorage, apply order to tab bar

