

# Plan: Profile Style Editor, Dark Mode Logo, and Editable AI Analysis

## 1. Profile Screen: Edit Style Preferences & Regenerate AI Model

Add new sections to `ProfileScreen.tsx`:

**"Style Profile" card** showing current body type, skin tone, face shape, style preferences, and AI model image. Each is editable:
- Body type: dropdown/select from the same `bodyTypes` list
- Skin tone: color swatch picker (same as onboarding)
- Face shape: select from `faceShapes` list
- Style preferences: multi-select chips from `styleOptions`
- "Save & Regenerate Model" button that updates `style_profiles` in DB and calls `generate-model-avatar` edge function to create a new model image

**"AI Model" section** showing the current model image with a "Regenerate" button.

**"Re-upload Photos" option** to re-upload face/body photos and re-run `analyze-body-profile`, then optionally regenerate the model.

### File: `src/pages/ProfileScreen.tsx`
- Import `useAuth` to get `styleProfile`
- Add state for editing body_type, skin_tone, face_shape, style_type
- Add editable sections between the form card and logout button
- Add regenerate model handler that calls the edge function

## 2. Dark Mode Logo

Currently there's only one logo file (`closetai-logo.png`). For dark mode visibility:

**Approach**: Use CSS `filter` or `dark:` variant to invert/brighten the logo automatically in dark mode rather than requiring a second asset. Add `dark:invert` or `dark:brightness-200` class to the logo `<img>` in `AppHeader.tsx` and `SplashScreen.tsx`.

### Files: `src/components/AppHeader.tsx`, `src/components/SplashScreen.tsx`
- Add `className="... dark:brightness-0 dark:invert"` to logo images so they appear bright on dark backgrounds.

## 3. Editable AI Analysis Results During Onboarding Confirmation

Currently after AI analysis, onboarding skips straight to style preferences (step 2) showing read-only analysis chips. Change this:

**Add a confirmation step** after AI analysis where users can review AND edit the detected values before proceeding:
- After `uploadPhotosAndAnalyze` succeeds, go to step 1 (body profile) instead of step 2, but pre-filled with AI values
- Remove the `!photosProvided` condition on step 1 so it always shows when `step === 1`
- Show a banner at top: "AI detected these — feel free to adjust"
- User can edit body type, skin tone, face shape, then proceed to style preferences

### File: `src/pages/OnboardingScreen.tsx`
- After analysis, set step to 1 (not 2)
- Remove `!photosProvided` guard on step 1 rendering
- Add "AI detected" banner when `photosProvided && analysisResult` exists on step 1
- Keep the pre-filled values editable

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/ProfileScreen.tsx` | Add style profile editor, model preview, regenerate model, re-upload photos |
| `src/pages/OnboardingScreen.tsx` | Make step 1 always show (editable AI results), navigate to step 1 after analysis |
| `src/components/AppHeader.tsx` | Add dark mode logo handling |
| `src/components/SplashScreen.tsx` | Add dark mode logo handling |

