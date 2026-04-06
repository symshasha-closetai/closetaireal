## Plan: Praise Line Tone Update, Group Fix, Wardrobe Images, and Calendar Improvements

### 1. Update Praise Line Tone Logic

**File: `supabase/functions/rate-outfit/index.ts**`

Rewrite the CAPTION_SYSTEM prompt's STEP 3 PRAISE LINE section:

**Males (solo) — ALL tiers get funny/roasted/exaggerated praise:**

- 0-4: Sarcastic roast, funny self-aware burns
- 4.1-6: Funny exaggeration, supportive but still roasting
- 6.1-8: Exaggerated hype with comedic twist
- 8.1+: Over-the-top exaggerated praise, still funny/roasting energy

**Females (solo):**

- 0-6.9: Funny roasting (same as males below 7)
- 7+: Awesomely praised lines that make her smile instantly — "glad you came here, else I would've died seeing ugly faces" energy. Warm, empowering, makes her want to screenshot and post

**Couples/Groups/Family:** Keep existing logic (chemistry, power, etc.). Again it should be creative one which user want to share across socials.

### 2. Fix Group Creation — RLS Bypass Issue

The `create_group_conversation` function is SECURITY DEFINER, which should bypass RLS. However, the `conversations` INSERT policy has a `WITH CHECK` that checks `auth.uid() IS NOT NULL`. SECURITY DEFINER functions in Supabase may still have `auth.uid()` available from the calling context, but the issue is likely that the function owner doesn't pass the auth context properly.

**Fix: Database migration** — The conversations INSERT policy `WITH CHECK (auth.uid() IS NOT NULL)` might be interfering. Since the function is already SECURITY DEFINER (which means it runs with owner privileges), the fix is to ensure RLS doesn't block the owner. We need to either:

- Grant the function owner role bypass, OR
- More likely: check if there's a different error. Let me test by calling the function directly first.

Actually, looking more carefully: SECURITY DEFINER in Supabase runs as the `postgres` role which bypasses RLS. The real issue might be something else. I'll add a migration that drops and recreates the function with better error surfacing, and also check if `conversations` table has a `NOT NULL` constraint on `name` — it doesn't (nullable). The `is_group` has a default of `false` but we're passing `true`.

Wait — looking at the RPC call in `MessagesScreen.tsx`, the parameters are `group_name` and `member_ids`. The types.ts file defines the RPC signature. If the generated types don't include the updated function signature, the client might be sending wrong parameters.

**Fix approach:**

- Create a new migration that drops and recreates the function with explicit `RAISE NOTICE` debugging
- The function itself looks correct. The most likely issue is that the Supabase types file doesn't have the updated RPC signature, causing the client to fail silently. Since we can't edit types.ts, we need to cast the RPC call.

**File: `src/pages/MessagesScreen.tsx**` — Cast the RPC call to avoid type issues:

```typescript
const { data: convoId, error } = await (supabase.rpc as any)("create_group_conversation", {
  group_name: groupName.trim(),
  member_ids: selectedMembers,
});
```

### 3. Wardrobe Images — Use Original Photo Cutout Instead of AI Generation

**Problem:** Generating a full mannequin image via Replicate is slow/expensive and often fails. User wants to just use the person's cutout from the original uploaded photo with punchy/vivid background colors.

**Approach:** Instead of calling `generate-clothing-image` (Replicate), use the original uploaded image directly with a vibrant colored background. This is faster, cheaper, and more reliable.

**File: `src/pages/WardrobeScreen.tsx**` — In `processQueue()`:

- Skip the `generate-clothing-image` edge function call entirely
- Use the original compressed image directly
- Apply a punchy colored background via canvas manipulation: draw the image on a vibrant gradient background
- Create a simple client-side function that takes the original image blob and wraps it with a randomly selected punchy color background (hot pink, electric blue, lime green, orange, purple, etc.)
- The image stays as-is (the person/clothing cutout from the photo) but gets a vivid backdrop

**New helper function** in WardrobeScreen or a shared util:

```typescript
async function addPunchyBackground(imageBlob: Blob): Promise<Blob> {
  // Load image, draw on canvas with vibrant gradient bg
  // Colors: #FF6B6B, #4ECDC4, #45B7D1, #F7DC6F, #BB8FCE, #FF8A5C, #00D2FF
}
```

**File: `supabase/functions/generate-clothing-image/index.ts**` — No changes needed (keep for retry/manual regeneration), but the default flow won't call it.

### 4. Dripd Calendar — Show All Items + Cache Properly

**Problem A: Only 2 of 3 items shown.** In the calendar card preview (`HomeScreen.tsx` line 801-806), items are rendered via `itemImages.slice(0, 3)` which is correct. The issue is that `allWardrobeItems.find(w => w.id === id)` fails to find the 3rd item because the AI returned an item ID that doesn't match any wardrobe item (hallucinated ID).

**Fix:** Strengthen the prompt in `generate-outfit-calendar/index.ts` to be stricter about using ONLY exact IDs from the provided list. Add validation server-side to filter out invalid IDs.

**Problem B: Calendar refreshes every time.** The cache is already implemented via `deviceCache` with `CACHE_KEYS.CALENDAR`, and there's a 24-hour cooldown. But the `fetchCalendar` function always queries Supabase (line 484-504), overwriting cached data. If the DB has items but some IDs don't resolve, it looks like "refreshing."

**Fix in `HomeScreen.tsx`:** 

- When loading from cache, don't re-fetch from DB unless cache is empty or stale
- In the calendar card, show ALL matched items (remove the `slice(0, 3)` limit on the detail view)
- In the preview cards, dynamically size the grid based on item count (3, 4, or more items)

**File: `supabase/functions/generate-outfit-calendar/index.ts`:**

- Add stricter prompt: "CRITICAL: Use ONLY the exact IDs listed. Do NOT invent IDs."
- Add server-side validation: filter each outfit's items array to only include IDs that exist in the provided wardrobeItems
- Return only outfits that have at least 2 valid items after filtering

**File: `src/pages/HomeScreen.tsx`:**

- Calendar detail view (line 1031-1039): Remove `slice` limit, show all items
- Calendar preview cards (line 801-809): Show all matched items instead of capping at 3
- Improve cache-first logic: if cache exists and has ≥3 items, don't fetch from DB

### Technical Summary

**Files changed:**

1. `supabase/functions/rate-outfit/index.ts` — Update praise line tone rules
2. `src/pages/MessagesScreen.tsx` — Cast RPC call to fix type mismatch
3. `src/pages/WardrobeScreen.tsx` — Replace AI image generation with original photo + punchy background
4. `supabase/functions/generate-outfit-calendar/index.ts` — Stricter ID validation
5. `src/pages/HomeScreen.tsx` — Show all calendar items, improve caching
6. Database migration — Recreate group conversation function (if needed after RPC cast fix)