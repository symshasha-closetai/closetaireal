## Plan: Enhanced Drip Check, Gender Selection, and Social Auth

This is a multi-part plan covering 5 areas: clickable drip/confidence scores, personalized suggestions, gender selection, profile updates, and Google/Apple authentication.

---

### 1. Clickable Drip Score and Confidence Rating

**File: `src/components/OutfitRatingCard.tsx**`

- Make the Drip Score and Confidence Rating tappable (like sub-scores already are)
- Add `drip_reason` and `confidence_reason` fields to the tooltip system
- When tapped, show a tooltip explaining the logic behind that rating
- Add an option to download the drip card in the device

**File: `src/pages/CameraScreen.tsx**`

- Extend `RatingResult` type with `drip_reason` and `confidence_reason`

**File: `supabase/functions/rate-outfit/index.ts**`

- Update system prompt to also return `drip_reason` and `confidence_reason` strings explaining the logic behind those scores

---

### 2. Personalized, Non-Generic Suggestions

**File: `supabase/functions/rate-outfit/index.ts**`

- Pass the user's style profile (body type, skin tone, face shape, style preferences, gender) into the system prompt
- Update the prompt to require suggestions that reference the user's body composition, skin tone, face shape, selected styles, and current trends
- Shopping suggestions should be specific (e.g., "A V-neck olive cotton top to complement your warm skin tone and pear body type") rather than generic

**File: `src/pages/CameraScreen.tsx**`

- Fetch `style_profiles` data and pass it to the edge function alongside `wardrobeItems`

---

### 3. Gender Selection

**Database Migration:**

- Add `gender` column (text, nullable) to `style_profiles` table

**File: `src/pages/OnboardingScreen.tsx**`

- Add a gender selection step (Male / Female / Other) early in onboarding (step 0 or beginning of step 1)
- Save selected gender to `style_profiles`

**File: `src/components/StyleProfileEditor.tsx**`

- Add gender picker in the profile editor so users can change it later

**File: `src/pages/ProfileScreen.tsx**`

- Gender will be visible/editable via the existing StyleProfileEditor

**Edge Functions (`analyze-body-profile`, `generate-model-avatar`, `style-me`):**

- Pass gender to all AI calls so body analysis, avatar generation, and styling recommendations are gender-aware

---

### 4. Google and Apple Authentication

**File: `src/pages/AuthScreen.tsx**`

- Add "Continue with Google" and "Continue with Apple" buttons below the email/password form
- Use `lovable.auth.signInWithOAuth("google", ...)` and `lovable.auth.signInWithOAuth("apple", ...)` from the Lovable Cloud managed auth
- Will use the Configure Social Login tool to generate the `src/integrations/lovable` module

---

### 5. Profile Section Updates

**File: `src/hooks/useAuth.tsx**`

- Add `gender` to the `StyleProfile` type and `fetchStyleProfile` query

**File: `src/pages/ProfileScreen.tsx**`

- Gender display will come through the updated StyleProfileEditor

---

### Files to modify

- `src/pages/CameraScreen.tsx` — extended RatingResult type, pass style profile to edge function
- `src/components/OutfitRatingCard.tsx` — clickable drip/confidence scores with tooltips
- `supabase/functions/rate-outfit/index.ts` — personalized prompt with profile data, drip/confidence reasons
- `src/pages/OnboardingScreen.tsx` — gender selection step
- `src/components/StyleProfileEditor.tsx` — gender picker
- `src/hooks/useAuth.tsx` — add gender to style profile type
- `src/pages/AuthScreen.tsx` — Google + Apple OAuth buttons
- `supabase/functions/analyze-body-profile/index.ts` — gender-aware analysis
- `supabase/functions/generate-model-avatar/index.ts` — gender-aware avatar
- `supabase/functions/style-me/index.ts` — gender-aware styling
- Database migration: add `gender` column to `style_profiles`