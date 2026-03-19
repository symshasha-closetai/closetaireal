

## Plan: Leaderboard System with Friends & Username

### Overview
Add a full leaderboard system to the Camera section with friend-based scoring, usernames, rank badges, and sharing.

### Database Changes (3 migrations)

**1. Add `username` to `profiles` table**
- Add unique `username` column (text, nullable initially)
- Add unique index, constraint for format (letters, numbers, underscore, dot)

**2. Create `friends` table**
- Columns: `id`, `user_id`, `friend_id`, `created_at`, `status` (pending/accepted)
- RLS: users can manage their own friend rows

**3. Create `daily_leaderboard` view or query approach**
- Query `drip_history` for today's max score per user, joined with profiles for name/avatar/username
- Only show friends' scores

### Frontend Changes

**1. CameraScreen.tsx — Add tabs (Drip Check | Leaderboard)**
- Wrap current content in a tab system
- "Drip Check" tab = existing camera UI
- "Leaderboard" tab = new LeaderboardTab component

**2. New: `src/components/LeaderboardTab.tsx`**
- Fetches today's highest drip score per friend (+ self) from `drip_history`
- Top 3 rendered as large cards with photo, name, rank badge/tag
- Remaining users in compact list form
- Sticky bar at bottom: "You are #X"
- "Add Friend" button at top opens search dialog
- Share button per entry: shows photo, drip/confidence score, tag, CTA "Drop My Drip"
- Brand logo (ClosetAI) at top left

**3. Rank-based tags (assigned by position):**
```
#1  → Drip God 👑
#2  → Style Titan ⚡
#3  → Trend Sniper 🎯
#4  → Fit Assassin 🔪
#5  → Clean Killer 🧼
#6  → Aura Builder ✨
#7  → Street Scholar 🧠
#8  → Fit Flexer 💪
#9  → Style Rookie 🚀
#10 → Drip Starter 🔥
```
Top 10 get a "🏆 Top 10" badge. Others get no special tag.

**4. New: `src/components/AddFriendDialog.tsx`**
- Search input for username
- Queries `profiles` by username (partial match)
- Shows results with "Add" button
- Inserts into `friends` table

**5. ProfileScreen.tsx — Add username field**
- New input below name field for username
- Validates: only `[a-zA-Z0-9_.]`, no duplicates (checks DB on blur/save)
- Saves to `profiles.username`

**6. BottomNav.tsx — Show rank on Camera icon**
- Small badge number overlay on the Camera tab showing user's current rank

### Technical Details

- Leaderboard query: `SELECT DISTINCT ON (user_id) user_id, score, image_url, full_result FROM drip_history WHERE created_at::date = CURRENT_DATE ORDER BY user_id, score DESC` then join with profiles for friend filtering
- Friend filtering done client-side: fetch friend list, then fetch their scores
- Username validation: `CHECK (username ~ '^[a-zA-Z0-9_.]+$')` — actually use a trigger per guidelines
- Share uses `html2canvas` (already in project) to generate shareable card

### Files to Create/Modify
- **Create**: `src/components/LeaderboardTab.tsx`, `src/components/AddFriendDialog.tsx`
- **Modify**: `src/pages/CameraScreen.tsx` (add tabs), `src/pages/ProfileScreen.tsx` (username field), `src/components/BottomNav.tsx` (rank badge), `supabase/migrations/` (3 migrations)

