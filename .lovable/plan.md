

## Fix: Switch Savage Mode to Lovable AI Gateway

### Root Cause

The `gemini-1.5-pro` model is called via Google's direct API (`generativelanguage.googleapis.com`), which has strict safety filters that block the "savage/abusive" tone. The model either refuses to generate the content or returns empty/sanitized responses, wasting credits.

### Solution

Use the **Lovable AI Gateway** (`ai.gateway.lovable.dev`) for Savage Mode calls only. This gateway:
- Has `LOVABLE_API_KEY` already configured as a secret
- Supports `google/gemini-2.5-flash` which is more capable than 1.5-pro AND faster
- Has more permissive content policies for creative/comedy use cases
- Uses the same OpenAI-compatible format already in the code

### Changes — `supabase/functions/rate-outfit/index.ts`

**1. Add a second fetch helper for Lovable AI Gateway**

Create a `callLovableAI` function similar to `callGemini` but pointing to `https://ai.gateway.lovable.dev/v1/chat/completions` using `LOVABLE_API_KEY` for auth, and accepting a model parameter (default `google/gemini-2.5-flash`).

**2. Use `callLovableAI` for Savage Mode calls only**

- Roast Call 2 (line 445): when `unfiltered`, use `callLovableAI` with `google/gemini-2.5-flash` instead of `callGemini` with `gemini-1.5-pro`
- Standard Call 2 (line 489): when `unfiltered`, same switch

**3. Keep `callGemini` with `gemini-2.5-flash-lite` for all non-savage calls**

No changes to Call 1 or filtered Call 2 — those stay on the direct Google API with the lite model for speed and cost.

### Cost & Speed Impact

- `google/gemini-2.5-flash` via Lovable AI is comparable in speed to current `gemini-2.5-flash-lite`
- Much cheaper than `gemini-1.5-pro` and actually works for edgy content
- No additional secrets needed — `LOVABLE_API_KEY` already exists

### Files to edit
- `supabase/functions/rate-outfit/index.ts`

