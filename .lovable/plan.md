

## Plan: Bell Badge for Unread Messages, Fix Score Consistency, Update Bonus Values

### 1. Bell Badge Shows Unread Messages (Not Friend Requests)

**In `AppHeader.tsx`:**
- Change bell button to count unread messages instead of pending friend requests
- Query `messages` table for messages where `sender_id != user.id` and the message is in user's conversations, checking for messages newer than last read
- Since we use Realtime Presence for read receipts (ephemeral), simplify: count messages in user's conversations from the last 24h that aren't from the user (basic unread indicator)
- Subscribe to realtime `messages` inserts to update count live
- Remove `setShowRequests` from bell — bell navigates to `/messages` or shows a count only
- Friend requests stay only under the `+` menu (already there)

### 2. Fix Score Inconsistency

**Root cause in `LeaderboardTab.tsx`:** `fetchFriendBonuses` only queries `user_id` (the request sender), so only the sender gets the friend-add bonus. The receiver never gets it.

**Fix:** Query both `user_id` and `friend_id` columns from the `friends` table for the relevant date, and award the bonus to BOTH parties in the friendship.

```
// Count friend additions where user is either sender OR receiver
const { data: friendsToday } = await supabase
  .from("friends")
  .select("user_id, friend_id, created_at")
  .gte("created_at", ...)
  .or(`user_id.in.(${ids}),friend_id.in.(${ids})`)
```
Then award bonus to both `user_id` and `friend_id` for each row.

Same fix applied to the weekly `weekFriends` query.

### 3. Change Bonus Values

- Friend add bonus: **+20 → +10**
- Streak bonus: **+10 → +5**
- Update the Lightbulb popover text to match

### Files to Modify
- `src/components/AppHeader.tsx` — bell shows unread messages, remove friend request badge
- `src/components/LeaderboardTab.tsx` — fix bilateral friend bonus, change values to +10/+5, update popover text

