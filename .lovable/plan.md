

# Plan: Fix Onboarding Loop + Add Visual Illustrations

## Issues Identified

1. **Skip loops back to onboarding**: The "Skip" button navigates to `/`, but `ProtectedRoute` checks `hasCompletedOnboarding === false` and redirects right back to `/onboarding`. Same issue after completing all steps — `handleComplete` navigates to `/` without refreshing the auth context's onboarding state.

2. **Completing onboarding loops**: `handleComplete` saves to `style_profiles` and navigates to `/`, but never calls `refreshProfile()` to update `hasCompletedOnboarding` in the auth context. The stale `false` value causes the redirect loop.

3. **No visuals for body types/styles**: Users see text-only chips with no reference images.

## Changes

### 1. Fix the onboarding loop (`OnboardingScreen.tsx`)
- In `handleComplete`: call `await refreshProfile()` after the upsert succeeds, before navigating.
- For "Skip": also insert a minimal `style_profiles` row (marking onboarding as done) and call `refreshProfile()` before navigating. This prevents the redirect loop.

### 2. Add body type illustrations (`OnboardingScreen.tsx`)
- Replace text-only chips with card-style buttons that include simple SVG silhouette illustrations for each body type (Hourglass, Pear, Rectangle, Apple, Inverted Triangle). These will be inline SVGs — minimal line-art silhouettes showing the body shape.
- Similarly for face shapes, add small SVG icons showing each shape outline.

### 3. Add style preference illustrations (`OnboardingScreen.tsx`)
- Replace text-only chips with larger cards featuring an emoji/icon and a short description for each style:
  - Casual: relaxed tee icon + "Relaxed & comfortable"
  - Formal: suit icon + "Sharp & polished"
  - Streetwear: sneaker icon + "Urban & trendy"
  - Minimalist: circle icon + "Clean & simple"
  - Bohemian: flower icon + "Free-spirited & artsy"
  - Classic: watch icon + "Timeless & elegant"
  - Sporty: running icon + "Active & athletic"

### Files to Edit
| File | Change |
|------|--------|
| `src/pages/OnboardingScreen.tsx` | Fix skip/complete to refresh auth state; add visual cards for body types, face shapes, and style preferences |

