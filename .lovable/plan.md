

## Plan: Complete Drip Check Reset — New Scoring + Sub-Scores + Share Card Overhaul

### Summary

Full reset of the drip check system. Remove Savage Mode entirely. Replace the 4 sub-scores (Color, Posture, Layering, Face) with 4 new ones: **Attractiveness, Status, Dominance, Approachability**. Use **Gemini 2.5 Flash directly** (no gateway) for both calls. Rewrite the prompt structure with the new tone tiers. Update the share card to show 75% image, "Beat me if you can" CTA, no opacity on text, and include the new sub-scores.

### Architecture

```text
Call 1: Direct Gemini API (gemini-2.5-flash, temp 0.3) → human check, scores, scene detection
Call 2: Direct Gemini API (gemini-2.5-flash, temp 0.9) → killer_tag + praise_line
```

No Lovable AI gateway. No Savage Mode. Direct Google API for both calls.

---

### File Changes

#### 1. `supabase/functions/rate-outfit/index.ts` — Full Rewrite

**Remove:**
- `callLovableAI()` function
- `DRIPD_SYSTEM_SAVAGE` and `DRIPD_SYSTEM_STANDARD` prompts
- All `unfiltered`/`mode`/`savage` references
- Old sub-scores: `color_score`, `posture_score`, `layering_score`, `face_score`

**New Call 1 prompt** (`CALL1_SYSTEM`):
- Step 0: Human check — human must occupy >40% of frame. If not, identify dominant item (food/building/animal/etc.), return `{"error":"roast","roast_category":"FOOD|FURNITURE|...","drip_score":0,...}` with all scores zeroed
- If human: detect solo/couple/group/family, gender
- New sub-scores (0-10 each): `attractiveness_score`, `status_score`, `dominance_score`, `approachability_score` — each with a 1-2 line reason
- `drip_score` = server-side weighted calculation from new sub-scores
- `confidence_rating` stays
- `outfit_description`, `face_hidden`, `scene_type`

**New Call 2 prompt** — single prompt (no savage/standard split):
- Step 0: Non-human roast categories with witty lines (e.g., food → "Empty the plate first, then click a photo of yours, I score drip not the taste")
- Step 1: Scene read (solo/couple/group/family)
- Step 2: Killer tag (2-3 words, tier-mapped)
- Step 3: Praise line with strict tier + gender + scene rules:
  - 0-4: sarcasm
  - 4.1-6: supportive but funny
  - 6.1-8: praise with "still room" in sarcastic way
  - 8.1+: boys = highly energetic/praising, girls = flirty, couples = chemistry-focused, groups = dominant/powerful (gender-aware)
- Slang and Gen-Z terms allowed
- Must be shareable — "wtf I need to show the world" energy
- Output: `{"killer_tag":"...","praise_line":"..."}` or roast JSON

**Update `generateCaption()`** — call `callGemini()` with `gemini-2.5-flash` directly (no gateway)

**Update `generateRoastCaption()`** — same, direct Gemini

**Update server handler** — remove `unfiltered` from request parsing, compute `drip_score` from new sub-scores with new weights

#### 2. `src/pages/CameraScreen.tsx`

**Remove:**
- Savage Mode toggle (Switch + label)
- `unfiltered` from `DripState`, `globalDripState`, `runAnalysis`, `saveDripToHistory`, `checkCache`
- Mode badge rendering
- All mode-aware cache logic (just cache by image hash)

**Update `RatingResult` type:**
- Remove: `color_score`, `color_reason`, `posture_score`, `posture_reason`, `layering_score`, `layering_reason`, `face_score`, `face_reason`
- Add: `attractiveness_score`, `attractiveness_reason`, `status_score`, `status_reason`, `dominance_score`, `dominance_reason`, `approachability_score`, `approachability_reason`

**Update `clientFallbackResult()`** to use new sub-score names

#### 3. `src/components/OutfitRatingCard.tsx`

**Update sub-scores display:**
- Replace Color/Posture/Layering/Face rings with Attractiveness/Status/Dominance/Approachability
- Use more sophisticated labels (e.g., keep them or rename slightly per user's request for "sophisticated words")
- Each tappable for 1-2 line reason tooltip

**Remove:**
- `isSavage` prop and savage badge
- Savage badge in share card canvas

**Update share card canvas (`captureCard`):**
- Image takes 75% of canvas height (change `IMG_H = Math.round(H * 0.75)`)
- No opacity on text — use solid white `#FFFFFF` for all text
- Include the 4 new sub-score numbers in the bottom panel
- CTA: "BEAT ME IF YOU CAN ⚔️" instead of "BEAT MY DRIP"
- Ensure no image cropping (already uses contain-fit)
- Challenge share message: "Beat me if you can ⚔️"

**Update `SendToFriendPicker` content:** "Beat me if you can ⚔️"

#### 4. `src/components/LeaderboardTab.tsx`

- Remove any `mode` filtering references if present
- Update drip history mode references

#### 5. `src/pages/ProfileScreen.tsx`

- Update history display to use new sub-score names
- Remove savage/standard mode badge from history entries

### Technical Details

**New drip_score formula:**
```
drip_score = (attractiveness * 0.30 + status * 0.25 + dominance * 0.25 + approachability * 0.20)
```

**Model:** `gemini-2.5-flash` for both calls (upgrade from `gemini-2.5-flash-lite` for Call 1 too, per user request to use "gemini 1.5pro" — closest available is `gemini-2.5-flash` which is superior)

**Sub-score label mapping for UI (sophisticated words):**
- Attractiveness → "Allure"
- Status → "Prestige" 
- Dominance → "Authority"
- Approachability → "Charisma"

