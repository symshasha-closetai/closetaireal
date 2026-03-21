

# Calendar View: Show Outfits in Calendar Grid, Fix Image Visibility

## Problem
1. The 3rd item image in calendar outfit cards gets cut off/not visible
2. The "View All" overlay shows outfits as a list below the calendar grid — user wants outfits embedded directly in the calendar cells

## Changes

### 1. Redesign calendar grid cells to show outfit previews inline

**File:** `src/pages/HomeScreen.tsx` (lines 946-967 — the calendar grid)

Replace the small dot indicator with actual item thumbnail previews inside each calendar cell. Make cells taller (not square aspect ratio) to fit:
- Day number at top
- 2-3 tiny item thumbnails (stacked or in a row) below the number
- Tapping a cell with an outfit opens the detail overlay

Remove the separate list of outfit cards below the grid (lines 968-988) since the outfits are now shown in the calendar itself.

### 2. Fix image visibility in inline scroll cards

**File:** `src/pages/HomeScreen.tsx` (lines 779-787)

The 3rd image gets clipped because the card is `w-44` with `grid-cols-3` and `gap-0.5`. Increase card width slightly to `w-52` and ensure images have proper sizing. Also show all matched items (not just `slice(0, 3)`) or ensure the grid accommodates them properly.

## Technical Details

- Calendar cells: Change from `aspect-square` to a taller ratio (~`h-20`), show day number + 2-3 micro thumbnails (16x16 or 20x20 rounded) stacked horizontally
- Remove the `space-y-3 pt-2` list section entirely from the "View All" overlay
- Inline scroll cards: bump width from `w-44` to `w-52`, keep `grid-cols-3`

