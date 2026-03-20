

# Switch AI Gateway to Direct Google Gemini API

## Summary
Replace the Lovable AI Gateway (`ai.gateway.lovable.dev`) with direct Google Gemini API calls using your own API key across all 5 edge functions.

## Prerequisites
- You'll need a Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikeys)
- I'll securely store it as a backend secret called `GEMINI_API_KEY`

## Changes

### 1. Add GEMINI_API_KEY secret
Request you to input your Google Gemini API key via the secure secrets tool.

### 2. Update 5 edge functions
Each function's AI fetch call changes from:

```text
URL:  https://ai.gateway.lovable.dev/v1/chat/completions
Auth: Bearer $LOVABLE_API_KEY
Model: google/gemini-2.5-flash
```

To:

```text
URL:  https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Auth: Bearer $GEMINI_API_KEY
Model: gemini-2.5-flash
```

**Files modified:**
- `supabase/functions/rate-outfit/index.ts`
- `supabase/functions/analyze-clothing/index.ts`
- `supabase/functions/analyze-body-profile/index.ts`
- `supabase/functions/generate-suggestions/index.ts`
- `supabase/functions/style-me/index.ts`

Each file gets 3 line changes: swap `LOVABLE_API_KEY` → `GEMINI_API_KEY`, update the fetch URL, and update the model name (drop the `google/` prefix).

### 3. No frontend changes needed
All AI calls go through edge functions; the client code stays the same.

