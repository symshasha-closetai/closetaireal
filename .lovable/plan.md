

## Plan: Chat Enhancements, Share Buttons, Leaderboard Polish

### 1. Typing Indicators & Read Receipts (Realtime Presence)

**In `ChatScreen.tsx`:**
- Use Supabase Realtime **Presence** on the chat channel to track typing state
- When user types, call `channel.track({ typing: true, user_id })` with debounce; clear after 2s idle
- Listen to presence sync to show "typing..." indicator below messages
- Read receipts: when user views messages, update presence with `{ last_read: latest_message_id }`; show double-check mark on sender's messages that have been read

### 2. Back Button in Messages Screen

**In `MessagesScreen.tsx`:**
- Add an `ArrowLeft` back button in the header that calls `navigate(-1)` to go to the previous page
- In `ChatScreen.tsx`, change the back button from hardcoded `/messages` to `navigate(-1)`

### 3. SendToFriendPicker in OutfitRatingCard & WardrobeScreen

**In `OutfitRatingCard.tsx`:**
- Add a "Send" button (e.g. `Send` icon) next to the existing Share/Download buttons
- On click, open `SendToFriendPicker` with `contentType="drip_card"` and metadata containing `image_url`, `score`, `killer_tag`

**In `WardrobeScreen.tsx`:**
- Add a "Send" button on each wardrobe card (or in the item detail view)
- On click, open `SendToFriendPicker` with `contentType="wardrobe_item"` and metadata containing `image_url`, `name`, `type`

### 4. Remove Rank Badge from Camera Nav

**In `BottomNav.tsx`:**
- Remove the rank number badge from the Camera icon entirely
- Remove the rank-fetching `useEffect` and related state
- Show rank change via a toast notification only (optional, simple approach: skip for now)

### 5. Leaderboard Card Border Redesign

**In `LeaderboardTab.tsx`:**
- Remove the rank number circle (`{rank}` badge) from top-left of podium cards
- 1st place: animated golden/flame gradient border using CSS (e.g. `bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500` as a wrapper with padding, creating a gradient border effect)
- 2nd place: silver gradient border (`from-gray-300 via-gray-400 to-gray-300`)
- 3rd place: bronze gradient border (`from-amber-600 via-amber-500 to-amber-700`)
- Add click handler on cards to open a full-screen modal/sheet showing the entry's image, score, rank tag, and details

### 6. Full-Screen Card View on Click

**In `LeaderboardTab.tsx`:**
- Add state for `selectedEntry` and a modal/sheet
- On card click, set `selectedEntry` and show a full-screen overlay with the user's photo, name, rank tag, score, and share button

### Files to Modify
- `src/pages/ChatScreen.tsx` — typing indicators, read receipts, back button fix
- `src/pages/MessagesScreen.tsx` — add back button
- `src/components/OutfitRatingCard.tsx` — add SendToFriendPicker button
- `src/pages/WardrobeScreen.tsx` — add SendToFriendPicker button
- `src/components/BottomNav.tsx` — remove rank badge
- `src/components/LeaderboardTab.tsx` — remove rank numbers, gradient borders, full-screen card view

### No database changes needed
- Presence is ephemeral (no tables), read receipts tracked via presence state

