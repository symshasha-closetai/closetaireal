

## Plan: Migrate Camera Functions to Lovable AI Gateway

### Current State
5 edge functions call the Google Gemini API directly using `GOOGLE_AI_API_KEY` (with multi-key rotation). This causes 429 rate limits and inconsistent response times.

### What Changes

**Camera section functions → Lovable AI Gateway** (uses `LOVABLE_API_KEY`, already configured):

| Function | Purpose | Current | New |
|---|---|---|---|
| `rate-outfit` | Drip Check scoring | Direct Gemini API (4-key rotation) | Lovable AI (`google/gemini-2.5-flash`) |
| `analyze-clothing` | Detect items from photo | Direct Gemini API | Lovable AI (`google/gemini-2.5-flash`) |
| `generate-suggestions` | Outfit suggestions from photo | Direct Gemini API | Lovable AI (`google/gemini-2.5-flash`) |

**Also migrating** (these use the same Gemini pattern):

| Function | Purpose |
|---|---|
| `analyze-body-profile` | Onboarding body/face analysis |
| `style-me` | Home screen outfit generation |

**Staying on Replicate** (image generation, unchanged):
- `generate-clothing-image`, `generate-model-avatar`, `generate-suggestion-image`, `generate-option-images`, `virtual-tryon`

### How It Works

Each function switches from the native Gemini API to the OpenAI-compatible Lovable AI Gateway:

```text
Before: fetch("generativelanguage.googleapis.com/...?key=GOOGLE_AI_API_KEY")
After:  fetch("ai.gateway.lovable.dev/v1/chat/completions", { Authorization: Bearer LOVABLE_API_KEY })
```

For vision (image analysis), the message format changes to:
```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    { "role": "user", "content": [
      { "type": "text", "text": "..." },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
    ]}
  ]
}
```

### Benefits
- No more 429 rate limits from personal API keys
- No multi-key rotation complexity needed
- Managed infrastructure = more consistent response times
- `LOVABLE_API_KEY` is auto-provisioned, no manual key management
- Proper 429/402 error handling surfaced to user

### Technical Details per Function

1. **rate-outfit**: Remove all fallback arrays/functions, remove multi-key rotation loop. Single call to gateway. Parse `choices[0].message.content` instead of `candidates[0].content.parts[0].text`. Handle 429/402 errors with user-facing messages.

2. **analyze-clothing**: Replace `callWithFallback()` with single gateway call. Same prompt, different API format.

3. **generate-suggestions**: Same migration pattern. Image + text prompt via multimodal message.

4. **analyze-body-profile**: Same pattern. Supports multiple images (face + body) in one message.

5. **style-me**: Text-only (no image). Simplest migration — just messages array with system + user prompts.

### Files Modified
- `supabase/functions/rate-outfit/index.ts`
- `supabase/functions/analyze-clothing/index.ts`
- `supabase/functions/generate-suggestions/index.ts`
- `supabase/functions/analyze-body-profile/index.ts`
- `supabase/functions/style-me/index.ts`

