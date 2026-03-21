

# Plan: Rebrand to Dripd, 48hr Caching, Leaderboard Opt-Out

## 1. Rebrand "ClosetAI" → "Dripd" everywhere

**Waiting on logo upload** — once you upload the Dripd logo, I'll replace all logo files and references.

**Text replacements across all files** (~12 files):
- `index.html`: title, meta tags, descriptions
- `src/components/SplashScreen.tsx`: logo path, alt text, heading
- `src/pages/AuthScreen.tsx`: logo path
- `src/hooks/useAuth.tsx`: welcome toast
- `src/pages/HomeScreen.tsx`: watermark text, share titles, file names
- `src/pages/WardrobeScreen.tsx`: share titles, branding text, file names
- `src/pages/ProfileScreen.tsx`: share titles, file names
- `src/components/LeaderboardTab.tsx`: logo import, branding text
- `src/components/OutfitRatingCard.tsx`: any brand mentions
- `public/sw.js`: cache names (`closetai-*` → `dripd-*`)
- `src/lib/imageCache.ts`: cache name
- localStorage keys containing "closetai" in WardrobeScreen

Logo files to replace:
- `public/closetai-logo-192.webp` → `public/dripd-logo-192.webp`
- `src/assets/closetai-logo.webp` → `src/assets/dripd-logo.webp`
- `src/assets/closetai-logo.png` → `src/assets/dripd-logo.png`

## 2. Increase all cache TTLs to 48 hours

| Location | Current TTL | New TTL |
|----------|------------|---------|
| `HomeScreen` wardrobe cache | 5 min | 48 hr |
| `HomeScreen` style profile cache | 10 min | 48 hr |
| `LeaderboardTab` daily/weekly cache | 2 min | 48 hr |
| `useOptionImage` | 7 days | keep as-is |
| `OutfitRatingCard` suggestion images | 7 days | keep as-is |
| `public/sw.js` service worker image cache | indefinite | keep as-is |

The 48hr constant: `48 * 60 * 60 * 1000` (172,800,000ms)

## 3. Leaderboard: option to remove today's entry

Add a settings/options button (e.g., three-dot menu or a subtle icon) to the leaderboard that shows two choices when tapped:

**Option 1:** "Sit This One Out" — Deletes the user's drip_history entry for today so they don't appear on today's leaderboard. Sophisticated description: "Step away from today's spotlight — your ranking won't be visible."

**Option 2:** "Revert to Previous Look" — Deletes today's drip_history and re-uses the most recent previous analysis instead. Description: "Restore your last recorded look as today's appearance."

Both options use a confirmation dialog. Implementation:
- Add a dropdown menu or bottom sheet in `LeaderboardTab.tsx` with these two options
- "Sit This One Out": `DELETE FROM drip_history WHERE user_id = X AND created_at::date = today`, then refresh leaderboard
- "Revert to Previous Look": Delete today's entry, find the most recent previous entry, insert a copy with today's date, refresh

**File:** `src/components/LeaderboardTab.tsx`

## Technical Details

- Branding: pure find-and-replace across ~12 files, plus logo file swap
- Cache: change 4 TTL constants/values to `48 * 60 * 60 * 1000`
- Leaderboard opt-out: Add `DropdownMenu` with two items, each triggers a Supabase delete + optional re-insert, then forces a cache-busted refetch

