## Revamp Killer Tag & Praise Line with DRIPD AI Prompt

### What changes

The entire AI prompt in the `rate-outfit` edge function gets replaced with your full DRIPD AI spec. The frontend gets updated to handle roast responses (no-human-detected) and display the new clean 2-3 word tags.

### Performance

Same model (`gemini-2.5-flash-lite`), same single API call, same `max_tokens: 2048`. Prompt length doesn't affect vision model latency — image processing is the bottleneck. Stays under 6 seconds.

### Implementation

**1. Rewrite `supabase/functions/rate-outfit/index.ts**`

- Replace the entire prompt string with the full DRIPD AI spec verbatim (Steps 0-6, all roast categories, all scoring rules, voice rules, final test)
- The prompt will instruct the model to return TWO possible JSON shapes:
  - Human detected: all existing score fields + new-style `killer_tag` (2-3 words, no emojis) + new-style `praise_line` (1 sentence, no period)
  - No human: `{ killer_tag: null, praise_line: null, error: "roast", roast_line: "..." }` plus zeroed scores
- Remove the old `genderInstruction` variable (gender is passed as `user_gender` in the prompt context instead)
- Keep all existing infrastructure: image fetching, base64 handling, API key selection, error handling, JSON parsing fallback

**2. Update `src/pages/CameraScreen.tsx**`

- Add `error?: string` and `roast_line?: string` to `RatingResult` type
- In `runAnalysis`, after getting `data.result`, check for `result.error === "roast"`:
  - Show the `roast_line` as a toast with a fun title like "No drip detected 😅"
  - Reset state so user can upload again (don't save to history, don't show rating card)
- Remove the massive `CLIENT_KILLER_TAGS_MALE/FEMALE/NEUTRAL` arrays and `CLIENT_PRAISE_LINES` — they're no longer needed since the AI now generates unique tags per image
- Simplify `clientFallbackResult` to use a small set of generic fallback tags (only used when AI call completely fails, not for normal flow)

**3. Update `src/components/OutfitRatingCard.tsx**`

- Display `killer_tag` as-is (raw 2-3 word text, emoji stripping or additions)
- No structural UI changes needed — just ensure it renders the cleaner tag format properly

### Files

- `supabase/functions/rate-outfit/index.ts` — full prompt rewrite
- `src/pages/CameraScreen.tsx` — roast handling + type update + remove old tag arrays
- `src/components/OutfitRatingCard.tsx` — minor display cleanup