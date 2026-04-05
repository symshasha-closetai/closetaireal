

## Multiple Fixes: Emojis, Wardrobe Button, Leaderboard Tags, Share Card Branding, Image Caching, Domain

### Issues identified

1. **Killer tag + praise line need emojis** — current prompt says "No emojis" explicitly
2. **"Add items to wardrobe" is plain text** — should be a clickable button that navigates to `/wardrobe`
3. **Leaderboard images not cached** — images fetch from DB every time; need browser Cache API integration
4. **Leaderboard rank tags not hierarchical** — current tags are random vibes (Drip God, Style Titan, Fit Assassin), need a clear hierarchy from best to worst
5. **Share card uses old branding** — imports `closetai-logo.webp`, shows old logo
6. **Domain shows "DRIPD.APP"** — needs to be "DRIPD.ME" everywhere
7. **Share card from leaderboard looks bad** — the screenshots show score `/100` format, small image, old logo, no killer tag prominence

### Changes

**1. `supabase/functions/rate-outfit/index.ts`** — Add emojis to killer tag + praise line
- Call 2 prompt: Remove "No emojis" rule, add: "Include 1 relevant emoji at the end of the killer_tag" and "Can include 1-2 emojis in the praise_line where they feel natural"
- Roast Call 2: Same emoji rules

**2. `src/components/OutfitRatingCard.tsx`** — Wardrobe button + domain fix
- Line 770-774: Replace static text with a `<button>` that navigates to `/wardrobe` using `useNavigate`
- Line 421: Change `"DRIPD.APP"` to `"DRIPD.ME"`

**3. `src/components/LeaderboardTab.tsx`** — Multiple fixes
- **RANK_TAGS**: Replace with hierarchical titles:
  - 1: "Drip God 👑", 2: "Style Icon ✨", 3: "Fashion Elite 🔥", 4: "Trend Leader 💫", 5: "Vibe Master 🎯", 6: "Clean Machine ⚡", 7: "Rising Star 🌟", 8: "Style Scout 👀", 9: "Fresh Start 🌱", 10: "New Wave 🫧"
- **Logo import**: Change from `closetai-logo.webp` to `dripd-logo.webp`
- **ShareCard**: Redesign — use new Dripd logo, show killer_tag prominently, add user avatar/name, change CTA to "BEAT MY DRIP 🔥", change domain to "dripd.me"
- **Image caching**: Use the existing `cacheImage` / `getCachedImageUrl` from `src/lib/imageCache.ts` — cache leaderboard entry images on fetch, use cached URLs for display. Add `useCachedImage` pattern to podium and list items.
- **Score display**: Keep `/100` format on share card but make it more prominent

**4. `src/pages/WardrobeScreen.tsx`** — Domain fix
- Line 1444: Change `dripd.app` to `dripd.me`

**5. Copy new Dripd logo** — Copy `user-uploads://WhatsApp_Image_2026-04-05_at_9.11.17_AM.jpeg` to `src/assets/dripd-logo-new.png` for use in the leaderboard share card

### Technical details

- Image caching uses the existing `imageCache.ts` utility (Cache API) — `precacheImages()` called after leaderboard fetch, `getCachedImageUrl()` used in image `src` attributes via a small hook
- The wardrobe empty-state button uses `useNavigate()` from react-router-dom
- Share card logo will use the new uploaded Dripd logo (dark navy D on gold — will work well on the dark card background)
- Emoji in killer_tag: prompt instructs "exactly 1 emoji at the end" to keep it clean and screenshot-worthy
- All `closetai` references removed from the codebase

### Files to edit
- `supabase/functions/rate-outfit/index.ts` (emoji rules in prompts)
- `src/components/OutfitRatingCard.tsx` (wardrobe button + domain)
- `src/components/LeaderboardTab.tsx` (rank tags, logo, share card, image caching, domain)
- `src/pages/WardrobeScreen.tsx` (domain)

