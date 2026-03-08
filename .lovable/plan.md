

# Plan: Multi-Provider Architecture — R2 Storage, Gemini Analysis, OpenAI Styling

## Overview

Migrate from all-Lovable-AI-gateway to a split architecture:
- **Gemini Flash** (via Google AI API) → clothing analysis, body profile analysis
- **OpenAI GPT-4o mini** → style-me suggestions, outfit rating/scoring
- **Cloudflare R2** → all image storage (replace Supabase Storage)
- **Supabase** → database only (keep as-is)

## Prerequisites (User Action Required)

User needs to provide 5 secrets:
1. `GOOGLE_AI_API_KEY` — from Google AI Studio
2. `OPENAI_API_KEY` — from OpenAI platform
3. `R2_ACCOUNT_ID` — Cloudflare account ID
4. `R2_ACCESS_KEY_ID` — R2 API token access key
5. `R2_SECRET_ACCESS_KEY` — R2 API token secret
6. `R2_BUCKET_NAME` — e.g. `closetai-images`

## Changes

### 1. New Edge Function: `supabase/functions/r2-upload/index.ts`
- Accepts file (base64) + path, uploads to R2 via S3-compatible API
- Returns public URL
- Used by all other functions and client code that currently upload to Supabase Storage

### 2. Update Analysis Functions (Gemini Flash direct)
**Files:** `analyze-clothing/index.ts`, `analyze-body-profile/index.ts`
- Replace Lovable AI gateway URL with `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Use `GOOGLE_AI_API_KEY` instead of `LOVABLE_API_KEY`
- Keep same prompts and tool schemas

### 3. Update Styling Functions (OpenAI GPT-4o mini)
**Files:** `style-me/index.ts`, `rate-outfit/index.ts`
- Replace Lovable AI gateway with `https://api.openai.com/v1/chat/completions`
- Use `OPENAI_API_KEY`, model: `gpt-4o-mini`
- Keep same prompts and tool schemas (OpenAI-native format, no changes needed)

### 4. Update Image Generation Functions
**Files:** `generate-clothing-image/index.ts`, `generate-model-avatar/index.ts`, `generate-option-images/index.ts`, `generate-suggestion-image/index.ts`
- These use Gemini image models — switch to Google AI direct API
- Upload generated images to R2 instead of Supabase Storage

### 5. Update Client-Side Storage References
**Files:** `WardrobeScreen.tsx`, `OnboardingScreen.tsx`, `StyleProfileEditor.tsx`, `CameraScreen.tsx`
- Replace `supabase.storage.from('wardrobe').upload(...)` with calls to `r2-upload` edge function
- Replace `supabase.storage.from('wardrobe').getPublicUrl(...)` with R2 public URLs

### 6. Keep Supabase For
- Database (all tables unchanged)
- Authentication (unchanged)
- Edge function hosting (unchanged)

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/r2-upload/index.ts` | **New**: R2 upload helper |
| `supabase/functions/analyze-clothing/index.ts` | Gemini direct API |
| `supabase/functions/analyze-body-profile/index.ts` | Gemini direct API |
| `supabase/functions/style-me/index.ts` | OpenAI GPT-4o mini |
| `supabase/functions/rate-outfit/index.ts` | OpenAI GPT-4o mini |
| `supabase/functions/generate-clothing-image/index.ts` | Gemini direct + R2 upload |
| `supabase/functions/generate-model-avatar/index.ts` | Gemini direct + R2 upload |
| `supabase/functions/generate-option-images/index.ts` | Gemini direct + R2 upload |
| `supabase/functions/generate-suggestion-image/index.ts` | Gemini direct + R2 upload |
| `src/pages/WardrobeScreen.tsx` | R2 upload via edge function |
| `src/pages/OnboardingScreen.tsx` | R2 upload via edge function |
| `src/components/StyleProfileEditor.tsx` | R2 upload via edge function |

## Implementation Order

1. Add all secrets (user provides credentials)
2. Create R2 upload edge function
3. Migrate analysis functions to Gemini direct
4. Migrate styling functions to OpenAI
5. Migrate image gen functions to Gemini direct + R2
6. Update client-side to use R2 uploads

