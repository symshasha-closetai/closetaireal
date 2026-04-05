## Multiple Fixes: Gold CTA, White Card Text, Unique User ID, Groups, Duplicate Friend Requests

### 1. Gold "Create My Account" button (`SignUpPromptDialog.tsx`)

- Change the CTA button from default primary to gold accent: `className="w-full rounded-xl h-11 font-medium gradient-accent text-accent-foreground"`
- The app's gold is `--accent: 42 45% 52%` and `gradient-accent` is already defined

### 2. White text on shared card (`OutfitRatingCard.tsx` — `captureCard`)

- User said "white rgb #000" — likely means white text (`#FFFFFF`) on the dark card. The current card text uses varying opacities of white. Will ensure all text labels (killer tag, praise line, sub-scores, CTA) use full white `#FFFFFF` or near-white instead of muted colors
- "BEAT MY DRIP" CTA text on the canvas card: change from `rgba(201,169,110,0.5)` to gold `#C9A96E` at full opacity for the "gold standard" look, as used in the whole app

### 3. Unique user_id enforcement

- `user_id` in profiles already references `auth.users(id)` which is inherently unique. Username uniqueness is already enforced via `profiles_username_unique` index. No changes needed here — this is already handled.

### 4. Prevent duplicate friend requests (`AddFriendDialog.tsx`)

- Currently checks `existingFriendIds` for accepted friends only, but doesn't check pending requests
- Add a check: before searching, also fetch all pending friend requests sent by the user (`friends` table where `user_id = me` and `status = 'pending'`)
- Track `pendingIds` state alongside `existingFriendIds`
- In the search results, if a user has a pending request, show "Sent" label (like the "Added" label) instead of the add button
- Also add a DB-level unique constraint migration for `(LEAST(user_id, friend_id), GREATEST(user_id, friend_id))` to prevent bidirectional duplicates

### 5. Group messaging (`MessagesScreen.tsx`, DB migration)

- **DB**: Add `name` and `is_group` columns to `conversations` table
- **New Conversation dialog**: Add a "Create Group" option that lets user select multiple friends, enter a group name, and creates a conversation with multiple participants
- **MessagesScreen**: Show group name and multi-avatar for group conversations
- **Challenge (SendToFriendPicker)**: Add groups to the friend picker list, allowing challenges to be sent to groups

### Files to edit

- `src/components/SignUpPromptDialog.tsx` — gold CTA button
- `src/components/OutfitRatingCard.tsx` — white text + gold CTA on canvas card
- `src/components/AddFriendDialog.tsx` — pending request tracking, "Sent" state
- `src/pages/MessagesScreen.tsx` — group creation flow
- `src/components/SendToFriendPicker.tsx` — include groups in challenge picker
- **DB migration**: Add `name`/`is_group` to conversations, add bidirectional unique constraint on friends

### Technical details

- The bidirectional friend uniqueness constraint: `CREATE UNIQUE INDEX friends_pair_unique ON friends (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));` — prevents A→B and B→A duplicates
- Group conversations reuse existing `conversation_participants` table (multiple rows per conversation)
- The `find_or_create_conversation` RPC is for 1:1 only; groups will use direct insert into `conversations` + `conversation_participants`
- Canvas card text changes are purely in the `captureCard` callback — all `ctx.fillStyle` values for text will become `#FFFFFF` with appropriate opacity, and the "BEAT MY DRIP" line becomes `#C9A96E` at full opacity