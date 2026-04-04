

## Fix Notification Button + Message Badge + Push Notifications

### Problems

1. **Notification bell badge includes unread messages** — the `totalBadge` combines friend requests + unread message count. Messages should only show on the message button.
2. **Message button has no badge** — unread count is tracked inside `NotificationDropdown` but never exposed to the message button in `AppHeader`.
3. **Unread messages show inside the notification dropdown** — they shouldn't; notifications = friend requests/accepts only.
4. **Badge doesn't vanish on view** — opening the dropdown doesn't mark notifications as "seen."
5. **No push notifications received** — the `push_subscriptions` table is empty. Users haven't been prompted to enable push. The toggle exists only buried in profile settings. Need to prompt users to enable push after sign-up or on first app load.

### Implementation

**1. Remove message count from NotificationDropdown (`src/components/NotificationDropdown.tsx`)**

- Remove `fetchUnreadMessages`, `unreadMsgCount` state, the realtime `messages` channel subscription, and the unread messages UI row
- Change `totalBadge` to only count `friend_request` notifications
- Add a `seen` state — when dropdown opens, mark all current notifications as "seen" so badge clears. Store seen IDs in a `useRef` set (session-only, no DB needed)

**2. Add unread badge to message button (`src/components/AppHeader.tsx`)**

- Add `unreadMsgCount` state and fetch logic (moved from NotificationDropdown)
- Add realtime subscription for new messages
- Show badge on the message button (MessageCircle icon)
- Clear the badge when user navigates to `/messages` (use a simple approach: reset count when navigating)

**3. Auto-prompt push notification permission (`src/hooks/useAuth.tsx` or `src/components/AppHeader.tsx`)**

- After first successful login, if `Notification.permission === "default"`, show a one-time in-app prompt (not the browser prompt directly) asking "Enable notifications to stay in the loop?"
- On accept, call `subscribeToPush(userId)` which triggers the browser permission prompt and saves to `push_subscriptions`
- Store a flag in localStorage so the prompt only shows once per device

### Files to edit
- `src/components/NotificationDropdown.tsx` — remove message tracking, add seen-on-open behavior
- `src/components/AppHeader.tsx` — add unread message badge to message button, add push prompt logic

