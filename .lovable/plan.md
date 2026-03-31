# Plan: Smart Push Notification System for Dripd

## Overview

Build a Web Push notification system with behavior-triggered alerts driven by competition, streaks, social activity, and progression. The system uses the existing service worker, new database tables, and a scheduled edge function that evaluates trigger conditions per-user.

## Architecture

```text
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│  Frontend   │───▶│  push_subscriptions │   │  notification_log   │
│  (subscribe)│    │  (user_id, sub)   │   │  (user_id, type,    │
└─────────────┘    └──────────────────┘    │   sent_at, copy)    │
                                           └─────────────────────┘
                          ▲                          ▲
                          │                          │
                   ┌──────┴──────────────────────────┴──┐
                   │  Edge Function: send-notifications  │
                   │  (scheduled via pg_cron every 30m)  │
                   │                                     │
                   │  1. Evaluate triggers per user       │
                   │  2. Check cooldowns (max 3/day)      │
                   │  3. Send web-push via Web Push API   │
                   │  4. Log to notification_log          │
                   └─────────────────────────────────────┘
```

## Database Changes (2 new tables)

### `push_subscriptions`

- `id` uuid PK
- `user_id` uuid NOT NULL
- `subscription` jsonb NOT NULL (browser PushSubscription object)
- `created_at` timestamptz
- RLS: users can CRUD own rows

### `notification_log`

- `id` uuid PK
- `user_id` uuid NOT NULL
- `type` text NOT NULL (competition, progression, streak, social, viral)
- `subtype` text NOT NULL (rank_dropped, score_beaten, streak_warning, etc.)
- `title` text
- `body` text
- `sent_at` timestamptz DEFAULT now()
- RLS: users can SELECT own rows

## Frontend Changes

### 1. Push Permission & Subscription (`src/lib/pushNotifications.ts`)

- `requestPushPermission()`: calls `Notification.requestPermission()`, then `registration.pushManager.subscribe()` with VAPID public key
- `savePushSubscription(userId, subscription)`: upserts to `push_subscriptions`
- Called after login/onboarding completion

### 2. Service Worker Push Handler (`public/sw.js`)

- Add `push` event listener: parse payload, show notification with icon/badge
- Add `notificationclick` handler: open app to relevant route (leaderboard, messages, camera)

### 3. Notification Settings (`src/pages/ProfileScreen.tsx`)

- Add toggle in profile settings to enable/disable push notifications
- Toggle controls whether subscription is active

## Edge Function: `send-notifications`

Scheduled every 30 minutes via pg_cron. For each user with an active push subscription:

### Trigger Evaluation Logic

**Competition (priority 1)**

- Query `drip_history` for today: compare user's current rank vs cached previous rank in `notification_log`
- If rank dropped by 2+: send "You dropped from #X to #Y 🔥"
- If someone beat their best score today: send "Someone just scored higher than you 😳"

**Streak (priority 2)**

- Query `daily_looks`: if user has streak > 1 AND no entry for today AND current time > 6pm local: send "Your X-day streak is about to break ⚠️"

**Progression (priority 3)**

- After drip check, if score is personal best: send "New personal best! X/100 🎯"

**Social (priority 4)**

- New friend request accepted: send "X accepted your friend request 🤝"
- New friend joined (matched from contacts): send "Your friend X just joined Dripd 👀"

### Cooldown Logic

- Query `notification_log` for user in last 24h
- If count >= 3: skip all non-critical notifications
- Minimum 2h gap between notifications of same type
- Competition alerts bypass cooldown (max 1 extra)

### Time-of-Day Rules

- 7-10am: streak reminders, outfit planning nudges
- 5-8pm: leaderboard updates, progression
- 8-11pm: competition alerts (rank drops)
- Outside these windows: only critical (streak about to break)

### Personalization

- High scorers (avg > 80): more competition notifications
- Low scorers (avg < 50): encouragement ("You're improving! Up 5 points this week")
- New users (< 7 days): curiosity ("See how you rank against others 👀")

## VAPID Keys

Web Push requires a VAPID key pair. Will generate and store:

- `VAPID_PUBLIC_KEY` (hardcoded in frontend)
- `VAPID_PRIVATE_KEY` (stored as edge function secret)
- `VAPID_EMAIL` (stored as edge function secret)

The edge function uses the `web-push` npm package (available in Deno via npm specifier).

## Sample Notification Copy


| Trigger         | Title                         | Body                                                |
| --------------- | ----------------------------- | --------------------------------------------------- |
| Rank drop       | "You just got dethroned 👑"   | "You dropped from #2 to #5. Time to fight back?"    |
| Score beaten    | "Someone's coming for you 😳" | "{Name} just scored 87 — that's higher than yours"  |
| Streak warning  | "Don't lose your fire 🔥"     | "Your 5-day streak breaks at midnight. Upload now!" |
| Personal best   | "New record! 💎"              | "You just hit 91/100 — your best ever"              |
| Tier up         | "GOLD tier unlocked 🥇"       | "You've reached Gold. Only 15% of users get here"   |
| Friend accepted | "New rival added 🤝"          | "{Name} accepted — check their score"               |


## Files to Create/Edit

1. **Create** `supabase/functions/send-notifications/index.ts` — main trigger evaluation + web-push sending
2. **Create** `src/lib/pushNotifications.ts` — permission request, subscription management
3. **Edit** `public/sw.js` — add push + notificationclick handlers
4. **Edit** `src/hooks/useAuth.tsx` — trigger push subscription after auth
5. **Edit** `src/pages/ProfileScreen.tsx` — add notification toggle
6. **Migration** — create `push_subscriptions` and `notification_log` tables
7. **Cron job** — schedule edge function every 30 minutes
8. **Secrets** — add VAPID_PRIVATE_KEY, VAPID_EMAIL

## Secrets Required

Need to generate VAPID keys and add:

- `VAPID_PRIVATE_KEY` — generated once, stored as secret
- `VAPID_EMAIL` — contact email for push service (e.g. mailto:[support@dripd.app](mailto:support@dripd.app))