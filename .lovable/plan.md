

## Plan: CDN-Based Image Upload for Faster Drip Check

### Problem
Currently, the compressed image (~200KB) is sent as base64 in the JSON body to the edge function, which then forwards it inline to Gemini. This large payload slows down the request. The 12s minimum animation delay also forces unnecessary waiting.

### Approach: Upload to Storage First, Send URL to Edge Function

#### 1. Client-side changes (`src/pages/CameraScreen.tsx`)

In `runAnalysis`, after compression:
- Upload the compressed blob to Supabase Storage immediately (path: `{userId}/drip-{timestamp}.jpg`)
- Get the public URL
- Send `{ imageUrl, styleProfile }` to the edge function instead of `{ imageBase64, styleProfile }`
- Also store the image URL in global state (already done later for history -- move it earlier)
- Reduce minimum animation delay from 12s to 8s (the actual AI call should now be faster with smaller payload)

#### 2. Edge function changes (`supabase/functions/rate-outfit/index.ts`)

- Accept either `imageUrl` or `imageBase64` (backward compatible)
- If `imageUrl` is provided: fetch the image from the URL, convert to base64, send to Gemini as `inlineData` (Gemini doesn't support arbitrary HTTP URLs via `fileUri`)
- This makes the edge function request payload tiny (~100 bytes for the URL vs ~270KB for base64)
- Increase the Gemini timeout from 7s to 10s since we're saving time on payload transfer
- The fetch from Supabase Storage to the edge function is fast (same infrastructure)

#### 3. Parallel operations

```text
Client compresses image (fast)
         |
         v
   Upload to Storage ──────────────┐
         |                         |
         v                         v
   Get public URL          (upload completes)
         |
         v
   Call rate-outfit with URL (tiny payload, fast)
         |
         v
   Edge function fetches image from Storage (internal, fast)
         |
         v
   Send to Gemini API
         |
         v
   Return result
```

### Key Details
- Storage upload and cache check happen in parallel
- For non-logged-in users (no userId), fall back to base64 approach
- Edge function fetch from storage is near-instant (same Supabase infra)
- The image is already being uploaded to storage later for history -- we just move it earlier and reuse the URL

### Files Modified
- `src/pages/CameraScreen.tsx` -- upload first, send URL, reduce min delay to 8s
- `supabase/functions/rate-outfit/index.ts` -- accept imageUrl, fetch + convert, increase AI timeout to 10s

