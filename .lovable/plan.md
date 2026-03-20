

## Plan: Migrate All Storage to Cloudflare R2

### Secrets Needed

I'll need you to provide 4 secrets via the secure secrets tool:
- **R2_ACCESS_KEY_ID** — your S3-compatible access key
- **R2_SECRET_ACCESS_KEY** — your S3-compatible secret key
- **R2_ENDPOINT** — your R2 endpoint URL (format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
- **R2_BUCKET_NAME** — your bucket name
- **R2_PUBLIC_URL** — the public URL for your bucket (you'll need to enable public access on the bucket first — either via `*.r2.dev` subdomain or a custom domain)

### Architecture

```text
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Frontend    │────▶│  r2-storage      │────▶│  Cloudflare  │
│  (upload/    │     │  (edge function) │     │  R2 Bucket   │
│   getUrl)    │     │  S3 API client   │     │              │
└──────────────┘     └──────────────────┘     └─────────────┘
```

A single new edge function `r2-storage` handles upload, delete, and list operations. Public URLs are constructed from `R2_PUBLIC_URL + path`.

### Implementation

**1. Create `supabase/functions/r2-storage/index.ts`**
- S3-compatible client using `aws4fetch` (lightweight Deno-compatible S3 signer)
- Endpoints: `upload` (PUT object), `delete` (DELETE object), `list` (LIST prefix)
- Returns public URL after upload: `R2_PUBLIC_URL/path`

**2. Create `src/lib/r2Storage.ts` — client utility**
- Drop-in replacement for `supabase.storage.from("wardrobe")`
- `upload(path, blob, options)` → calls edge function, returns `{ publicUrl }`
- `getPublicUrl(path)` → returns `R2_PUBLIC_URL/path` (no edge function needed)
- `remove(paths)` → calls edge function

**3. Update all client-side files** (6 files)
- `src/pages/HomeScreen.tsx` — today's look upload
- `src/pages/OnboardingScreen.tsx` — face/body photo uploads
- `src/pages/WardrobeScreen.tsx` — wardrobe item uploads
- `src/pages/ProfileScreen.tsx` — avatar upload
- `src/components/StyleProfileEditor.tsx` — face/body re-upload
- `src/hooks/useOptionImage.ts` — option image URL construction

Replace `supabase.storage.from("wardrobe").upload(...)` with `r2.upload(...)` and `supabase.storage.from("wardrobe").getPublicUrl(...)` with `r2.getPublicUrl(...)`.

**4. Update all edge functions** (5 files)
- `generate-clothing-image/index.ts`
- `generate-option-images/index.ts`
- `generate-model-avatar/index.ts`
- `generate-suggestion-image/index.ts` (no storage currently, but may need it)
- `virtual-tryon/index.ts`
- `clear-option-cache/index.ts`

Replace Supabase storage calls with direct S3 API calls using `aws4fetch` and R2 credentials.

**5. Update service worker** (`public/sw.js`)
- Update image URL pattern matching to recognize R2 public URLs instead of Supabase storage URLs

### Files to Create
- `supabase/functions/r2-storage/index.ts` — upload/delete/list proxy
- `src/lib/r2Storage.ts` — client-side R2 utility

### Files to Modify
- `src/pages/HomeScreen.tsx`
- `src/pages/OnboardingScreen.tsx`
- `src/pages/WardrobeScreen.tsx`
- `src/pages/ProfileScreen.tsx`
- `src/components/StyleProfileEditor.tsx`
- `src/hooks/useOptionImage.ts`
- `supabase/functions/generate-clothing-image/index.ts`
- `supabase/functions/generate-option-images/index.ts`
- `supabase/functions/generate-model-avatar/index.ts`
- `supabase/functions/virtual-tryon/index.ts`
- `supabase/functions/clear-option-cache/index.ts`
- `public/sw.js`

### No database changes needed
All image URLs stored in DB tables remain strings — they'll just point to R2 instead of Supabase storage. Existing URLs in the DB will still work (old Supabase URLs remain valid until you delete the bucket).

