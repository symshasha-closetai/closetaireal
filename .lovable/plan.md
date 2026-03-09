

## Plan: Graceful AI Error Handling + Replicate for Model Avatar Generation

### Summary

Two changes: (1) Add graceful error handling across all AI image features so 402/429 errors never cause blank screens, and (2) switch `generate-model-avatar` and `virtual-tryon` to use Replicate AI for realistic model/avatar generation while keeping everything else on Gemini.

### Prerequisites

Replicate requires an API key. I'll use the secrets tool to request a `REPLICATE_API_KEY` from you before implementing the Replicate-powered functions.

---

### Changes

#### 1. Graceful Error Handling (client-side)

**`src/components/StyleProfileEditor.tsx`** and **`src/pages/OnboardingScreen.tsx`**
- In `useOptionImage` hook: catch 402/429 errors from `generate-option-images` and silently return `null` (no image) instead of showing blank/broken state. The UI already handles `null` — it just shows the emoji/text label without a thumbnail.

**`src/pages/HomeScreen.tsx`**
- In `generateTryOn`: show a toast on 402/429 instead of silently failing.

**`src/pages/WardrobeScreen.tsx`**
- In clothing image generation: show toast on 402/429, continue without generated image.

#### 2. Replicate AI for Model Avatar Generation

**New edge function: `supabase/functions/generate-model-avatar-replicate/index.ts`**
- Uses Replicate's FLUX or SDXL model via their HTTP API (`https://api.replicate.com/v1/predictions`)
- Accepts same inputs as current `generate-model-avatar` (modelDescription, userId, facePhotoUrl, bodyPhotoUrl)
- Uploads result to `wardrobe` storage, updates `style_profiles.model_image_url`
- Handles Replicate's async prediction pattern (poll for completion)

**Update `supabase/functions/generate-model-avatar/index.ts`**
- Replace Lovable AI Gateway call with Replicate API call using `REPLICATE_API_KEY`
- Keep same interface so no client changes needed

**Update `supabase/functions/virtual-tryon/index.ts`**
- Replace Lovable AI Gateway call with Replicate API for outfit try-on image editing
- Keep same interface

**Update `supabase/config.toml`**
- Add entries for all edge functions that are currently missing (`generate-model-avatar`, `virtual-tryon`, `generate-option-images`, `generate-suggestion-image`, `rate-outfit`, `analyze-body-profile`, `style-me`) with `verify_jwt = false`

#### 3. Files Summary

| File | Change |
|------|--------|
| `src/components/StyleProfileEditor.tsx` | Silent fallback on 402/429 in useOptionImage |
| `src/pages/OnboardingScreen.tsx` | Silent fallback on 402/429 in useOptionImage |
| `src/pages/HomeScreen.tsx` | Toast on try-on 402/429 errors |
| `supabase/functions/generate-model-avatar/index.ts` | Switch to Replicate API |
| `supabase/functions/virtual-tryon/index.ts` | Switch to Replicate API |
| `supabase/config.toml` | Register all edge functions |

### Secret Required

Before implementation, I'll need you to provide a **Replicate API key** (get it from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)).

