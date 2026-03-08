

# Plan: Switch to Google Gemini 1.5 Flash + Anthropic Haiku, Keep Supabase Storage

## Overview

Replace the Lovable AI Gateway calls with direct API calls:
- **Google Gemini 1.5 Flash** → clothing analysis, body profile analysis, image generation
- **Anthropic Claude Haiku** → styling suggestions (style-me), outfit rating (rate-outfit)
- **Supabase Storage** → keep as-is (no R2 migration)

## Secrets Needed

Two API keys to add:
1. `GOOGLE_AI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey)
2. `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com/)

## Changes

### 1. Analysis Functions → Google Gemini 1.5 Flash Direct API

**Files:** `analyze-clothing/index.ts`, `analyze-body-profile/index.ts`

- Replace `https://ai.gateway.lovable.dev/v1/chat/completions` with `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- Use `GOOGLE_AI_API_KEY` instead of `LOVABLE_API_KEY`
- Convert OpenAI-style messages to Gemini format (contents array with parts)

### 2. Styling Functions → Anthropic Claude Haiku

**Files:** `style-me/index.ts`, `rate-outfit/index.ts`

- Replace gateway URL with `https://api.anthropic.com/v1/messages`
- Use `ANTHROPIC_API_KEY`, model: `claude-3-haiku-20240307`
- Convert from OpenAI tool calling format to Anthropic tool use format
- Add `anthropic-version: 2023-06-01` header

### 3. Image Generation Functions → Google Gemini Direct

**Files:** `generate-clothing-image/index.ts`, `generate-model-avatar/index.ts`, `generate-option-images/index.ts`, `generate-suggestion-image/index.ts`

- Switch to Google AI direct API with `GOOGLE_AI_API_KEY`
- Keep Supabase Storage uploads unchanged

### 4. No Storage Changes

All Supabase Storage code stays as-is.

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/analyze-clothing/index.ts` | Gemini 1.5 Flash direct |
| `supabase/functions/analyze-body-profile/index.ts` | Gemini 1.5 Flash direct |
| `supabase/functions/style-me/index.ts` | Anthropic Haiku |
| `supabase/functions/rate-outfit/index.ts` | Anthropic Haiku |
| `supabase/functions/generate-clothing-image/index.ts` | Gemini direct |
| `supabase/functions/generate-model-avatar/index.ts` | Gemini direct |
| `supabase/functions/generate-option-images/index.ts` | Gemini direct |
| `supabase/functions/generate-suggestion-image/index.ts` | Gemini direct |

## Implementation Order

1. Add `GOOGLE_AI_API_KEY` and `ANTHROPIC_API_KEY` secrets
2. Migrate analysis functions to Gemini 1.5 Flash
3. Migrate styling/rating functions to Anthropic Haiku
4. Migrate image generation functions to Gemini direct

