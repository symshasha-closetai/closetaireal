## Plan: Drip Check Card Redesign

### Changes Overview

**1. Update Edge Function (`supabase/functions/rate-outfit/index.ts`)**

- Rename `overall_score` → `drip_score` (decimal like 8.5, 7.6)
- Add `confidence_rating` (decimal like 8.5, 9.2)
- Add `killer_tag` — a 1-2 word Gen Z attention-grabber (e.g. "Bombshell", "Patakha Kudi", "Aesthetic Queen", "Main Character")
- Update `praise_line` prompt to ensure proper capitalization/grammar
- Remove `overall_reason` from the JSON schema
- Update the system prompt accordingly

**2. Update Types in `CameraScreen.tsx**`

- Replace `overall_score`/`overall_reason` with `drip_score` and `confidence_rating` in the `RatingResult` type
- Add `killer_tag?: string`

**3. Redesign `OutfitRatingCard.tsx**`

- **Photo overlay**: Show `killer_tag` as a bold, eye-catching label on the photo (e.g. rotated badge or large text overlay)
- **Bottom overlay**: Replace "X/10" with "Drip Score: 8.5/10" display
- **Scores section**: Remove "Overall" ring.  keep Color/Style/Fit as sub-scores and show Drip + Confidence as hero numbers above.
  - Actually per the request: show **Drip Score** and **Confidence Rating** as the two hero metrics, keep Color/Style/Fit as clickable sub-scores, all the ratings will be clickable and provide reason
- **Clickable hint**: Add a small "tap for details" text or a pulsing dot/info icon near the score rings so users know they're interactive
- **Share content**: Build a share image/text that includes:
  - Top-left: "ClosetAI" app name
  - Photo with the `killer_tag` overlaid prominently
  - Ratings (Drip Score, Confidence)
  - The `praise_line` (one-liner)
  - Bottom: "Check your drip score (app's logo)" CTA

**4. Update `ScoreRing.tsx**`

- Support decimal scores (display "8.5" instead of just "8")

### File Changes


| File                                      | Change                                                                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/rate-outfit/index.ts` | Update JSON schema: `drip_score`, `confidence_rating`, `killer_tag`, remove `overall_score`/`overall_reason`, enforce proper grammar                                                         |
| `src/pages/CameraScreen.tsx`              | Update `RatingResult` type to match new schema                                                                                                                                               |
| `src/components/OutfitRatingCard.tsx`     | Full redesign: killer tag overlay on photo, drip score + confidence as hero numbers, "tap for details" hint on sub-scores, updated share text with app name + killer tag + praise line + CTA |
| `src/components/ScoreRing.tsx`            | Handle decimal score display                                                                                                                                                                 |


### Share Format (text)

```text
ClosetAI
🔥 [Killer Tag] 🔥
Drip: 8.5/10 | Confidence: 9.2/10
"[Praise line with proper grammar]"
Check your drip score → closetaireal.lovable.app
```