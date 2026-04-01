# Plan: Fix Messaging, Leaderboard, Share-to-Friend & Share Card Glow

## Root Cause Analysis

**Messaging always fails**: The `create_conversation_with_participants` RPC exists in the DB and looks correct. However, the client code in `MessagesScreen` and `SendToFriendPicker` does complex multi-query conversation-finding logic before calling the RPC. Any failure in those intermediate queries (which query `conversation_participants` under RLS) can cause the whole flow to fail silently. There are 0 conversations and 0 messages in the entire database, confirming the RPC has never succeeded from the client. The fix is to create a single atomic `find_or_create_conversation` RPC that handles everything server-side, and simplify client code to just call that.

**Leaderboard empty despite drip check**: The last `drip_history` entry is March 26. The user did a drip check today but `saveDripToHistory` silently swallows DB insert errors (`catch` block just logs to console). The result is saved to localStorage but never reaches the DB. The leaderboard queries the DB, so it shows empty. Fix: add proper error handling to `saveDripToHistory` and force-refresh the leaderboard after a drip check.

**Send drip to friend fails**: Uses the same broken conversation creation logic as messaging.

**Share card glow**: Canvas drawing needs gradient/glow effects around score numbers.

## Changes

### 1. New Atomic RPC: `find_or_create_conversation`

**Migration**: Replace the existing `create_conversation_with_participants` with a smarter `find_or_create_conversation(friend_id uuid)` function (SECURITY DEFINER) that:

1. Finds existing 1:1 conversation between the two users (via a JOIN on `conversation_participants`)
2. If found, returns that conversation ID
3. If not found, creates conversation + both participants atomically, returns new ID

This eliminates all fragile client-side multi-query logic.

### 2. Simplify MessagesScreen

**File**: `src/pages/MessagesScreen.tsx`

Replace the entire `handleStartChat` function body with a single RPC call:

```typescript
const { data: convoId, error } = await supabase.rpc("find_or_create_conversation", { friend_id: friendId });
if (error || !convoId) { toast.error("Failed to start conversation"); return; }
navigate(`/chat/${convoId}`);
```

### 3. Simplify SendToFriendPicker

**File**: `src/components/SendToFriendPicker.tsx`

Replace the conversation-finding + creation logic with the same single RPC call, then insert the message.

### 4. Fix saveDripToHistory (Leaderboard Fix)

**File**: `src/pages/CameraScreen.tsx`

In `saveDripToHistory`, the DB insert failure is silently caught. Change to:

- Show a toast warning when DB insert fails: `toast.error("Score saved locally but failed to sync"), and add to db in the background using localstorage`
- Log the full error
- This ensures the user knows their score didn't reach the leaderboard

Also: After a successful drip check, invalidate the leaderboard cache (`dailyCache = null`) so the leaderboard re-fetches when the user switches to that tab.

### 5. Share Card Glow Effect

**File**: `src/components/OutfitRatingCard.tsx`

In `captureCard`, add:

- Gold radial gradient glow behind the drip score number (`ctx.shadowColor = "rgba(201,169,110,0.6)"`, `ctx.shadowBlur = 20`)
- Silver glow behind confidence score
- Subtle glow behind sub-score numbers
- Reset `ctx.shadowBlur = 0` after each glow draw to prevent bleeding

## Technical Details

- The `find_or_create_conversation` RPC uses `SECURITY DEFINER` to bypass RLS, and a subquery joining `conversation_participants` twice (once for each user) with a `HAVING count(*) = 2` check to find existing 1:1 convos.
- The leaderboard cache invalidation uses the existing module-level `dailyCache` variable, setting it to `null` after `saveDripToHistory` succeeds.
- Canvas glow uses `ctx.shadowColor` + `ctx.shadowBlur` which is well-supported and creates a natural glow effect around text.

## Files to Create/Edit

1. **Migration** — new `find_or_create_conversation` RPC function
2. `**src/pages/MessagesScreen.tsx**` — simplify handleStartChat
3. `**src/components/SendToFriendPicker.tsx**` — simplify handleSend
4. `**src/pages/CameraScreen.tsx**` — fix saveDripToHistory error handling + cache invalidation
5. `**src/components/OutfitRatingCard.tsx**` — add glow effects to share card canvas