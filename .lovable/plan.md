# Plan: Three Improvements

## 1. Forgot Password on Sign In Page

**What**: Add a "Forgot password?" link below the password field on the auth screen. When clicked, show an inline email input + submit button that calls `supabase.auth.resetPasswordForEmail()`. Also create a new `/reset-password` route with a form to set the new password via `supabase.auth.updateUser()`.

**Files to change**:

- `src/pages/AuthScreen.tsx` -- Add "Forgot password?" toggle, email input, and reset request logic
- `src/pages/ResetPasswordScreen.tsx` -- New page: detect `type=recovery` from URL hash, show new password form, call `updateUser`
- `src/App.tsx` -- Add `/reset-password` route (public, not behind ProtectedRoute)



## 2. Stop Outfit Calendar Auto-Regenerating

**What**: The calendar auto-generates when `items.length < 3`, which triggers every app open if the user has fewer than 3 upcoming days. Fix by adding a cooldown check (e.g., don't regenerate if last generation was within 24 hours) using localStorage.

**File to change**:

- `src/pages/HomeScreen.tsx` -- Before calling `generateCalendarOutfits()`, check a localStorage timestamp. After successful generation, store the timestamp. Skip regeneration if within 24 hours.

## 3. Aggressive Device Caching

**What**: Cache more data in localStorage so the app loads instantly. Currently wardrobe and leaderboard are cached. Add caching for: outfit calendar, style profile, profile data, drip history, saved outfits, and saved suggestions.

**Files to change**:

- `src/lib/deviceCache.ts` -- Add new cache keys: `CALENDAR`, `STYLE_PROFILE`, `PROFILE`
- `src/pages/HomeScreen.tsx` -- Cache/restore calendar outfits, style profile, today's look data
- `src/hooks/useAuth.tsx` -- Cache profile and style profile data on fetch, restore from cache on mount for instant display
- `src/pages/ProfileScreen.tsx` -- Cache/restore drip history, saved outfits, saved suggestions from device cache

## Technical Details

- **Reset password flow**: Uses Supabase's built-in `resetPasswordForEmail` with `redirectTo: window.location.origin + '/reset-password'`. The reset page parses the URL hash for `type=recovery` to confirm the session before showing the password form.
- **Calendar cooldown**: Store `dripd-calendar-last-gen-{userId}` timestamp in localStorage. Only auto-generate if >24h since last generation.
- **Cache strategy**: All caches use existing `getCache`/`setCache` with 48h TTL. Profile/style profile use shorter reads but same pattern. On mount, read cache first (instant UI), then fetch from DB in background and update both state and cache.