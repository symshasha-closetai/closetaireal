

## Plan: Remove Model/Try-On, Fix Saved Outfit Detail View, Fix Suggestion Images

### Problem Summary
1. **Model avatar & virtual try-on not working** — remove from everywhere for now (HomeScreen, OnboardingScreen, StyleProfileEditor, ProfileScreen)
2. **Saved outfits in History show nothing when clicked** — no detail view exists for saved outfits in ProfileScreen
3. **Suggestion images broken in History** — `handleSaveSuggestion` never saves the generated `image` URL to the `saved_suggestions.image` column; ProfileScreen doesn't display suggestion images
4. **Photo upload for body/face analysis must stay** — users still need to upload photos for AI body/skin/face analysis in onboarding and profile

### Changes

#### 1. Remove Model Avatar & Try-On from HomeScreen (`src/pages/HomeScreen.tsx`)
- Remove `generateModelAvatar`, `generateTryOn` functions and related state (`fullSizeModelUrl`, `generatingModel`, `generatingTryOnIdx`)
- In `handleStyleFlow`: remove the parallel `generateModelAvatar` call and post-result `generateTryOn` call — just call `callStyleMe` directly
- Remove the entire Right Panel (AI Model display section, lines ~548-603)
- Remove try-on image display from outfit cards and detail view
- Remove "Generate Try-On Preview" button from detail view
- Keep wardrobe display, occasion/time/weather selectors, Style Me/Surprise Me buttons, Drip Check card — everything else stays

#### 2. Remove Model Generation from OnboardingScreen (`src/pages/OnboardingScreen.tsx`)
- In `generateModelAndFinish`: remove the `generate-model-avatar` function call — just save preferences and navigate home
- Keep photo upload + `analyze-body-profile` flow intact (still needed for body/face analysis)

#### 3. Remove Model Regeneration from StyleProfileEditor (`src/components/StyleProfileEditor.tsx`)
- In `handleSaveAndRegenerate`: remove the `generate-model-avatar` call — just save/upsert profile data
- Keep the model image preview display (if one was already generated it can still show)
- Keep photo re-upload + re-analysis flow

#### 4. Add Saved Outfit Detail View in ProfileScreen (`src/pages/ProfileScreen.tsx`)
- Add state: `viewingSavedOutfit` (the saved outfit object or null)
- When a saved outfit row is clicked, set `viewingSavedOutfit` to that outfit
- Render a full-screen detail overlay (similar to HomeScreen's outfit detail) showing:
  - Outfit name, occasion, score with ScoreRing
  - Explanation text
  - Score breakdown bars (color, occasion, season, body_type, skin_tone, fabric) from `score_breakdown` JSON
  - Reasoning grid (season, mood, time_of_day, etc.) from `reasoning` JSON
  - Close button

#### 5. Fix Suggestion Image Saving (`src/components/OutfitRatingCard.tsx`)
- In `handleSaveSuggestion`: include the suggestion image URL in the insert data
  - For shopping suggestions: check `suggestionImages[idx]` (need to pass idx or look up from the prompt cache)
  - Simpler: save `image` field as the cached/generated image URL when available
- Update the save call to include `image: imageUrl || null`

#### 6. Display Suggestion Images in ProfileScreen History
- In the saved suggestions list rendering, show the `image` field from the suggestion data as a thumbnail instead of the generic icon

### Files Modified
- `src/pages/HomeScreen.tsx` — remove model/try-on, simplify layout
- `src/pages/OnboardingScreen.tsx` — remove model generation call
- `src/components/StyleProfileEditor.tsx` — remove model regeneration call
- `src/pages/ProfileScreen.tsx` — add saved outfit detail view, show suggestion images
- `src/components/OutfitRatingCard.tsx` — save image URL with suggestions

