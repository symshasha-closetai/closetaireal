Goal:

- Remove only the "Today's Look" section from Home.
- Keep the rest of Home unchanged.
- Make Drip Check much harsher without touching the database.

What I’ll change

1. Remove “Today’s Look” from `src/pages/HomeScreen.tsx`

- Delete the Today’s Look card UI only.
- Remove its related upload/crop/share/streak code:
  - imports: `ImageCropper`, `r2`, `compressImage`, and unused icons tied only to this section
  - state: `todayPhoto`, `uploadingPhoto`, `sharingLook`, `pendingCropImage`, `streak`
  - refs: `photoFileRef`
  - effects that load `daily_looks`
  - handlers like `handleTodayPhotoUpload`, `handleCroppedPhoto`, `handleShareTodayLook`, `handleRecropPhoto`
  - hidden file input + cropper modal
- Leave Dripd Observation, Wardrobe, Calendar, Style Me, and the rest of the screen exactly where they already are.

2. Fix why Drip Check still feels weak

You do not need SQL for this.
The problem is in the AI logic and caching, not the database.

I’ll update the brutality in `supabase/functions/rate-outfit/index.ts` by:

- strengthening the system prompt so the model is explicitly harsher, more cutting, and no “nice”
- removing/rewriting softer rules that currently make some outputs flattering, especially:
  - female score 7+ “empowering/screenshot-worthy”
  - softer fallback caption tiers
- making fallback `praise_line` text savage too, so even partial/fallback responses stay on-brand

3. Prevent old cached results from masking prompt changes

Right now `src/pages/CameraScreen.tsx` can reuse an old result for the same image from local storage.
That means even after prompt updates, the app may still show older, softer outputs.

I’ll fix that by:

- versioning the local drip-check cache key/hash logic
- forcing fresh analysis after the prompt update instead of reusing old saved results for the same photo

What I will not change

- No SQL migrations
- No table changes
- No auth changes
- No Style Architect move
- No observation card move

Technical details

Files to update:

1. `src/pages/HomeScreen.tsx`

- Remove Today’s Look feature code and dead imports/state/effects/handlers
- Keep layout otherwise unchanged

2. `supabase/functions/rate-outfit/index.ts`

- Tighten the roast prompt
- Replace soft fallback captions with brutal ones
- Keep existing scoring/response shape so the UI still works

3. `src/pages/CameraScreen.tsx`

- Bust or version cached drip results so prompt changes actually show up

Why no SQL is needed

```text
Tone issue = AI prompt/caching issue
Not = database schema or query issue
```

Expected result

- Home screen no longer shows Today’s Look
- Drip Check responses become much more aggressive
- New prompt behavior appears immediately instead of being hidden by old cached results

Validation

- Upload a brand-new image and confirm the roast is harsher
- Re-upload a previously tested image and confirm it no longer shows stale cached text
- Check Home on mobile to confirm removing Today’s Look doesn’t break spacing or card order