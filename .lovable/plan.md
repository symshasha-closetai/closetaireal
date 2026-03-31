# Plan: Fix Sharing, Leaderboard, Upload, Cropper, Privacy Line, Notification Preferences

## Issues Identified

1. **Sharing fails / shares without photo**: The `captureCard` function fetches the R2 image via `fetch(image)` which fails CORS on some browsers. The Today's Look share also has the same issue. When `fetch` throws, the catch shows "Couldn't share" — and in some cases the share API is invoked with a text-only share (no file) as a fallback that wasn't implemented properly.
2. **Leaderboard empty**: The daily query filters by `today` using UTC (`new Date().toISOString().split("T")[0]`). If the user is in IST (UTC+5:30), a drip check done at e.g. 11pm IST = 5:30pm UTC same day works fine, but the date mismatch means the leaderboard may show "today" as a different calendar day than the user's local day. More importantly — **there are simply no drip_history entries for today** (latest is March 26). The user likely did a drip check but the result may not have been saved, or the leaderboard isn't refreshing.
3. **Today's look not uploading**: Only 1 entry exists in `daily_looks` (March 19). The upsert now throws on error (from previous fix), so the user should see "Failed to upload photo" toast. If they don't see it, the upload might be failing at the R2 stage or the cropper isn't producing a blob. Need to add more granular error feedback.
4. **Cropper is basic**: Current cropper uses `react-easy-crop` which already supports pinch-to-zoom natively, but the UI is basic — slider-based zoom with small buttons. Need to modernize with a cleaner, more mobile-native design.
5. **Privacy line**: Line at Profile > Personal tab says "Your drip check photos & outfit ratings are stored locally on your device only. They are never uploaded to our servers." — this is **false** (data IS stored in Supabase). Remove it.
  &nbsp;

---

## Changes

### 1. Fix Sharing (OutfitRatingCard + HomeScreen)

**Files**: `src/components/OutfitRatingCard.tsx`, `src/pages/HomeScreen.tsx`

- In `captureCard()`: wrap the `fetch(image)` in a try-catch. If CORS fails, fallback to loading image via `<img>` element with `crossOrigin="anonymous"` and drawing from that. If that also fails, create a canvas with just the scores panel (no photo) so sharing still works.
- In `handleShareTodayLook()`: same fix — add CORS fallback for the R2 image fetch.
- Ensure the `navigator.share` call properly catches `AbortError` (user cancelled) vs real errors.

### 2. Fix Leaderboard Date Filtering

**File**: `src/components/LeaderboardTab.tsx`

- Change the daily query date from UTC-based to **local date**: use `new Date().toLocaleDateString('en-CA')` (returns YYYY-MM-DD in local timezone) instead of `new Date().toISOString().split("T")[0]`.
- Same fix for the streak bonus date query.
- Add a manual refresh button or auto-refresh when the tab becomes visible, so after a drip check the leaderboard updates.

### 3. Fix Today's Look Upload

**File**: `src/pages/HomeScreen.tsx`

- Add more granular error handling in `handleCroppedPhoto`: separate toast messages for R2 upload failure vs DB upsert failure.
- Add `console.error` logging for each step so failures are diagnosable.
- Ensure the `catch` block shows the specific error message.

### 4. Modernize Image Cropper

**File**: `src/components/ImageCropper.tsx`

- Redesign UI: full-screen overlay instead of dialog, dark background, minimal controls.
- `react-easy-crop` already supports pinch-to-zoom and drag — just need to expose it properly by removing the dialog wrapper constraints.
- Replace the slider with a more subtle bottom bar. Keep rotate button minimal.
- Use a floating action bar at bottom with Cancel / Use Photo buttons styled as pills.
- Remove the zoom slider labels (ZoomIn/ZoomOut icons) — pinch-to-zoom is the primary interaction on mobile.

### 5. Remove Privacy Line

**File**: `src/pages/ProfileScreen.tsx`

- Remove the entire privacy notice block (lines 853-859) that says "Your drip check photos & outfit ratings are stored locally on your device only."
  &nbsp;

## Technical Details

- The CORS sharing fix uses `createImageBitmap(blob)` from a fetch response, falling back to an `Image()` element with `crossOrigin`. The fallback handles R2's CORS configuration which may not allow `fetch` from all origins.
- The cropper redesign keeps `react-easy-crop` (which handles pinch-to-zoom natively) but changes the container from a `Dialog` to a fixed full-screen overlay for a more native feel.
- The notification preferences are stored alongside the subscription to avoid an extra table, and default to all-enabled so existing users aren't affected.
- Leaderboard date fix ensures the user's local midnight-to-midnight is used for "today", matching their expectation of what "today's" leaderboard means.