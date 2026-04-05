

## Plan: Replace Mistral 7B with Gemini 2.5 Flash for Caption Generation

### Problem

Mistral 7B (7 billion parameters) is too weak to follow the complex caption instructions. It ignores scene type (couple/group), gender tone, score tier, and mode (savage vs standard). Result: generic solo-focused captions like "Classic Comfort 😎" even for a couple photo in savage mode.

### Fix

Replace the Replicate Mistral 7B call with a direct Gemini 2.5 Flash call using your existing Google AI API keys. You already have `callGemini()` and 4 API keys configured — zero new dependencies.

### Why This Works

- Gemini 2.5 Flash is ~100x more capable than Mistral 7B at instruction following
- Already integrated — `callGemini()` function exists, just call it with `gemini-2.5-flash` model
- No Replicate polling delay (saves 2-4s per request)
- No Lovable gateway — direct Google API like Call 1
- Same API keys, same auth, same error handling

### File Changes

**`supabase/functions/rate-outfit/index.ts`**

1. **Delete**: `callReplicateMistral()`, `waitForReplicatePrediction()`, `extractJsonFromText()` — all Replicate-specific code

2. **Rewrite `generateCaption()`**: Instead of building a `[INST]` prompt and calling Replicate, use `callGemini()` with model `gemini-2.5-flash`:
   - System message: the existing `CAPTION_SYSTEM_STANDARD` or `CAPTION_SYSTEM_SAVAGE` (already well-written)
   - User message: outfit description, all 4 scores, gender, scene type, mode
   - Temperature 0.9 for creativity, max_tokens 150
   - Parse JSON from response (callGemini already handles this)
   - Keep 2-attempt retry + fallback logic

3. **Rewrite `generateRoastCaption()`**: Same change — use `callGemini()` with `gemini-2.5-flash` instead of Replicate

4. **No other changes** — Call 1, scoring, UI, share card all stay the same

### Technical Detail

```text
BEFORE (broken):
  generateCaption() → build [INST] prompt → POST Replicate → poll 1s intervals → parse free text
  Model: Mistral 7B (can't follow complex instructions)
  Latency: 3-5s (async polling)

AFTER (fixed):
  generateCaption() → callGemini(apiKey, messages, 0.9, 150, "gemini-2.5-flash")
  Model: Gemini 2.5 Flash (excellent instruction following)
  Latency: 1-2s (synchronous)
```

The system prompts already have all the right scene/gender/tier logic — the model just needs to be smart enough to follow them.

