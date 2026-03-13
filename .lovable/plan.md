## Plan: Home Photo Card, Bigger Selectors, Account-Bound History, Model Rerouting

### 1. User Photo Card on Home Page (above "My Wardrobe")

**File: `src/pages/HomeScreen.tsx**`

- Add a "Today's Look" card above the wardrobe section
- Shows user's uploaded photo ( new upload)
- User can tap to upload/change their photo 
- Display a daily "killer tag" generated from their style profile/wardrobe data (computed locally, rotates daily using date seed — no AI call needed to save credits)
- If no photo set, show a placeholder with "Add your photo" CTA and when clicked opens camera

### 2. Bigger Time of Day & Weather Selector Boxes

**File: `src/pages/HomeScreen.tsx**`

- Change Time of Day from small pills (`px-3 py-1.5 rounded-full text-[11px]`) to card-style boxes matching Occasion selectors (`flex-col items-center gap-1.5 px-3 py-2 rounded-xl`)
- Change Weather from small pills to same card-style boxes with emoji + label stacked vertically
- Both sections get consistent sizing with the occasion grid

### 3. History Bound to Accounts (not localStorage)

**New DB migration:** Create `drip_history` table:

```sql
CREATE TABLE public.drip_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text,
  score numeric NOT NULL,
  killer_tag text,
  praise_line text,
  full_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drip_history ENABLE ROW LEVEL SECURITY;
-- RLS policies for user's own data (SELECT, INSERT, DELETE)
```

**Files: `src/pages/CameraScreen.tsx`, `src/pages/ProfileScreen.tsx**`

- `saveDripToHistory`: Upload the drip image to Supabase storage, insert row into `drip_history` table (keep localStorage as fast cache, sync from DB)
- `getDripHistory` in ProfileScreen: Fetch from `drip_history` table instead of localStorage
- Remove localStorage-only dependency for history; use DB as source of truth

### 4. Model Rerouting Strategy (save credits)

All edge functions currently call Google's Gemini API directly. Reroute models by task complexity:


| Task                      | Function               | Current Model         | New Primary                                    | Fallback (on 429) |
| ------------------------- | ---------------------- | --------------------- | ---------------------------------------------- | ----------------- |
| Drip score/captions       | `rate-outfit`          | gemini-2.5-flash-lite | gemini-2.5-flash-lite ✓                        | gemma-3-4b-it     |
| Style suggestions         | `style-me`             | gemini-2.5-flash      | **gemini-2.5-flash-lite** (text-only, cheaper) | gemma-3-4b-it     |
| Photo analysis (wardrobe) | `analyze-clothing`     | gemini-2.5-flash      | **gemini-2.0-flash** (vision, reliable)        | gemini-2.5-flash  |
| Body/face analysis        | `analyze-body-profile` | gemini-2.5-flash      | **gemini-2.0-flash** (vision)                  | gemini-2.5-flash  |


**Implementation in each edge function:**

- Add a `callWithFallback(models[], apiKey, body)` helper that tries primary model first, on 429/5xx retries with next model
- Keep the same Google API direct calls (no gateway switch needed)

### Files Modified

- `src/pages/HomeScreen.tsx` — photo card + bigger selectors
- `src/pages/CameraScreen.tsx` — save drip history to DB
- `src/pages/ProfileScreen.tsx` — load history from DB
- `supabase/functions/rate-outfit/index.ts` — add fallback model
- `supabase/functions/style-me/index.ts` — downgrade to flash-lite + fallback
- `supabase/functions/analyze-clothing/index.ts` — gemini-2.0-flash + fallback
- `supabase/functions/analyze-body-profile/index.ts` — gemini-2.0-flash + fallback
- New migration for `drip_history` table