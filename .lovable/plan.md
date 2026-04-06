

## Plan: Fix Challenge Sharing, Group Creation, and Expert Fashion Advice

### 1. Fix Challenge Sharing (shared card + gender text)

**Problem**: When "Challenge" is tapped, `SendToFriendPicker` sends only metadata (image_url, score, killer_tag) as a `drip_card` message. The friend sees a minimal preview, not the actual generated share card. Also, the share text says "Beat me if you can" instead of a gender-aware challenge line, and no text accompanies the card on WhatsApp/native share.

**Fix**:

**A. OutfitRatingCard.tsx** — When Challenge is tapped, generate the canvas card blob first, upload it to R2 storage, then pass the R2 URL as the shared image:
- Before opening `SendToFriendPicker`, call `captureCard()` to generate the blob
- Upload blob to R2 via `r2.upload()` to get a public URL
- Pass that URL as `metadata.card_image_url` to `SendToFriendPicker`
- Change the `content` text to be gender-aware: `"Let's Drop His Drip 🔥"` or `"Let's Drop Her Drip 🔥"` based on `styleProfile.gender` (default to "His" if unknown)

**B. SendToFriendPicker.tsx** — No structural changes needed, it already sends `content` and `metadata` as-is.

**C. MessageBubble.tsx** — Update the `drip_card` renderer to prefer `metadata.card_image_url` over `metadata.image_url` for displaying the card. This shows the actual generated card instead of the raw outfit photo.

**D. OutfitRatingCard.tsx (handleShare)** — Update `navigator.share` call to include the gender-aware text: `"Let's Drop His/Her Drip 🔥"` as the share title/text so it appears in WhatsApp and other apps alongside the image.

---

### 2. Fix Group Creation

**Problem**: "Unable to create group" error. The `create_group_conversation` RPC is SECURITY DEFINER and looks correct syntactically. The likely issue is a stale function definition or a constraint conflict.

**Fix**:

**A. Database migration** — `DROP` and recreate `create_group_conversation` with the same logic but adding explicit error handling (`EXCEPTION WHEN` blocks) around each INSERT to surface the actual failure reason.

**B. MessagesScreen.tsx** — Improve error reporting: log the full error object and surface `error.message` in the toast instead of a generic "Failed to create group". Also lower the minimum member requirement from `< 2` to `< 1` (a group with 1 other person + creator = 2 total is valid).

---

### 3. Replace Generic Suggestions with Expert Fashion Advice

**Problem**: The advice line after drip check gives one generic sentence. User wants image-aware, expert-level fashion advice that analyzes what's visible (top, bottom, colors, body shape) and gives specific styling tips.

**Fix**:

**A. supabase/functions/rate-outfit/index.ts** — Expand the `CALL1_SYSTEM` prompt to generate a new field `styling_tips` (array of 2-3 strings) alongside the existing `advice` field. Each tip should:
- Identify what's visible (top, bottom, accessory, colors, patterns)
- Give specific, actionable advice referencing the actual outfit
- Sound like a fashion expert, not generic AI
- Examples: "This top has flowy patterns → works better with structured bottoms", "Contrast is strong → avoid overly baggy denim"

**B. CameraScreen.tsx** — Add `styling_tips?: string[]` to the `RatingResult` type.

**C. OutfitRatingCard.tsx** — Replace the single `{result.advice}` paragraph with a styled list of `result.styling_tips`. Each tip rendered as a compact card with a small icon. Fallback to `result.advice` if `styling_tips` is empty/undefined (backward compat with cached results).

### Technical Details

**Files changed**: `supabase/functions/rate-outfit/index.ts`, `src/components/OutfitRatingCard.tsx`, `src/components/MessageBubble.tsx`, `src/pages/CameraScreen.tsx`, `src/pages/MessagesScreen.tsx`, + 1 database migration.

**No new dependencies**. R2 upload for card image uses existing `r2.upload()`. Gender detection uses existing `styleProfile.gender` from auth context.

