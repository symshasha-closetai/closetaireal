

## Plan: Migrate All Storage to Cloudflare R2 — COMPLETED

All image storage has been migrated from Supabase Storage to Cloudflare R2.

### What was done:
1. Created `supabase/functions/_shared/r2.ts` — shared S3-compatible R2 helper using aws4fetch
2. Created `supabase/functions/r2-storage/index.ts` — upload/delete/list proxy edge function
3. Created `src/lib/r2Storage.ts` — client-side R2 utility (drop-in replacement)
4. Updated 6 client files to use `r2.upload()` and `r2.getPublicUrl()`
5. Updated 5 edge functions to use direct R2 S3 API calls
6. Updated service worker to cache R2 URLs
