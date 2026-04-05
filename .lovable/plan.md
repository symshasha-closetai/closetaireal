

## Plan: Replace Lovable Gateway with Direct Replicate Mistral 7B for Savage Mode Captions

### What Changes

The current Call 2 (caption generation) uses the Lovable AI Gateway with `google/gemini-2.5-flash`. You want to replace this with a direct call to **Replicate's Mistral 7B** using your existing `REPLICATE_API_KEY` — no Lovable gateway involved. The scores (drip, color, layering, confidence) get passed as inputs, and the Savage Mode badge (🔥) appears on the share card.

### Architecture

```text
CURRENT:
  Call 1 (Gemini, scoring) → Call 2 (Lovable Gateway, gemini-2.5-flash) → caption

NEW:
  Call 1 (Gemini, scoring) → Call 2 (Replicate, Mistral 7B direct) → caption
  Share card: adds 🔥 Savage Mode badge when mode=savage
```

### File Changes

#### 1. `supabase/functions/rate-outfit/index.ts`

**Replace `generateCaption()` function** — remove the Lovable Gateway fetch, replace with a direct Replicate API call to `mistralai/mistral-7b-instruct-v0.3`:

- Use `REPLICATE_API_KEY` (already configured as a secret)
- Replicate prediction API: `POST https://api.replicate.com/v1/models/mistralai/mistral-7b-instruct-v0.3/predictions`
- Pass the savage persona system prompt + user message containing: `drip_score`, `color_score`, `layering_score`, `confidence_rating`, `outfit_description`, gender, scene, mode
- Poll for completion (Replicate is async — poll `GET /predictions/{id}` until `status=succeeded`)
- Parse the output text for `killer_tag` and `praise_line` (JSON extraction from free text)
- Keep the same retry + fallback logic (2 attempts, then minimal fallback captions)

**Replace `generateRoastCaption()` function** — same change, direct Replicate call instead of Lovable Gateway.

**Key payload:**
```typescript
const input = {
  prompt: `<s>[INST] ${systemPrompt}\n\nOutfit: ${outfitDescription}\nDrip Score: ${dripScore}/10\nColor Score: ${colorScore}/10\nLayering Score: ${layeringScore}/10\nConfidence: ${confidenceRating}/10\nGender: ${gender}\nScene: ${sceneType}\nMode: ${mode}\n\nReturn JSON: {"killer_tag":"...","praise_line":"..."} [/INST]`,
  max_tokens: 150,
  temperature: 0.9
};
```

#### 2. `src/components/OutfitRatingCard.tsx`

**Add `isSavage` prop** to `Props` type (boolean).

**Share card (`captureCard`)**: When `isSavage` is true, draw a small "🔥 SAVAGE MODE" badge in the top-right corner of the generated 9:16 PNG — gold text on a dark semi-transparent pill.

**Results UI**: Show a small 🔥 badge next to the killer tag when savage mode is active.

#### 3. `src/pages/CameraScreen.tsx`

**Pass `isSavage` prop** to `OutfitRatingCard` — `isSavage={globalDripState.unfiltered}`.

### Technical Notes

- Replicate's API is async (returns a prediction ID, must poll for result). The function will poll with 1s intervals, max 30s timeout.
- Mistral 7B is fast on Replicate (~2-4s for short prompts), so polling should complete quickly.
- The prompt uses Mistral's `[INST]` format for instruction following.
- No Lovable gateway involved anywhere — pure direct Replicate API.
- `REPLICATE_API_KEY` is already in the project secrets.

