

# Full App Status & What Needs to Be Done

## The "Generic Drip Score" Problem

The drip scores you're seeing are **not from Gemini** — they're from a hardcoded client-side fallback (`clientFallbackResult` in CameraScreen.tsx, line 84). This generates random scores between 7-9.5 with generic reasons like "Great color coordination" every time.

**Why it's falling back**: The `supabase.functions.invoke("rate-outfit")` call is hitting the **Lovable Cloud** Supabase project (`xtxwrvjdoexuymdkmzit`) — not your standalone project (`upmrumzbgwordkkpgqxb`). Since the Lovable preview's `.env` has the old URL, the edge function call either fails or returns an error, and the code silently falls back to generic results (line 353-357).

On `dripd.me`, if the Cloudflare env vars are correct, the edge functions should work — but only if they're **deployed to your standalone project**. If they're only on Lovable Cloud, `dripd.me` will also get fallback results.

## What's Done

| Item | Status |
|------|--------|
| Lovable infrastructure cleanup (tagger, cloud-auth) | Done |
| Auth switched to standard Supabase OAuth | Done |
| Database schema (16 tables, triggers, RLS) | Done |
| Cloudflare env vars set for new project | Done |
| Edge functions deployed to **Lovable Cloud** | Done |
| useAuth.tsx — profile fetch on getSession | Done |

## What's Broken (4 items)

### 1. Build Error — OnboardingScreen.tsx line 593
The "Start Styling" button has broken JSX syntax:
```
<button async () => { await refreshProfile(); ... } className=...>
```
Should be:
```tsx
<button onClick={async () => { await refreshProfile(); navigate("/", { replace: true }); }} className=...>
```

### 2. Drip Score Returns Generic Fallback (Not Gemini)
The `rate-outfit` edge function works correctly, but the client falls back silently when the call fails. Two sub-issues:
- **Lovable preview**: Always fails because `.env` points to wrong project
- **dripd.me**: Fails if edge functions aren't deployed to your standalone project

**Fix**: Add a toast/log when the AI call fails so you can see the actual error instead of silent fallback.

### 3. Onboarding Loop
The `saveAndFinish` upsert error is not checked — if it fails, the user loops back. Combined with the broken button JSX (item 1), the final step is completely non-functional.

### 4. Edge Functions Not on Standalone Project
The 14 edge functions are deployed to Lovable Cloud only. For `dripd.me` to work, they must also be deployed to `upmrumzbgwordkkpgqxb` via CLI.

## Plan — Fixes to Apply in Lovable

### Fix 1: OnboardingScreen.tsx — Repair button JSX (line 593)
Replace the broken `<button async () =>` with proper JSX:
```tsx
<button
  onClick={async () => {
    await refreshProfile();
    navigate("/", { replace: true });
  }}
  className="px-8 py-4 rounded-2xl gradient-accent text-accent-foreground font-semibold text-base shadow-soft active:scale-[0.98] transition-transform flex items-center gap-2"
>
  <Sparkles size={20} /> Start Styling
</button>
```

### Fix 2: CameraScreen.tsx — Surface AI errors instead of silent fallback
Around line 352-357, add a toast when the AI call fails so you can diagnose the issue:
```typescript
if (error) {
  console.error("rate-outfit error:", error);
  toast.error("AI rating failed: " + (error.message || "Unknown error"));
  throw error;
}
if (data?.error || !data?.result) {
  console.error("rate-outfit returned error:", data?.error);
  toast.error("AI returned error: " + (data?.error || "No result"));
  // Still use fallback but now you know WHY
  const fallback = clientFallbackResult(gender);
  ...
}
```

### Fix 3: OnboardingScreen.tsx — Check upsert errors in saveAndFinish
Add error handling to the `upsert` call so failures don't silently pass.

## What to Do Outside Lovable

1. **Deploy edge functions to standalone project** — this is the main reason drip scores are generic on `dripd.me`:
   ```bash
   supabase link --project-ref upmrumzbgwordkkpgqxb
   supabase secrets set GOOGLE_AI_API_KEY=<key> REPLICATE_API_KEY=<key> R2_ACCESS_KEY_ID=<key> R2_SECRET_ACCESS_KEY=<key> R2_ENDPOINT=<endpoint> R2_BUCKET_NAME=<bucket> R2_PUBLIC_URL=<url>
   supabase functions deploy
   ```

2. **Verify Google OAuth** in the standalone Supabase dashboard (Providers → Google enabled, redirect URIs correct).

3. **Trigger a Cloudflare rebuild** after the Lovable fixes are pushed to GitHub.

## Flow Summary

```text
Lovable Editor
  ↓ (auto-commit)
GitHub Repo
  ↓ (auto-deploy)
Cloudflare Pages (dripd.me)
  ↓ (env vars point to upmrumzbgwordkkpgqxb)
Your Standalone Supabase
  ↓ (needs edge functions deployed)
Gemini API (rate-outfit, etc.)
```

The Lovable preview will always show fallback/generic results due to the env mismatch. Test real functionality on `dripd.me` after deploying edge functions to your standalone project.

