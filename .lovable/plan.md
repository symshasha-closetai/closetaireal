# Plan: Loading Skeletons, Navigation Fixes, Conversation Bug, Notifications Auto-Enable, Share Card Revamp

## Issues Identified

1. **No loading skeleton**: Pages show blank white or a spinner. Need proper skeleton screens.
2. **Back button goes to wrong page**: `navigate(-1)` pops browser history, which can go to camera or exit app. Should navigate to a known parent route.
3. **App opens on Home, not Camera**: Default route is `/`, user wants Camera as landing page.
4. **Conversations always fail**: The `conversations` INSERT uses `.insert({}).select("id").single()` — the SELECT policy requires `is_conversation_participant(auth.uid(), id)`, but no participant exists yet at SELECT time. The `.select()` after `.insert()` runs under the SELECT RLS policy, which fails. Fix: use `.insert({}).select("id").single()` with a modified RLS policy, or split into two queries (insert without select, then get the id differently). Best fix: add a RETURNING-friendly SELECT policy or use a DB function.
5. **Notification toggle fails**: The error "Could not enable notifications. Check browser permissions." appears because `subscribeToPush` calls `pushManager.subscribe()` which requires a valid VAPID key AND a properly registered service worker. The VAPID key may be invalid (randomly generated). Also, notifications should auto-enable on first login, not require manual toggle.
6. **Share card layout broken**: Font spacing issues, "DRIPD" too far, scores overlapping (4.5 above /10), text separation. Need complete revamp with proper text measurement. Also change aspect ratio to 9:16 (1080x1920) for Instagram/WhatsApp stories.

---

## Changes

### 1. Loading Skeleton Component + Integration

**Create** `src/components/PageSkeleton.tsx`

- Reusable skeleton screen with shimmer animations matching the app's warm cream/gold theme
- Variants for Home, Camera, Wardrobe, Profile, Messages screens
- Use the existing `Skeleton` component from `src/components/ui/skeleton.tsx`

**Edit** `src/App.tsx`

- Replace `<div className="min-h-screen bg-background" />` Suspense fallback with `<PageSkeleton />`
- Replace the blank loading state in `ProtectedRoute` with skeleton

### 2. Fix Back Button Navigation

**Edit** `src/pages/ProfileScreen.tsx` — change `navigate(-1)` to `navigate("/")`
**Edit** `src/pages/MessagesScreen.tsx` — change `navigate(-1)` to `navigate("/")`
**Edit** `src/pages/ChatScreen.tsx` — change `navigate(-1)` to `navigate("/messages")`

### 3. Default Route to Camera

**Edit** `src/App.tsx`

- Change default route from `<HomeScreen />` at `/` to redirect to `/camera`
- OR swap: make `/camera` the index route and `/home` for Home
- Simpler approach: keep routes as-is but change `ProtectedRoute` to redirect to `/camera` on first load.
  &nbsp;

### 4. Fix Conversation Creation (RLS Bug)

**Database migration**: The problem is that after inserting into `conversations`, the `.select("id")` fails because the SELECT RLS policy checks `is_conversation_participant` but no participants exist yet.

Fix options:

- **Option A (best)**: Create a `create_conversation` DB function (SECURITY DEFINER) that creates the conversation + adds both participants atomically, returns the conversation ID.
- **Option B**: Modify the SELECT policy on `conversations` to also allow selecting rows the user just created (add `OR auth.uid() = created_by` — but table has no `created_by` column).

Going with **Option A**: Create a `create_conversation_with_participants(friend_id uuid)` function that:

1. Inserts into `conversations`, gets the id
2. Inserts self as participant
3. Inserts friend as participant
4. Returns the conversation id

**Edit** `src/pages/MessagesScreen.tsx` — call the RPC function instead of manual inserts
**Edit** `src/components/SendToFriendPicker.tsx` — same fix for conversation creation there

### 5. Fix Notification Auto-Enable

**Edit** `src/lib/pushNotifications.ts`

- The `subscribeToPush` function is correct in structure. The issue is likely that the service worker isn't registering the push manager properly, or the VAPID key format is wrong. Add better error logging.
- Auto-subscribe: after successful login/onboarding, automatically call `subscribeToPush` silently. If browser blocks, just skip — no error toast.

**Edit** `src/hooks/useAuth.tsx`

- After auth state confirms logged-in user, attempt `subscribeToPush` silently (no toast on failure — user can enable later)

**Edit** `src/pages/ProfileScreen.tsx` — `NotificationToggle` should also check the browser's `Notification.permission` state and show appropriate messaging

### 6. Revamp Share Card (OutfitRatingCard `captureCard`)

**Edit** `src/components/OutfitRatingCard.tsx`

Complete rewrite of the `captureCard` canvas drawing:

- **Aspect ratio**: Change from 390x710 (roughly 4:5) to **1080x1920** (9:16 story format) for Instagram/WhatsApp/Snapchat
- **Layout**: 
  - Photo fills top ~70% with gradient overlay
  - "DRIPD" watermark: top-left, letter-spacing 3px, closer to edge (16px margin)
  - Drip Score: large left-aligned with "/10" properly positioned using `measureText` to prevent overlap
  - Confidence: right-aligned, same treatment
  - Killer tag: centered between scores
  - Sub-scores: evenly spaced with proper column width calculation
  - Praise line: word-wrapped with proper line height
  - "Beat My Drip" CTA at bottom center
- **Font rendering**: Use consistent font stack, proper `textBaseline = "alphabetic"`, and `measureText` for all positioning
- **Score text**: Render score number and "/10" as separate draws with explicit x-offset from `measureText` — prevents the overlap where "4.5" runs into "/10"

Also fix `handleShareTodayLook` in HomeScreen with same 9:16 ratio.

---

## Technical Details

- The conversation RLS fix is the most critical — it's a fundamental blocker preventing any messaging.
- The skeleton uses `animate-pulse` with `bg-muted` matching the app's warm theme.
- Share card at 1080x1920 produces crisp images on all social platforms (Instagram stories, WhatsApp status, Snapchat).
- The canvas uses 2x scaling (`canvas.width = W * 2`, `ctx.scale(2, 2)`) for Retina sharpness.
- Auto-subscribing to push uses `Notification.permission === "default"` check — only prompts if user hasn't decided yet. If already "denied", skips silently.