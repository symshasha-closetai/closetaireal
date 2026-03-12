

## Plan: Route All AI to External APIs & Prevent Background Calls

### Summary of Changes

7 edge functions currently use Lovable AI Gateway (`ai.gateway.lovable.dev`). These need to be split into two routing strategies:

- **Text generation** (no vision): → Google Gemini API directly (`generativelanguage.googleapis.com`) using `GOOGLE_AI_API_KEY` (already configured)
- **Vision/image generation**: → Replicate API using `REPLICATE_API_KEY` (already configured)

Additionally, the `useOptionImage` hook automatically fires AI image generation in the background on mount — this needs to be disabled.

---

### Edge Functions — Routing Changes

| Function | Current | New Route | Model |
|---|---|---|---|
| `style-me` | Lovable Gateway (Gemini) | Google Gemini API direct | gemini-2.5-flash |
| `rate-outfit` | Lovable Gateway (Gemini + vision) | Replicate (vision) or Google Gemini API (supports vision) | gemini-2.5-flash |
| `analyze-clothing` | Lovable Gateway (Gemini + vision) | Google Gemini API (vision) | gemini-2.5-flash |
| `analyze-body-profile` | Lovable Gateway (Gemini + vision) | Google Gemini API (vision) | gemini-2.5-flash |
| `generate-clothing-image` | Lovable Gateway (Gemini image gen) | Replicate (FLUX) | flux-schnell |
| `generate-suggestion-image` | Lovable Gateway (Gemini image gen) | Replicate (FLUX) | flux-schnell |
| `generate-option-images` | Lovable Gateway (Gemini image gen) | Replicate (FLUX) | flux-schnell |

**Google Gemini direct API pattern:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GOOGLE_AI_API_KEY}
```
- Supports text and vision (image_url in parts)
- No streaming needed for these use cases

**Replicate pattern (already used by `generate-model-avatar` and `virtual-tryon`):**
```
POST https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions
Authorization: Bearer ${REPLICATE_API_KEY}
```
- For image generation tasks (clothing images, suggestion images, option images)
- Poll for completion using existing `waitForPrediction` pattern

---

### Prevent Background AI Calls

**`useOptionImage.ts`**: Currently auto-triggers `generate-option-images` on mount if no cached image exists. Change to:
- Still check localStorage cache and storage URL
- If not cached, return `null` image — do NOT auto-call the edge function
- Add an explicit `generate()` function returned from the hook that can be called on user action (e.g., button click)

---

### Prevent Automatic Retries

Review all `supabase.functions.invoke` call sites — none currently have retry logic, so no changes needed there. The key change is the `useOptionImage` hook which fires on mount.

---

### Files to Modify

1. **`supabase/functions/style-me/index.ts`** — Switch from Lovable Gateway to Google Gemini direct API
2. **`supabase/functions/rate-outfit/index.ts`** — Switch to Google Gemini direct API (supports vision)
3. **`supabase/functions/analyze-clothing/index.ts`** — Switch to Google Gemini direct API (vision)
4. **`supabase/functions/analyze-body-profile/index.ts`** — Switch to Google Gemini direct API (vision)
5. **`supabase/functions/generate-clothing-image/index.ts`** — Switch to Replicate FLUX
6. **`supabase/functions/generate-suggestion-image/index.ts`** — Switch to Replicate FLUX
7. **`supabase/functions/generate-option-images/index.ts`** — Switch to Replicate FLUX
8. **`src/hooks/useOptionImage.ts`** — Remove auto-generation on mount, add explicit `generate()` trigger

