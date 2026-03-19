## Plan: Weekly Leaderboard, Points System, Header Redesign & Navigation Update

### 1. Weekly Leaderboard Tab

**In `LeaderboardTab.tsx`:**

- Add a "Daily" / "Weekly" toggle within the leaderboard view
- Weekly view calculates average of each user's daily top scores for the current week (Mon–Sun)
- Query `drip_history` for the current week, group by user+date, take max per day, then average across days
- Reuse same podium/list UI, just with averaged scores

### 2. Points/Bulb Info Button

**In `LeaderboardTab.tsx`:**

- Add a small lightbulb (`Lightbulb` icon) button in the leaderboard header
- On click, shows a tooltip/popover explaining:
  - "+20 points: Add a new friend"
  - "+10 points: Daily check-in (maintain streak)"
- Actual point system changes needed, scoring integrated into leaderboard, if a person adds a person he will get 20 point for that day, if a person maintains streak then everyday his score will increase by 10, tips addition will be strictly to the leaderboard and averaged late ron for weekly, weekly data will show previous week's scores, so it will be static for a week
- Leaderboard scores will be shown out of 100, like if somebody got 4.5 in drip check then it will be 45, i.e. multiplied by 10 and then later on additions if added or streak maintained

### 3. Navigation Restructure

`**BottomNav.tsx`:**

- Remove Messages tab from bottom nav (back to 4 tabs: Home, Camera, Wardrobe, Profile)

`**AppHeader.tsx`:**

- Replace single Profile button on right with 3 buttons:
  1. **Messages** (`MessageCircle` icon) — navigates to `/messages`
  2. **Notifications** (`Bell` icon) — notifications sent from the app
  3. **Plus menu** (`Plus` icon) — opens a dropdown/popover with:
    - "Add Friend" → opens `AddFriendDialog`
    - "Pending Requests" → opens `FriendRequestsDialog`
    - "All Friends" → opens a new friends list dialog/sheet
- Profile accessible from profile screen nav button at the bottom

### 4. New: All Friends Dialog

- Create `FriendsListDialog.tsx` — shows all accepted friends with avatar, name, username
- Option to remove friend

### Files to Modify

- `src/components/LeaderboardTab.tsx` — add Daily/Weekly toggle, bulb button
- `src/components/BottomNav.tsx` — remove Messages tab
- `src/components/AppHeader.tsx` — add Messages, Bell, Plus buttons
- `src/App.tsx` — no route changes needed (messages route stays)

### Files to Create

- `src/components/FriendsListDialog.tsx` — all friends view

### No database changes needed

- Weekly averages computed client-side from existing `drip_history` data