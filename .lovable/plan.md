# Plan: Notifications, Share Card, Leaderboard Fix, Messaging Debug

## 1. Notification Bell — Show Friend Requests + Accepted Notifications

**Current**: Bell icon only counts unread messages. Friend requests are hidden in the "+" menu.

**Change**: Bell icon opens a notification dropdown/sheet showing:

- Incoming friend requests ("X sent you a friend request" + accept/decline)
- Accepted friend notifications ("X accepted your request")
- Unread messages count

Badge count = pending friend requests + unread messages.

**Files**: `src/components/AppHeader.tsx`

- Replace Bell `onClick` navigating to `/messages` with a notification dropdown
- Subscribe to `friends` table changes (INSERT for new requests, UPDATE for accepted)
- Show friend request notifications with accept/decline inline
- Show "accepted" notifications for requests the user sent that got accepted
- Keep the MessageCircle icon for navigating to `/messages`

## 2. Revamp Share Card Design

**Current**: Share card is a programmatic canvas drawing with scores overlapping the face area (scores at bottom of image area, face in center).

**Change**: Shift the score overlay lower so the face stays visible. Redesign layout:

- Image takes full width, scores render in the bottom panel (below the image), not overlapping the photo
- Move drip score + confidence score from the image overlay to the dark bottom panel
- Increase bottom panel height from 120px to ~180px to fit scores + sub-scores + praise line
- Keep gradient overlay minimal (just a subtle fade for brand text)
- Add a more premium look with better typography spacing

**File**: `src/components/OutfitRatingCard.tsx` — update `captureCard` function

- Change `H_BOTTOM` from 120 to 180
- Move drip/confidence score rendering from `H_IMG - 20` to `H_IMG + 30`
- Move sub-scores lower accordingly
- Keep the killer tag between main scores
- Reduce the gradient overlay to only cover the brand watermark area

## 3. Fix Daily Leaderboard — Show All Users (Global)

**Current**: `fetchDaily` filters drip_history by `relevantIds` (user + accepted friends), so if no friends did a drip check, leaderboard is empty.

**Change**: Remove the `.in("user_id", relevantIds)` filter from the daily query. Fetch ALL drip_history for today globally (the RLS policy already allows `SELECT` for all authenticated users). Still compute bonuses for the displayed users.

**File**: `src/components/LeaderboardTab.tsx`

- In `fetchDaily`: remove `.in("user_id", relevantIds)` from the drip_history query
- After getting results, compute bonuses for the returned user IDs
- Keep friend-highlight styling for entries that are friends

## 4. Fix Weekly Leaderboard — Raw Scores Only, No Bonuses

**Current**: Weekly includes friend/streak bonuses computed per-day, which differ per viewer and change over time.

**Change**: Weekly should show pure average of raw `score * 10` values from Monday-Sunday of the previous week. No bonuses. This ensures all users see the same scores.

**File**: `src/components/LeaderboardTab.tsx`

- In `fetchWeekly`: remove the friend/streak bonus calculation entirely
- Simply compute average of `(score * 10)` per user per day, then average across days
- Remove the queries for `weekFriends` and `weekLooks`

## 5. Fix Messaging — Debug & Ensure Conversations Work

**Current**: Conversations, participants, and messages tables are all empty despite friends existing. Either no one has tried messaging yet, or the conversation creation is failing silently.

**Change**: Add error handling + toast feedback in `MessagesScreen.tsx` for conversation creation. The code looks correct structurally (sequential inserts for RLS), so the issue may be that users haven't tried it yet. Add better error logging to surface any RLS failures.

**File**: `src/pages/MessagesScreen.tsx`

- Add `.select()` and error checking after each `conversation_participants` insert
- Add `console.error` for debugging if inserts fail
- Show specific error toast with the failure reason

## Technical Details

- **Notifications**: Subscribe to `postgres_changes` on `friends` table for INSERT (new request) and UPDATE (accepted) events. Store notifications in local state with timestamps.
- **Share card**: All changes are in the canvas drawing code. The `H_IMG` stays at 520px for the photo, `H_BOTTOM` increases to 180px. Scores move entirely into the dark panel below.
- **Leaderboard daily**: The `drip_history` RLS has `USING (true)` for authenticated SELECT, so removing the `in()` filter will return all users' entries globally.
- **Leaderboard weekly**: Removing bonuses makes the weekly static and consistent across all viewers. The raw `score` field is 0-10, multiplied by 10 for display (0-100 scale).