

## Plan

### Overview
Four changes: (1) Save Outfit button on Style Me detail view, (2) Save suggestions from Drip Check, (3) New "Saved" sections in Profile History tab, (4) Progress bar during Drip Check analysis.

### 1. Database: New tables for saved outfits & suggestions

**Migration SQL:**
```sql
-- Saved outfit combinations from Style Me
CREATE TABLE public.saved_outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  occasion text,
  score numeric,
  explanation text,
  items jsonb NOT NULL DEFAULT '[]',
  tryon_image text,
  score_breakdown jsonb,
  reasoning jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own saved outfits" ON public.saved_outfits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own saved outfits" ON public.saved_outfits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved outfits" ON public.saved_outfits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Saved suggestions from Drip Check
CREATE TABLE public.saved_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image text,
  drip_score numeric,
  killer_tag text,
  suggestion_type text NOT NULL DEFAULT 'wardrobe',
  item_name text NOT NULL,
  category text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own saved suggestions" ON public.saved_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own saved suggestions" ON public.saved_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved suggestions" ON public.saved_suggestions FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

### 2. HomeScreen.tsx — Save Outfit button

In the outfit detail view (lines 775-793), add a "Save Outfit" heart/bookmark button:
- Add `savedOutfitIds` state to track which outfits are already saved
- Add `handleSaveOutfit(outfit)` that inserts into `saved_outfits` with the outfit name, score, explanation, item IDs (as JSON), tryon_image, score_breakdown, reasoning
- Show a filled heart icon if already saved, outline if not
- Place button next to "Generate Try-On Preview" or in the action buttons area
- Toast on save success

### 3. CameraScreen.tsx / OutfitRatingCard.tsx — Save suggestions from Drip Check

In `OutfitRatingCard.tsx`, after the wardrobe/shopping suggestions sections:
- Add a "Save to Favorites" heart button on each suggestion card (both wardrobe and shopping)
- On click, insert into `saved_suggestions` table with the suggestion details and the drip score context
- Track saved state per suggestion index

### 4. ProfileScreen.tsx — New History sections

In the History tab (lines 476-537), add two new sections:
- **Saved Outfits**: Fetch from `saved_outfits`, display as cards with outfit name, score, occasion, and delete button
- **Saved Suggestions**: Fetch from `saved_suggestions`, display grouped by drip check, with item name, category, and reason

### 5. CameraScreen.tsx — Progress bar during analysis

Replace the current analyzing overlay's spinner with an animated progress bar:
- Add `analysisProgress` state (0-100)
- Simulate progress: 0→30 on start, 30→60 when wardrobe fetched, 60→90 on API call, 90→100 on response
- Use the existing `<Progress>` component below the sparkles animation
- Show stage text below: "Fetching wardrobe...", "Analyzing your style...", "Almost done..."

### Files to Change
| File | Change |
|------|--------|
| Database migration | Create `saved_outfits` and `saved_suggestions` tables with RLS |
| `src/pages/HomeScreen.tsx` | Add Save Outfit button + handler in detail view |
| `src/components/OutfitRatingCard.tsx` | Add save/favorite buttons on suggestions |
| `src/pages/ProfileScreen.tsx` | Add Saved Outfits + Saved Suggestions sections in History tab |
| `src/pages/CameraScreen.tsx` | Add progress bar during drip analysis |

