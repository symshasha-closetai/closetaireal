## Plan: Scientific Confidence Score + Text Visibility Fix

### Problems

1. **Confidence score is generic** — currently just rates the outfit, not the person's facial confidence. Should analyze facial expressions using scientific indicators (eye contact, posture, jaw tension, smile, etc.).
2. **Text not visible on photo overlay** — the killer tag, "DRIP", "CONFIDENCE" labels, and occasion badge have low opacity and no text shadow, making them hard to read against lighter image areas (visible in screenshot).

### Changes

#### 1. Update AI Prompt for Scientific Confidence Analysis (`supabase/functions/rate-outfit/index.ts`)

Update the `systemPrompt` to instruct the AI to score `confidence_rating` based on **facial expression and body language science**:

- Duchenne smile presence (genuine smile engaging orbicularis oculi)
- Eye contact directness and gaze stability
- Postural expansiveness (open vs. closed body language — Amy Cuddy's research)
- Chin/jaw position (tilted up = confidence, tucked = uncertainty)
- Shoulder positioning (relaxed, pulled back = confident)
- Hand positioning (visible, relaxed vs. hidden, fidgeting)

Add this to the prompt rules section, replacing the current generic confidence instruction. 

#### 2. Add `confidence_score` Column to `drip_history` Table

Run a migration to add a `confidence_score` numeric column to the `drip_history` table so the confidence rating is persisted separately (currently only stored inside `full_result` JSON).

#### 3. Store Confidence Score in DB (`src/pages/CameraScreen.tsx`)

When saving to `drip_history`, also save `result.confidence_rating` into the new `confidence_score` column.

#### 4. Fix Text Visibility on Photo Overlay (`src/components/OutfitRatingCard.tsx`)

In the bottom gradient overlay section (lines 345-382):

- Increase gradient darkness: `from-black/90 via-black/60` (was `/80` and `/50`)
- Add `textShadow: "0 1px 4px rgba(0,0,0,0.9)"` to killer tag, "DRIP" label, "CONFIDENCE" label, and occasion badge
- Increase text opacity: killer tag from `text-white/80` → `text-white`, labels from `text-white/50` → `text-white/70`, occasion from `text-white/60` → `text-white/80`
- Add text shadow to ScoreRing labels

#### 5. Update Fallback Confidence Reasons

Update `generateFallback()` to include scientifically-grounded confidence reasons like "Strong upright posture and relaxed shoulders project natural confidence" instead of generic text.

### Files Modified

- `supabase/functions/rate-outfit/index.ts` — updated prompt with scientific confidence criteria, updated fallback reasons
- `src/components/OutfitRatingCard.tsx` — stronger gradient, text shadows, higher opacity for all overlay text
- `src/pages/CameraScreen.tsx` — save confidence_score to new DB column
- Migration: add `confidence_score` column to `drip_history`