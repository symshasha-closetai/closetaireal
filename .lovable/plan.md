

# Calendar Outfit Planner

## Overview
Add a "What to Wear" calendar section below the wardrobe card on the home page. It shows daily outfit plans as scrollable cards, with a "View All" that opens a full month calendar view. Outfits are AI-generated from the user's wardrobe, considering season, skin tone, and body shape.

## 1. Database: `outfit_calendar` table

New table to store AI-generated daily outfit plans:

```sql
CREATE TABLE outfit_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  outfit_date DATE NOT NULL,
  outfit_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, outfit_date)
);
-- RLS: users can CRUD own rows
-- outfit_data shape: { name, items: [{id, image_url, type, name}], occasion, explanation }
```

## 2. Edge function: `generate-outfit-calendar`

New function that generates 7 days of outfit plans at once:
- Takes: wardrobe items, style profile (body type, skin tone, gender), current season
- Prompt: "Plan 7 casual daily outfits for the next 7 days using ONLY these wardrobe items. Each day should be different. Consider season, skin tone, body shape. Return JSON array."
- Returns: array of `{ date, name, items: [item_ids], occasion, explanation }`
- Uses `gemini-2.5-flash-lite`

## 3. HomeScreen: Calendar section (below wardrobe card)

**Inline preview (scrollable cards):**
- Header: "What to Wear" + item count badge + "View all >"
- Horizontal scroll of big cards (next 7 days)
- Each card shows: date label (Today/Tomorrow/Wed/Thu...), outfit name, 2-3 item thumbnails in a row, occasion tag
- If no plans generated yet, show a "Generate Week Plan" button

**Card click → full-screen detail overlay:**
- Shows all wardrobe items in the outfit as large images
- Outfit name, occasion, explanation text
- Same pattern as the Style Me detail view

**"View all" → month calendar overlay:**
- Full-screen overlay with a month calendar grid
- Days with planned outfits show a dot indicator
- Tapping a day opens the outfit detail card for that date
- Navigate between months with arrows

## 4. Auto-generation logic

On home page load:
1. Fetch `outfit_calendar` rows for the next 7 days
2. If fewer than 3 days have plans, auto-trigger the edge function to generate 7 days
3. Cache results in the DB table
4. User can manually regenerate with a refresh button

## Technical Details

- **Files to create:** `supabase/functions/generate-outfit-calendar/index.ts`
- **Files to modify:** `src/pages/HomeScreen.tsx` (add calendar section after wardrobe card, ~150 lines of new JSX + state/effects)
- **DB migration:** New `outfit_calendar` table with RLS policies
- **Edge function prompt:** Instructs AI to vary outfits across 7 days, avoid repeating the same top/bottom combo, and consider weather progression
- **Calendar month view:** Uses a simple CSS grid (7 columns for days), with the existing `Calendar` component pattern as reference but custom-built for outfit dots

