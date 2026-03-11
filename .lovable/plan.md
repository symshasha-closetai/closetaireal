

## Current State

**Style Me**: Calls `style-me` edge function requesting 2-3 outfits. Returns `{name, top_id, bottom_id, shoes_id, accessories, score, explanation}`. The explanation is a single paragraph shown as plain text.

**Surprise Me**: Same function with `surpriseMe: true`. Shows identical result format. No avatar-wearing-clothes visualization beyond the optional "Generate try-on preview" button.

**Results sheet** (lines 478-534): Shows outfit name, score, item thumbnails, and a single `explanation` string. No structured breakdown by season/mood/time/color/body/skin.

## Plan

### 1. Update `style-me` edge function to return up to 5 outfits with structured reasoning

Change the system prompt to request 3-5 outfits (instead of 2-3) and return a structured `reasoning` object alongside the explanation:

```json
{
  "outfits": [{
    "name": "...",
    "top_id": "...", "bottom_id": "...", "shoes_id": "...", "accessories": [],
    "score": 8,
    "explanation": "...",
    "reasoning": {
      "season": "Summer — lightweight breathable fabrics",
      "mood": "Relaxed yet put-together",
      "time_of_day": "Day — lighter tones for daytime",
      "color_combination": "Navy anchors the coral top — complementary pairing",
      "body_type": "Athletic build — slim fit highlights shoulders",
      "skin_tone": "Medium warm — earthy tones complement warm undertones"
    }
  }]
}
```

Update the prompt's JSON schema and change "2-3" to "3-5" in both the system prompt and user prompt.

### 2. Update `OutfitSuggestion` type in HomeScreen

Add `reasoning` field to the type definition.

### 3. Enhance results sheet UI with structured reasoning cards

Below each outfit's explanation, render a grid of reasoning tags/cards:
- Season (leaf icon)
- Mood (smile icon)  
- Time of Day (sun/moon icon)
- Color Combination (palette icon)
- Body Type (user icon)
- Skin Tone (droplet icon)

Each shown as a small labeled card with icon + short text from the reasoning object.

### 4. Surprise Me: auto-trigger try-on for first outfit

Currently Style Me auto-triggers `generateTryOn` for the first outfit but Surprise Me does not. Add the same logic to `handleSurpriseMe` so the avatar-wearing-clothes image generates automatically.

### Files to modify
- `supabase/functions/style-me/index.ts` — prompt changes (2-3 → 3-5, add reasoning schema)
- `src/pages/HomeScreen.tsx` — type update, reasoning UI, Surprise Me try-on trigger

