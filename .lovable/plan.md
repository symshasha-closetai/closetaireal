## Fix Plan: 5 Issues

### 1. Shared Card — Remove sub-scores, minimize whitespace

**File: `src/components/OutfitRatingCard.tsx**` (captureCard function, lines 369-418)

Remove the entire sub-scores row and separator from the canvas. Keep only: image, drip score, confidence score, killer tag, praise line, CTA. This removes ~60px of vertical space. Also increase `IMG_H` ratio from `0.68` to `0.78` to give more space to the photo and less to the panel. Reposition praise line directly below the scores row (no sub-scores gap).

### 2. Analyze-clothing — Only detect items with 40-50%+ visibility; smarter watch handling

**File: `supabase/functions/analyze-clothing/index.ts**` (system prompt, line 24-35)

Update the system prompt to add:

- "Only include items that are at least 40-50% visible in the image. If less than half the item is visible, skip it."
- "For watches: if the dial/face is not visible, classify as just 'Watch' (not 'Smartwatch' or 'Analog Watch'). Only specify smartwatch/analog if the dial is clearly visible."
- "For watch image generation context: describe the watch as showing only the strap/band portion visible in the image."

### 3. Create Group fails — RLS policy blocks adding other participants

**Root cause:** The `conversation_participants` INSERT policy requires `user_id = auth.uid() OR is_conversation_participant(auth.uid(), conversation_id)`. When inserting all participants in a single batch, the creator's own row may not be committed yet, so adding friends fails.

**Fix (two-part):**

**A. Database migration** — Create a `create_group_conversation` SECURITY DEFINER function that atomically:

1. Creates the conversation with `is_group = true` and the group name
2. Inserts all participants (creator + members) in one transaction
3. Returns the conversation ID

This bypasses RLS entirely (like `find_or_create_conversation` does for 1:1 chats).

**B. File: `src/pages/MessagesScreen.tsx**` (handleCreateGroup, lines 194-235) — Replace the manual insert logic with a single `supabase.rpc("create_group_conversation", { group_name, member_ids })` call.

### 4. Wardrobe items fail to save

**Root cause analysis:** The `processQueue` function has retry logic (3 attempts) for both R2 upload and DB insert. The "Failed to save items" error likely comes from:

- R2 upload timing out or CORS issues on the edge function
- The `generate-clothing-image` call failing silently (caught with empty `catch {}`)

**File: `src/pages/WardrobeScreen.tsx**` (processQueue, lines 598-685)

- Add better error logging in the empty `catch {}` blocks (lines 615, 625)
- If `generate-clothing-image` fails, immediately fall back to uploading the compressed original image instead of relying on the retry loop (which re-uploads the same compressed blob without the AI image)
- Add a toast when individual items fail during background processing so the user knows which items failed

### 5. Drip Check broken image

**Root cause:** The hero image at line 579 uses `image` (which is a blob URL from `URL.createObjectURL`). Blob URLs expire when the page is navigated away and back, or when the object is revoked. The `min-h-[300px]` fix prevents collapse but still shows a broken image icon.

**File: `src/components/OutfitRatingCard.tsx**` (line 579) + `**src/pages/CameraScreen.tsx**`

- In OutfitRatingCard: Use `imageBase64 || image` as the `src` for the hero `<img>`. The `imageBase64` is a data URL that never expires, while `image` (blob URL) can expire.
- Add an `onError` handler on the `<img>` that falls back to `imageBase64` if the blob URL fails.

### Files to edit

1. `src/components/OutfitRatingCard.tsx` — Simplify shared card (remove sub-scores) + fix broken image with imageBase64 fallback
2. `supabase/functions/analyze-clothing/index.ts` — Visibility threshold + watch logic in prompt
3. New migration SQL — `create_group_conversation` RPC function
4. `src/pages/MessagesScreen.tsx` — Use new RPC for group creation
5. `src/pages/WardrobeScreen.tsx` — Better error handling in processQueue