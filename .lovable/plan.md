## Plan: Leaderboard Improvements, Friend Requests, Share Fix & Messaging

This is a large set of changes across 6 areas. I recommend splitting into two phases — Phase 1 (fixes + friend requests) and Phase 2 (messaging). Here is the full plan:

---

### Phase 1: Leaderboard Fixes, Friend Requests, Share Card, Caching

#### 1. Friend Request Flow (pending/accept)

**Database migration:**

- Add `status` column already exists (default `'accepted'`). Change default to `'pending'`.
- Add RLS policy: friend can update their own incoming requests to `'accepted'`.
- Leaderboard only shows `status = 'accepted'` friends.

**New component: `FriendRequestsDialog.tsx**`

- Bell/notification icon in top-right of leaderboard header (replaces or sits beside Add Friend)
- Shows pending incoming requests with Accept/Decline buttons
- Badge count on the bell icon for pending requests

**Update `AddFriendDialog.tsx`:**

- Insert with `status: 'pending'` instead of `'accepted'`
- Toast says "Request sent!" instead of "Friend added!"

#### 2. Share Card Fix

- Pre-load the image using `new Image()` before calling `html2canvas`
- Add the "Drop My Drip ✨" CTA to the share card
- Show: logo, photo, score, rank tag,  CTA

#### 3. Leaderboard Caching

- Store fetched leaderboard data + timestamp in component state/ref
- On re-render, use cached data if < 2 minutes old
- Only re-fetch when tab is activated AND cache is stale or when a new drip check is completed

#### 4. Top 3 Cards Redesign

- Layout: 3 columns — 2nd place (left, medium), 1st place (center, tallest), 3rd place (right, smallest)
- 1st card: taller aspect ratio (~3/5), ring highlight, golden burning border
- 2nd card: slightly shorter (~3/4.5)  , silver border
- 3rd card: shortest (~3/4) bronze border
- Each card overlay (bottom-left): avatar + name, then rank tag (e.g. "Drip God 👑") in larger text, then score below
- Remove "🏆 Top 10" badge from cards
- Keep rank number badge (1/2/3) at top-left

#### 5. "You are #X" Fixed Bottom

- Change from `sticky bottom-20` to `fixed bottom-20` with proper z-index
- Always visible when scrolling

---

### Phase 2: Messaging System

**Database:**

- Create `conversations` table (id, created_at)
- Create `conversation_participants` table (conversation_id, user_id)
- Create `messages` table (id, conversation_id, sender_id, content, content_type enum [text, image, drip_card, wardrobe_item], metadata jsonb, created_at, kept boolean default false, expires_at timestamp)
- RLS: participants can read/write messages in their conversations
- Enable realtime on `messages` table

**New route: `/messages**`

- Replace Profile icon at top right with MessageCircle icon
  &nbsp;

**New pages/components:**

- `MessagesScreen.tsx` — conversation list, sorted by last message
- `ChatScreen.tsx` — individual chat view with message bubbles
- Share buttons throughout app (drip cards, wardrobe items) that open a "Send to friend" picker

**Message features:**

- Text messages + shareable cards (drip check, wardrobe items)
- 7-day expiry: messages auto-expire unless "kept"
- First-time conversation shows banner: "Messages are kept for 7 days unless saved"
- Long-press on message → "Keep" option (sets `kept = true`, removes expiry)
- Client-side cache: store messages in localStorage with 7-day TTL
- Cleanup: edge function or DB trigger to delete expired messages

&nbsp;

---

### Files to Create

- `src/components/FriendRequestsDialog.tsx`
- `src/pages/MessagesScreen.tsx`  
- `src/pages/ChatScreen.tsx`
- `src/components/MessageBubble.tsx`
- `src/components/SendToFriendPicker.tsx`

### Files to Modify

- `src/components/LeaderboardTab.tsx` (cards redesign, caching, notification icon, fixed rank bar)
- `src/components/AddFriendDialog.tsx` (pending status)
- `src/components/BottomNav.tsx` (messages tab replacing profile)
- `src/pages/CameraScreen.tsx` (minor routing)
- `src/App.tsx` (add messages route)

### Database Migrations

1. Update `friends` default status to `'pending'`, add update RLS policy
2. Create `conversations`, `conversation_participants`, `messages` tables with RLS + realtime

### Technical Notes

- Share card image preloading: `await new Promise(resolve => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = resolve; img.src = entry.image_url; })`
- Message expiry cleanup via a scheduled edge function or `expires_at < now()` filter in queries
- Long-press detection: `onTouchStart`/`onTouchEnd` with 500ms timer