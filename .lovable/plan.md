

# Plan: Leaderboard UI Fix, Messages + Button, Chat Fix

## 1. Remove duplicate "Leaderboard" header in LeaderboardTab

The `LeaderboardTab` component renders its own "Leaderboard" header with logo (lines 402-425). Since the parent `CameraScreen` already has the "Drip Check / Leaderboard" tab switcher, this inner header is redundant.

**Change:** In `src/components/LeaderboardTab.tsx`, remove lines 402-425 (the header block with logo + "Leaderboard" text). Keep the Daily/Weekly toggle and the bulb popover, but move the bulb inline with or below the toggle.

## 2. Reposition bulb and Today/Last Week toggle

With the inner header removed, the Today/Last Week toggle moves up naturally. Place the bulb icon to the right of the toggle row (inline) so it doesn't overlap with podium cards.

**File:** `src/components/LeaderboardTab.tsx` — restructure lines 400-445 to have toggle + bulb in one row.

## 3. Add + button in MessagesScreen to start new conversations

Add a floating or header-inline "+" button that opens a friend picker dialog (reuse `SendToFriendPicker` pattern) to select a friend and create/navigate to a conversation.

**File:** `src/pages/MessagesScreen.tsx`
- Add a `+` button next to the "Messages" title
- Add state for a new `NewConversationDialog` (or inline friend picker)
- On friend selection: find or create conversation, then navigate to `/chat/${conversationId}`

## 4. Fix conversation creation (batch insert RLS issue)

The `SendToFriendPicker` inserts both participants in a single batch. RLS checks each row individually — the friend's row fails because `user_id != auth.uid()` and `is_conversation_participant` doesn't see the first row yet (same transaction).

**Fix:** In `src/components/SendToFriendPicker.tsx`, split the batch insert into two sequential inserts:
```
await supabase.from("conversation_participants").insert({ conversation_id, user_id: user.id });
await supabase.from("conversation_participants").insert({ conversation_id, user_id: friendId });
```

Apply the same fix in the new MessagesScreen friend picker.

## Technical Details

- **LeaderboardTab**: Remove ~23 lines of header JSX, merge bulb popover into the toggle row
- **MessagesScreen**: Add `Plus` icon import, friend-fetching logic (same pattern as `SendToFriendPicker`), and a dialog with friend list that creates/finds a conversation then navigates
- **SendToFriendPicker**: Change 1 batch insert to 2 sequential inserts to fix RLS

