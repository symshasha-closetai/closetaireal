
Goal: Fix wardrobe AI reliability + false “added” feedback, restore share-card sub-scores (no rings), and make killer tag/praise line more playful (emoji-friendly, no profanity).

What I found
- “AI analysis failed” is currently a generic catch in `src/pages/WardrobeScreen.tsx` with no real error detail shown to users.
- `supabase/functions/analyze-clothing/index.ts` converts upstream 400/429 issues into broad failures; frontend can’t distinguish retryable vs invalid-image cases.
- In `processQueue` (WardrobeScreen), insert/upload errors can be ignored, but final toast still says “All items added to wardrobe!”.
- Share card in `src/components/OutfitRatingCard.tsx` currently has no Color/Style/Fit sub-scores.
- `killer_tag`/`praise_line` tone is model-dependent and not strongly constrained yet.

Implementation plan

1) Stabilize clothing AI analysis flow (frontend + backend)
- File: `src/pages/WardrobeScreen.tsx`
  - Add robust error parsing for backend function errors (show meaningful toast: rate-limited, invalid image, temporary backend issue).
  - Add retry/backoff for transient failures (e.g., 429/5xx).
  - Add fallback analysis path:
    - Try compressed image first.
    - If compression or analysis fails with image-processing error, retry using original file base64 + MIME type.
  - Keep manual fallback, but with specific copy (not generic “AI failed” only).
- File: `supabase/functions/analyze-clothing/index.ts`
  - Accept optional `mimeType` from request.
  - Return clearer status/message mapping from AI provider errors (400 invalid image, 429 rate limit, 500 generic).
  - Improve response parsing guardrails and keep JSON-safe fallback.

2) Fix “added but nothing happened” trust issue in wardrobe add flow
- File: `src/pages/WardrobeScreen.tsx`
  - In `processQueue`, track `successCount` and `failureCount` per batch.
  - Validate storage upload result and insert result explicitly (no silent pass-through).
  - Only show full success toast when `failureCount === 0`.
  - Show partial-failure toast with counts when needed.
  - Refresh list from backend at completion (or reconcile precisely) so UI always reflects true saved state.
  - After successful add, set category to “All” so new items are visible immediately.

3) Bring back share-card sub-scores without rings
- File: `src/components/OutfitRatingCard.tsx`
  - Keep interactive card unchanged (rings remain there).
  - In hidden share card, add a centered 3-column sub-score row:
    - Color / Style / Fit labels + numeric values
    - No circular rings
    - Consistent spacing and centered alignment to avoid “off-center” feel.

4) Make killer tag + praise line quirky, emoji-friendly, and clean
- File: `supabase/functions/rate-outfit/index.ts`
  - Tighten prompt rules for tone:
    - playful Gen Z vibe
    - include emoji naturally
    - strictly no cuss/profanity
  - Add backend post-processing guard:
    - profanity sanitization on `killer_tag` and `praise_line`
    - ensure at least one light emoji when missing
    - keep output short/shareable.

Technical details
- No database schema changes needed.
- Main touched files:
  - `src/pages/WardrobeScreen.tsx`
  - `supabase/functions/analyze-clothing/index.ts`
  - `src/components/OutfitRatingCard.tsx`
  - `supabase/functions/rate-outfit/index.ts`
- Existing auth and RLS flow remains unchanged.

Verification plan
1. Upload 5–10 varied images (camera + gallery) and confirm AI detection reliability improves.
2. Force transient failures (retry path) and confirm user sees clear message, not generic failure.
3. Add detected items and confirm end state matches reality (no false “all added”).
4. Confirm newly added items are visible immediately.
5. Share/download result card and verify Color/Style/Fit appear as centered text scores (no rings).
6. Run multiple drip checks and confirm killer tag/praise line are playful with emojis and no profanity.
