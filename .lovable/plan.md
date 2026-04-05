

## Fix: Score-Creative Sync + Server-Side Drip Score Calculation

### Root Causes

1. **Drip score is wrong (2.5)** — The AI calculates `drip_score` itself in Call 1, but it miscalculates. Looking at the screenshot sub-scores: color=3, posture=7.5, layering=1, face=8 → the correct formula gives `3×0.3 + 7.5×0.3 + 1×0.25 + 8×0.15 = 4.6`, NOT 2.5. The AI is bad at math. **Fix: compute drip_score server-side** from the sub-scores after Call 1 returns, overriding whatever the AI says.

2. **Killer tag and praise line don't match the score** — "CLASSIC VIBES ✨" and a praising line for a 2.5 score is wrong. The Call 2 prompt has score-tier mappings but the AI ignores them. The prompt needs a harder gate: repeat the score tier in all-caps before the generation instruction, and add a "TONE MUST match score" enforcement with negative examples.

3. **Toggle label** — Code already says "Savage Mode 😏" (line 453). The screenshot may be from before the last deploy.

### Changes

**1. `supabase/functions/rate-outfit/index.ts`** — Server-side drip_score calculation

After Call 1 returns, recalculate `drip_score` from the sub-scores using the exact weighted formula, overriding the AI's value:

```typescript
// Override AI's drip_score with correct calculation
const calculatedDrip = Math.round(
  ((call1Result.color_score || 0) * 0.3 +
   (call1Result.posture_score || 0) * 0.3 +
   (call1Result.layering_score || 0) * 0.25 +
   (call1Result.face_score || 0) * 0.15) * 10
) / 10;
call1Result.drip_score = calculatedDrip;
```

This ensures the drip score always matches the sub-scores. Apply this right after line 304 (after Call 1 result is logged), before the roast gate check.

**2. `supabase/functions/rate-outfit/index.ts`** — Enforce score-tone sync in Call 2 prompts

In both `getCall2System` and `getCall2SystemUnfiltered`, add a hard enforcement block at the top:

```
CRITICAL TONE GATE:
The drip_score is ${dripScore.toFixed(1)} which falls in the "${tierLabel}" tier.
Your killer_tag and praise_line MUST match this tier's energy.
- Score < 4 = the outfit is NOT good. Tag and line must be gently critical or self-aware. NEVER praise or hype.
- Score 4-6.9 = decent but not amazing. Tag and line should be chill, not over-the-top.
- Score 7-8.4 = genuinely good. Confident praise is appropriate.
- Score ≥ 8.5 = exceptional. Full hype is appropriate.
DO NOT praise a low score. DO NOT roast a high score. The tone MUST sync with the number.
```

Add a helper to compute the tier label string from the score.

**3. Same file** — Update Call 1 prompt to NOT compute drip_score

Remove the formula instruction from `CALL1_SYSTEM` since we compute it server-side. Change:
```
- drip_score = color_score*0.3 + posture_score*0.3 + layering_score*0.25 + face_score*0.15
```
to:
```
- drip_score: will be calculated server-side, just return 0 for this field
```

This prevents the AI from spending tokens on math it gets wrong.

### Files to edit
- `supabase/functions/rate-outfit/index.ts` (server-side score calc + tone enforcement in both Call 2 prompts + simplify Call 1)

### Technical details
- The weighted formula: `color×0.3 + posture×0.3 + layering×0.25 + face×0.15`, rounded to 1 decimal
- Tier labels: "needs work" (<4), "decent" (4-6.9), "fire" (7-8.4), "elite" (≥8.5)
- Server-side calc is placed before the roast gate so the gate also uses the correct score

