

# Auto-Delete History Unless Kept (Heart to Keep)

## Overview
Add a "keep" system across all history sections (Drip History, Saved Outfits, Saved Suggestions). Items not marked as kept will auto-delete after 7 days. A heart icon on each item lets users keep it. A subtle notice informs users of this behavior.

## Database Changes

**Migration**: Add `kept` boolean column (default `false`) to three tables:
- `drip_history` — `ALTER TABLE drip_history ADD COLUMN kept boolean NOT NULL DEFAULT false;`
- `saved_outfits` — `ALTER TABLE saved_outfits ADD COLUMN kept boolean NOT NULL DEFAULT false;`
- `saved_suggestions` — `ALTER TABLE saved_suggestions ADD COLUMN kept boolean NOT NULL DEFAULT false;`

## Code Changes

**File: `src/pages/ProfileScreen.tsx`**

1. **Auto-delete on mount**: When syncing history, delete rows where `kept = false` AND `created_at` is older than 7 days from all three tables (similar to existing deleted wardrobe items auto-purge logic).

2. **Heart button on every history card** (all 3 sections — drip, outfits, suggestions):
   - In the horizontal scroll preview cards and the "View All" grid
   - Heart icon overlay (top-left corner): hollow = not kept, filled red = kept
   - Tapping toggles `kept` in DB via update query
   - Kept items show a filled heart; unkept items show an outline heart

3. **Info notice banner**: Add a subtle text line below each section header:
   - "Items auto-delete after 7 days — tap ♥ to keep forever"
   - Styled like the existing "Auto-deleted after 7 days" text on Deleted Items section

4. **Filter kept from auto-delete**: The existing 14-day filter on drip history fetch (`fourteenDaysAgo`) will be replaced — fetch all items, but auto-purge unkept items older than 7 days via DB delete on mount.

## Technical Notes
- Uses `UPDATE` on the three tables — `saved_outfits` and `saved_suggestions` currently lack UPDATE RLS policies, so we need to add those via migration
- The heart toggle calls: `supabase.from("drip_history").update({ kept: true/false }).eq("id", id)`
- Auto-delete on mount: `supabase.from("drip_history").delete().eq("user_id", uid).eq("kept", false).lt("created_at", sevenDaysAgoISO)`

