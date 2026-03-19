

## Plan: Persist Today's Look to Database

### Problem
Today's Look photo and streak are stored **only in localStorage** — not linked to the user's account in the database. If the user switches devices or clears browser data, they lose their daily photo and streak history.

The photo file itself is uploaded to storage (`wardrobe` bucket), but the URL reference is only saved to `localStorage`.

### Changes

**1. Create a `daily_looks` table** (migration)
```sql
CREATE TABLE public.daily_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  look_date date NOT NULL DEFAULT CURRENT_DATE,
  streak integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, look_date)
);

ALTER TABLE public.daily_looks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own looks" ON public.daily_looks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own looks" ON public.daily_looks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own looks" ON public.daily_looks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own looks" ON public.daily_looks FOR DELETE USING (auth.uid() = user_id);
```

**2. Update `HomeScreen.tsx`**
- On load: fetch today's look from `daily_looks` (where `look_date = today` and `user_id = current user`). Fall back to localStorage for offline support.
- On photo upload: insert/upsert into `daily_looks` with the image URL and calculated streak. Keep localStorage as a fast cache.
- Streak calculation: query the user's most recent `daily_looks` entries to compute the streak server-side instead of relying on localStorage alone.

### Result
- Today's Look persists across devices and browser clears
- Streak is account-linked, not browser-linked
- localStorage remains as a fast cache layer for instant UI

