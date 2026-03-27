

# Status Check & Google OAuth Fix

## What's Done
- Auth code uses standard `supabase.auth.signInWithOAuth` (no Lovable proxy)
- `src/integrations/lovable/` folder deleted
- `@lovable.dev/cloud-auth-js` removed from `package.json` (still in lockfiles, harmless)
- Edge function TS errors fixed (`generate-outfit-calendar`)

## Why Google OAuth Still Shows 404

The `.env` file has a **critical mismatch**:
- `VITE_SUPABASE_ANON_KEY` belongs to your NEW project (`upmrumzbgwordkkpgqxb`)
- `VITE_SUPABASE_URL` still points to the OLD Lovable project (`xtxwrvjdoexuymdkmzit`)

When you click "Sign in with Google", the Supabase client sends the OAuth request to `https://xtxwrvjdoexuymdkmzit.supabase.co/auth/v1/authorize?provider=google` — but that project doesn't recognize your anon key, so it returns 404/401.

**The Lovable preview will always have this issue** because `.env` is auto-managed. Your **Cloudflare deployment** is what matters — make sure these env vars are set in Cloudflare Pages dashboard:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://upmrumzbgwordkkpgqxb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your new project's anon key |
| `VITE_SUPABASE_PROJECT_ID` | `upmrumzbgwordkkpgqxb` |

Also verify in your **new Supabase dashboard**:
1. Authentication → Providers → Google is **enabled** with your Client ID and Secret
2. Authentication → URL Configuration → Site URL = your Cloudflare domain
3. Authentication → URL Configuration → Redirect URLs includes your Cloudflare domain
4. Google Cloud Console → OAuth Client → Authorized redirect URIs includes `https://upmrumzbgwordkkpgqxb.supabase.co/auth/v1/callback`

## Remaining: Edge Function Deployment

All 14 functions need to be deployed to your new Supabase project via CLI. Here's the complete list and the secrets each needs:

### All 14 Edge Functions

| # | Function | Purpose | Secrets Needed |
|---|----------|---------|----------------|
| 1 | `analyze-body-profile` | AI body/face analysis from photos | `GOOGLE_AI_API_KEY` |
| 2 | `analyze-clothing` | Detect clothing items from image | `GOOGLE_AI_API_KEY` |
| 3 | `analyze-style-personality` | Determine style personality | `GOOGLE_AI_API_KEY` |
| 4 | `clear-option-cache` | Clear R2 cached option images | `R2_*` (all 5) |
| 5 | `generate-clothing-image` | Generate clothing product images | `REPLICATE_API_KEY`, `R2_*` |
| 6 | `generate-model-avatar` | Generate model avatar + face swap | `REPLICATE_API_KEY`, `R2_*` |
| 7 | `generate-option-images` | Generate onboarding option images | `REPLICATE_API_KEY`, `R2_*` |
| 8 | `generate-outfit-calendar` | AI weekly outfit planning | `GOOGLE_AI_API_KEY`, `GOOGLE_AI_API_KEY_2/3/4` |
| 9 | `generate-suggestion-image` | Generate suggestion product images | `REPLICATE_API_KEY` |
| 10 | `generate-suggestions` | AI outfit suggestions | `GOOGLE_AI_API_KEY` |
| 11 | `r2-storage` | R2 upload/delete/list proxy | `R2_*` (all 5) |
| 12 | `rate-outfit` | AI outfit rating/scoring | `GOOGLE_AI_API_KEY` |
| 13 | `style-me` | AI outfit generation | `GOOGLE_AI_API_KEY` |
| 14 | `virtual-tryon` | Virtual try-on image generation | `REPLICATE_API_KEY`, `R2_*` |

### Deployment Commands

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link to your new project
supabase link --project-ref upmrumzbgwordkkpgqxb

# 4. Set ALL secrets at once
supabase secrets set \
  GOOGLE_AI_API_KEY=your_key \
  GOOGLE_AI_API_KEY_2=your_key2 \
  GOOGLE_AI_API_KEY_3=your_key3 \
  GOOGLE_AI_API_KEY_4=your_key4 \
  REPLICATE_API_KEY=your_key \
  R2_ACCESS_KEY_ID=your_key \
  R2_SECRET_ACCESS_KEY=your_key \
  R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com \
  R2_BUCKET_NAME=your_bucket \
  R2_PUBLIC_URL=https://pub-xxx.r2.dev

# 5. Deploy all functions
supabase functions deploy

# 6. Verify
supabase functions list
```

### Config: All functions need `verify_jwt = false`

Your `supabase/config.toml` already has this configured for all 14 functions. When you deploy via CLI from this repo, it will use that config automatically.

## Plan to Generate Edge Functions Reference File

I'll create a downloadable document listing all 14 edge functions with their full source paths, purposes, required secrets, and deployment notes — so you have a single reference for the CLI deployment.

### Technical Changes
1. Generate `/mnt/documents/edge_functions_guide.md` with complete deployment reference

