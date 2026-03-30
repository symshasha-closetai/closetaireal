

# Plan: Calendar Fix, Share/Download Fix, Delete Confirmations

## Issues Identified

1. **Calendar keeps regenerating**: The `useEffect` at line 458 has `generateCalendarOutfits` in its dependency array. Since `generateCalendarOutfits` is a `useCallback` depending on `allWardrobeItems`, it gets a new reference every time wardrobe loads (first from cache, then from DB) -- re-triggering the effect and potentially calling generate again despite the cooldown check. Fix: remove `generateCalendarOutfits` from deps, use a ref instead.

2. **Share/Download not working**: The `captureCard` function loads the outfit image with `img.crossOrigin = "anonymous"`, but R2/CDN images likely don't return proper CORS headers for canvas operations, causing a tainted canvas error silently caught. Fix: fetch the image as a blob first (like `handleShareTodayLook` already does), then use `createImageBitmap` to avoid CORS tainting.

3. **No delete confirmation**: Wardrobe delete, message delete, and permanent delete actions fire immediately without confirmation. Fix: add `AlertDialog` confirmation before all destructive actions.

## Changes

### File: `src/pages/HomeScreen.tsx`
- Replace the calendar `useEffect` dependency on `generateCalendarOutfits` with a ref-based approach. Use `useRef` to hold the generate function and call it via ref inside the effect, removing it from the dependency array. This prevents the infinite re-trigger cycle.
- Add a `hasTriggeredGenRef` to ensure generation only triggers once per mount.

### File: `src/components/OutfitRatingCard.tsx`
- Update `captureCard` to fetch the image as a blob via `fetch()` + `createImageBitmap()` instead of using `new Image()` with `crossOrigin`. This mirrors the working pattern in `handleShareTodayLook` and avoids canvas tainting.

### File: `src/pages/WardrobeScreen.tsx`
- Add `AlertDialog` confirmation before `deleteItem` (soft delete) and `permanentlyDeleteItem`.
- Add state for `pendingDeleteId` and `pendingPermanentDeleteId`.
- Show "Are you sure?" dialog with cancel/confirm actions.

### File: `src/pages/ChatScreen.tsx`
- Add `AlertDialog` confirmation before `handleDelete` for messages.
- Add state for `pendingDeleteMsgId`.

### File: `src/components/MessageBubble.tsx`
- Update the delete button's `onClick` to call `onDelete` which now triggers the confirmation in the parent (`ChatScreen`).

### File: `src/pages/ProfileScreen.tsx`
- Add `AlertDialog` confirmation before `permanentlyDeleteItem` in the history tab (deleted wardrobe items section).

## Technical Details

- **Calendar fix**: Using a `useRef` to hold the latest `generateCalendarOutfits` function avoids it being a useEffect dependency. A `hasTriggeredGenRef` boolean prevents duplicate triggers from cache-then-DB wardrobe loads.
- **Share fix**: `fetch(image).then(r => r.blob()).then(createImageBitmap)` produces an `ImageBitmap` that can be drawn to canvas without CORS restrictions, since the blob is fetched outside the canvas security model.
- **Delete confirmations**: All use the existing `AlertDialog` component from `@/components/ui/alert-dialog` (already used in LeaderboardTab). Pattern: set a pending ID in state → show dialog → on confirm execute delete → clear state.

