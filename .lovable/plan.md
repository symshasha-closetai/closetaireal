

# Plan: Fix Today's Look Persistence & Streak

## Problem Identified

The DB has only one `daily_looks` entry from March 19 — nothing recent. The upload to R2 succeeds (200 response in logs), but the Supabase upsert at line 253-258 silently fails — `console.error` on line 259 doesn't surface the error to the user, and the code continues to show "Looking great!" toast even when data isn't saved.

Two root causes:
1. **Silent upsert failure**: If the upsert fails (e.g., publicUrl issue, RLS timing), the error is only `console.error`'d — user sees success but nothing persists. The cache also gets set with the failed data, masking the issue on next load.
2. **Cache masking DB failures**: localStorage cache is set (line 263-264) even when the DB write fails. On next app open, the cache shows the photo, so the user thinks it saved. But on cache expiry or new device, data is gone.

## Changes

### File: `src/pages/HomeScreen.tsx`
- **Throw on upsert failure**: If the upsert returns an error, throw it so the catch block shows "Failed to upload photo" toast and does NOT set the cache.
- **Move cache writes after DB success**: Only set localStorage cache after confirming the upsert succeeded (no error).
- **Add detailed error logging**: Log the full upsert error object and the publicUrl being used, so failures are diagnosable.
- **Fix streak consistency**: When loading from DB on mount, if today's entry doesn't exist but yesterday's does, carry forward the streak value correctly. Currently this works, but the cache can override it incorrectly if a previous failed upload cached a stale streak.

### Specific code changes:
```
// Line 259: Change from console.error to throw
if (upsertError) throw new Error(`DB save failed: ${upsertError.message}`);
```

This single change ensures:
- Failed saves show the error toast instead of success
- Cache is never written for failed saves
- The user knows when their photo didn't persist

