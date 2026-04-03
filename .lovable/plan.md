
Goal: fix the real causes behind chat creation failing and notifications not enabling, instead of retrying the same client-side changes.

What I found

1. Messaging is still broken for two different reasons
- The app code is already calling `find_or_create_conversation` in both `MessagesScreen` and `SendToFriendPicker`, so the earlier client refactor did happen.
- But your preview auth/network is pointed at a mismatched backend configuration:
  - request URL goes to project `xtxwrvjdoexuymdkmzit`
  - the anon key being sent is issued for a different project ref (`upmrumzbgwordkkpgqxb`)
  - response is `401 Invalid API key`
- With that mismatch, auth can fail, RPC calls can fail, inserts can fail, and chat will look randomly broken even if the app code is correct.
- There is also a backend logic gap: `find_or_create_conversation(friend_id)` does not verify that the target user is actually an accepted friend, does not prevent self-chat, and does not guard against duplicates under race conditions.

2. “Failed to create/load conversation” likely needs better handling in ChatScreen too
- `ChatScreen` loads participants/messages assuming the conversation exists and is readable.
- There is no explicit recovery path if the conversation ID is invalid, unreadable, or the RPC/navigation returns a bad state.
- So one backend failure becomes a generic front-end dead end.

3. Push auto-enable is currently implemented in a browser-hostile way
- `useAuth.tsx` calls `subscribeToPush()` automatically during auth state change.
- `subscribeToPush()` immediately calls `Notification.requestPermission()`.
- Browsers commonly require notification permission prompts to happen from a user gesture, so auto-prompting on login is often blocked/suppressed.
- That explains:
  - new accounts not getting notifications enabled automatically
  - old accounts seeing “Could not enable notifications”

4. Push UX also needs more precise failure states
- Current code collapses several cases into one generic failure:
  - service worker not ready
  - browser blocked permission prompt
  - existing invalid subscription
  - DB write failure
  - VAPID subscribe failure
- So the user gets “Could not enable notifications” without knowing which part failed.

5. Leaderboard issue is probably separate from the chat failure
- `saveDripToHistory()` now shows errors and clears local cache key, which is better.
- But `LeaderboardTab` uses both module memory cache and device cache, so refresh behavior should be tightened further when a new drip result is saved.
- This is worth bundling into the same pass since you’ve been stuck in a loop.

Implementation plan

1. Fix the backend configuration mismatch first
- Audit the runtime auth config so the frontend URL and anon key come from the same backend project.
- Remove any stale/legacy backend credentials still being injected into preview/build.
- Verify that email/password auth, RPCs, and table queries all hit the same backend consistently.
- This is the highest-priority fix because messaging and push writes cannot be trusted until this is corrected.

2. Harden the conversation RPC in the database
- Replace `find_or_create_conversation(friend_id)` with a stricter version that:
  - rejects unauthenticated calls
  - rejects self-chat
  - verifies there is an accepted friendship between caller and target
  - returns the existing direct conversation if present
  - creates exactly one new 1:1 conversation atomically otherwise
- Add duplicate protection on `conversation_participants` logic so race conditions do not create parallel threads.
- Keep it `SECURITY DEFINER` so the client does not depend on fragile participant reads during creation.

3. Make the messaging UI resilient
- Update `MessagesScreen.tsx` to surface the actual RPC error message instead of only “Failed to start conversation”.
- Update `SendToFriendPicker.tsx` similarly so “share drip to friend” uses the same reliable path and better error reporting.
- Update `ChatScreen.tsx` to:
  - detect missing/inaccessible conversation state
  - show a recoverable error state
  - optionally retry by re-running the conversation lookup when opened from a friend action
- Result: creating a chat, opening a chat, and sharing a drip all use one consistent backend path.

4. Rework push notifications around user gesture
- Stop auto-calling `Notification.requestPermission()` inside auth state change.
- In `useAuth.tsx`, only do a silent background check:
  - if permission is already `granted`, try to ensure subscription exists
  - if permission is `default`, do not auto-prompt
- Move the actual permission prompt to explicit user actions only, such as the notification toggle.
- This matches browser rules and should make the toggle reliable.

5. Improve push subscription reliability
- Refactor `src/lib/pushNotifications.ts` into clearer steps:
  - verify browser support
  - verify service worker registration/ready state
  - inspect existing subscription
  - request permission only when user initiated
  - subscribe with the VAPID key
  - upsert subscription row safely
- Return structured failure reasons instead of only `true/false`.
- Update `ProfileScreen` toggle messaging to distinguish:
  - blocked by browser
  - permission dismissed
  - service worker unavailable
  - backend save failed

6. Tighten leaderboard refresh after drip check
- After a successful drip save, clear both:
  - device cache entry
  - in-memory leaderboard caches
- Ensure the leaderboard re-fetches immediately when opened after a new rating.
- This avoids the “I checked in today but still see nothing” loop.

Files to update
- `src/hooks/useAuth.tsx`
- `src/lib/pushNotifications.ts`
- `src/pages/ProfileScreen.tsx`
- `src/pages/MessagesScreen.tsx`
- `src/components/SendToFriendPicker.tsx`
- `src/pages/ChatScreen.tsx`
- `src/components/LeaderboardTab.tsx`
- new migration for a stricter `find_or_create_conversation` function

Technical notes
- The most important issue is not just app code; it is the backend credential mismatch shown by the 401 `Invalid API key`.
- Auto-enabling push on new accounts should mean:
  - silently subscribe only if permission is already granted
  - otherwise defer the prompt until a tap/click
- Messaging should be enforced server-side by friendship status, not by trusting client navigation or client-side filtering.
- The current notification send function also looks incomplete from a Web Push protocol perspective, but that affects delivery after subscription, not the immediate “enable notifications” failure.

Expected outcome after implementation
- New chat works from Messages “+”
- Share to friend works from drip/share flows
- Chat page opens reliably instead of failing on load
- New accounts no longer fail on an automatic blocked permission prompt
- Old accounts get a clearer reason when enabling notifications fails
- Leaderboard refreshes after a new drip check

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>
