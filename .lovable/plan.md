# Multi-Feature Update Plan

## 1. Optimize image storage size (~200KB)

Update `compressImage` defaults across the app to target 200KB consistently. The function already supports this but callers use different params.

**Changes:**

- `CameraScreen.tsx`: already uses `compressImage(file, 512, 512)` — add explicit `quality=0.65, targetSizeKB=200`
- `HomeScreen.tsx` (today's look upload): already compresses, verify 200KB target
- `WardrobeScreen.tsx`: ensure wardrobe uploads use same compression
- `OnboardingScreen.tsx`: avatar/body photo uploads

## 2. Fix share button speed (html2canvas is slow)

The share button uses `html2canvas` which is inherently slow — it renders DOM to canvas, waits 500ms for mount, then captures at 2x scale. Replace with the manual Canvas API approach (same as `handleShareTodayLook` in HomeScreen). 

**File:** `src/components/OutfitRatingCard.tsx`

- Remove `html2canvas` import and the hidden share card DOM (lines 649-752)
- Replace `captureCard()` with a manual Canvas API function that draws the image, gradient overlay, scores, killer tag, and branding directly — no DOM rendering needed
- This eliminates the 500ms wait + html2canvas render time

## 3. Match home page padding to other pages

HomeScreen uses `pt-8`, other pages use `pt-4`. Change HomeScreen's `pt-8` to `pt-4`.

**File:** `src/pages/HomeScreen.tsx` line 522: `px-5 pt-8` → `px-5 pt-4`

## 4. Add delete button to deleted items in history + 7-day auto-delete

**a) UI:** Add a delete button on each deleted item card in the inline scroll (lines 1089-1104) and the "View All" overlay already has it (lines 873-881, already exists).

**b) Auto-delete text:** Add "Auto-deleted after 7 days" note below the Deleted Items header.

**c) Auto-delete logic:** Create a DB migration with a scheduled function or add client-side cleanup: on profile load, permanently delete wardrobe items where `deleted_at < NOW() - 7 days`.

**File:** `src/pages/ProfileScreen.tsx`

## 5. Make Style Personality static — AI-analyzed every 30 days

Currently recomputes on every render from a hash-based algorithm that's inconsistent. Replace with:

**a) New DB column:** Add `style_personality` and `style_personality_updated_at` to `style_profiles` table.

**b) Logic:** On profile load, check if `style_personality_updated_at` is null or > 30 days ago. If so, use AI (Gemini) to analyze based on wardrobe items (20%) and drip check photos (80%), save result to DB. Otherwise, display the stored value.

**c) Edge function:** Create `analyze-style-personality` that takes wardrobe summary + recent drip history and returns a personality tag.

 And when clicked on that give reason, once generated then cached for 30 days 

**Files:**

- DB migration: add columns to `style_profiles`
- New edge function: `supabase/functions/analyze-style-personality/index.ts`
- `src/pages/ProfileScreen.tsx`: replace hash-based computation with DB-stored value + 30-day refresh
  &nbsp;

## Technical Details

- **Image compression**: No new functions needed, just standardize params across all callers
- **Share speed**: Manual Canvas API draws image + text overlays in ~50ms vs html2canvas's ~1-2s. Pre-load the outfit image as `ImageBitmap` for instant drawing
- **Padding**: Single class change `pt-8` → `pt-4`
- **Auto-delete**: Client-side cleanup query on profile mount: `DELETE FROM wardrobe WHERE deleted_at < NOW() - INTERVAL '7 days'`
- **Style personality AI prompt**: "Based on 80% outfit photos and 20% wardrobe composition, determine the user's style personality from: Dark Academia, Cottagecore, Y2K Nostalgia, Techwear, Preppy, Grunge, Quiet Luxury, Streetcore, Classic Sophisticate, Elegant Minimalist, Boho Spirit, Athleisure Icon, Vintage Rebel, Smart Casual, Eclectic Mix"