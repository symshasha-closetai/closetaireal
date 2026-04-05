
Goal: stop guessing and make Savage Mode failures observable, then fix the most likely blockers in the shortest path.

What I found
- The cache fix is only partial: local cache is mode-aware, but guest-mode failure handling still saves generic fallback results and can blur whether the backend truly worked.
- The UI still hides real failures. In `CameraScreen.tsx`, if `rate-outfit` returns any error or missing result, the app immediately shows a random client fallback card instead of a hard failure state. That makes “still not working” look like a prompt/model issue when it may be a backend error.
- Guest mode never saves successful results to history (`saveDripToHistory` only runs on success when `userId` exists), so cache behavior is inconsistent between guest and signed-in paths.
- `drip_history` currently has no mode column, so signed-in history/leaderboard data cannot distinguish standard vs savage.
- The current backend is still direct Gemini and already logs some errors, but not in a structured enough way to pinpoint whether failure is:
  - image payload rejection
  - safety/content blocking
  - malformed/truncated JSON
  - prompt non-compliance
  - frontend masking

Best next move
1. Fix observability first
   - In `CameraScreen.tsx`, stop replacing backend failures with random “success-looking” cards.
   - Show a proper failure state/toast with the exact backend error and a retry button.
   - Only use client fallback for true network exceptions if we explicitly want that behavior.
   - Add a visible badge in result state for Standard vs Savage so mode confusion is obvious.

2. Make guest mode deterministic
   - Save guest results locally on both success and failure with a mode-aware key.
   - Include `mode` and `status` (`success` / `failed`) in local history entries.
   - Do not treat a failed savage run as a valid cached result.
   - When toggling Savage Mode with the same image already loaded, force re-analysis or clear stale result automatically.

3. Make backend diagnostics explicit
   - Update `rate-outfit` to return structured error objects:
     - `stage`: `call1` | `call2` | `roast_call2` | `parse`
     - `provider_status`
     - `provider_body_preview`
     - `model`
     - `retryable`
   - Log request mode (`unfiltered`), image size, selected model, and which stage failed.
   - Add stricter parse fallback handling so truncated JSON is distinguished from provider rejection.

4. Adjust prompts, but only after diagnostics
   - Keep the 2-call architecture.
   - Reduce overlong system prompts, especially Savage prompt verbosity, because large prompts plus image input can increase compliance/parsing failures.
   - Move some repeated rules into compact bullets.
   - For Call 2, require shorter output and stricter schema.
   - For roast mode, separate “non-human detection” from “savage roast copy” more cleanly.

5. Add a database improvement
   - Create a migration to add `mode` to `drip_history` (`standard` | `savage`) and optionally `analysis_status` / `error_message`.
   - This is not the primary fix, but it will prevent history confusion and help future debugging.
   - No new tables needed; just extend existing history data safely.

Likely implementation order
1. `src/pages/CameraScreen.tsx`
   - Remove silent fake-success fallback on known backend errors
   - Save mode-aware guest history consistently
   - Prevent failed runs from poisoning cache
   - Force fresh analysis when mode changes for the same loaded image

2. `supabase/functions/rate-outfit/index.ts`
   - Structured error responses and clearer stage logging
   - Prompt tightening for Savage Mode
   - Better JSON parse handling

3. Database migration
   - Add `mode` and optional status/error columns to `drip_history`

Why this is the best path
- Right now the app can fail and still show a believable card, so changing API/model/prompt blindly may not solve the real issue.
- A new SQL change alone will not fix Savage Mode.
- A full API swap is possible later, but first we need to expose the exact failing stage instead of masking it.

Technical details
- Current masking bug:
  - `if (error || data?.error || !data?.result) { ... clientFallbackResult(...) }`
  - This should become a real error path, not a fake result path.
- Current guest inconsistency:
  - success results are only persisted when `userId` exists
  - failure fallback is persisted even without clear mode/status handling
- Current DB gap:
  - `drip_history` has `image_hash`, `full_result`, etc. but no `mode`

Expected outcome after this pass
- You’ll know whether Savage Mode is failing in Call 1, Call 2, parse, or caching.
- The UI will stop pretending failure is success.
- Savage/standard results will stay separated across guest and signed-in flows.
- If the real problem is prompt/model behavior, we’ll have exact evidence to switch provider or simplify prompts with confidence.
