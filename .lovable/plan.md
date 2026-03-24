# Update Drip Score Formula, Leaderboard Visibility, and Weekly Logic

## Overview

Three changes: (1) new drip score breakdown, (2) daily leaderboard visible to all users joined as friends to that particular user, (3) weekly leaderboard = average of current week's 7 days, frozen until next week.

---

## 1. New Drip Score Formula

**Current**: Color(25%) + Style(20%) + Fit(25%) + Occasion(20%) + Accessories(10%)
**New**: Color Combination(30%) + Posture & Pose(30%) + Layering & Accessories(25%) + Face & Smile(15%)

### Files to change:

`**supabase/functions/rate-outfit/index.ts**` — Update the AI prompt:

- Change the JSON schema to return: `color_score`, `posture_score`, `layering_score`, `face_score` (with corresponding reasons)
- Remove `style_score`, `fit_score`, `occasion` field from prompt
- Update formula line: `drip_score = Color(30%) + Posture(30%) + Layering(25%) + Face(15%)`
- Remove separate `confidence_rating` — posture/pose now covers that territory (or keep confidence as a separate display metric if desired)

`**src/pages/CameraScreen.tsx**` — Update `RatingResult` type and `clientFallbackResult`:

- Replace `style_score`/`fit_score` with `posture_score`/`layering_score`/`face_score`
- Update fallback formula to match new weights

`**src/components/OutfitRatingCard.tsx**` — Update sub-score rings display:

- Show 4 sub-scores: Color (30%), Posture (30%), Layering (25%), Face (15%)
- Update share card canvas drawing to match
- Update colors for new categories

---

## 3. Weekly Leaderboard — Avg of All 7 Days, Same for the Whole Week

**Current**: Shows previous week (Mon–Sun) average, only for friends
**New**: Shows previous week (Mon–Sun) average for ALL users, static until next Monday

`**src/components/LeaderboardTab.tsx**` — `fetchWeekly`:

- Remove the `.in("user_id", relevantIds)` filter
- Keep the existing previous-week logic (already correct — Mon to Sun of last week, stays the same all current week)

---

## Technical Details

- The `drip_history` table SELECT RLS already has a `USING (true)` policy for authenticated users — no DB changes needed for visibility
- The `confidence_rating` field can be kept as a separate display metric on the card (posture/pose in the score formula is different from the confidence body-language metric)
- No database schema changes required — `full_result` jsonb stores whatever fields the AI returns