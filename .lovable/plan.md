

## Plan: Drastically Speed Up Drip Check (~5-7s target)

### Root Cause Analysis
From edge function logs:
- `gemini-2.0-flash` returns 429 (rate limited) — wasted ~3s
- Falls back to `gemini-2.5-flash` — times out at 10s
- Result is random fallback, not real AI analysis
- Total: ~16s for a fake result

### Optimizations (combined approach)

#### 1. Switch to Lovable AI Proxy (`supabase/functions/rate-outfit/index.ts`)
Instead of calling Gemini API directly with `GOOGLE_AI_API_KEY` (which hits rate limits), use the Lovable AI proxy via `LOVABLE_API_KEY` (already configured). This:
- Handles rate limiting/retries internally
- Supports `google/gemini-2.5-flash` (fast + capable for vision)
- No 429 errors

Replace `callWithFallback` Gemini direct calls with a single fetch to the Lovable AI endpoint.

#### 2. Compress to 512px Instead of 800px (`src/pages/CameraScreen.tsx`)
Smaller image = faster upload + faster AI processing. 512px is sufficient for outfit analysis.

#### 3. Trim the Prompt (`supabase/functions/rate-outfit/index.ts`)
The confidence_reason prompt alone is ~200 words of scientific instructions. Cut it by 60% — less tokens = faster response.

#### 4. Parallel Upload + Cache Check (`src/pages/CameraScreen.tsx`)
Currently sequential: compress → hash → check cache → upload → call AI.
Change to: compress → (hash+check cache) in parallel with (upload to storage) → call AI.

#### 5. Reduce Min Animation to 5s (`src/pages/CameraScreen.tsx`)
With faster AI, reduce `minDelay` from 8s to 5s and step interval from 3s to 1.5s.

### Files Modified
- `supabase/functions/rate-outfit/index.ts` — Lovable AI proxy, trimmed prompt
- `src/pages/CameraScreen.tsx` — 512px compression, parallel ops, 5s min delay
- `src/lib/imageCompression.ts` — no changes needed (params passed from caller)

### Expected Improvement
- Current: 12-16s (often returning fake fallback)
- Target: 5-7s (real AI results, no rate limits)

