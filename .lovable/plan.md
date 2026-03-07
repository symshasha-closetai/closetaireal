# Plan: Redesign Homepage, AI-Powered Onboarding with Photo Analysis, and Virtual Try-On

This is a significant overhaul spanning the onboarding flow, homepage UI, database schema, and the Style Me feature to match the reference design and add AI-generated body/face analysis plus virtual try-on.

---

## 1. Database Migration

Add columns to `style_profiles` for storing uploaded photos and AI analysis results:

```sql
ALTER TABLE public.style_profiles 
  ADD COLUMN IF NOT EXISTS face_photo_url text,
  ADD COLUMN IF NOT EXISTS body_photo_url text,
  ADD COLUMN IF NOT EXISTS ai_body_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_face_analysis jsonb,
  ADD COLUMN IF NOT EXISTS model_image_url text;
```

- `face_photo_url` / `body_photo_url`: stored uploaded face and full-body images
- `ai_body_analysis`: AI-detected body attributes (slim/fat, tall/short, proportions)
- `ai_face_analysis`: AI-detected face attributes (shape, skin tone, features)
- `model_image_url`: AI-generated avatar/model image based on analysis

---

## 2. New Edge Function: `analyze-body-profile`

**File: `supabase/functions/analyze-body-profile/index.ts**`

Accepts two base64 images (face + body). Uses `google/gemini-2.5-flash` (vision) to analyze:

- **Face**: shape (oval, round, etc.), skin tone, facial features
- **Body**: build (slim, athletic, curvy, plus-size), height estimate (tall/average/short), proportions

Returns structured JSON via tool calling. This replaces manual selection when photos are provided.

---

## 3. New Edge Function: `generate-model-avatar`

**File: `supabase/functions/generate-model-avatar/index.ts**`

Uses `google/gemini-2.5-flash-image` (image generation) to create a fashion model avatar based on the user's analyzed attributes (body type, skin tone, face shape, proportions). This generated image is used on the homepage and in virtual try-on previews.

---

## 4. New Edge Function: `virtual-tryon`

**File: `supabase/functions/virtual-tryon/index.ts**`

Uses `google/gemini-2.5-flash-image` with the user's model image + wardrobe item descriptions to generate an image of the model wearing the selected outfit. Called when "Style Me" generates suggestions — each suggestion gets a try-on preview.

---

## 5. Redesigned Onboarding (`OnboardingScreen.tsx`)

New flow with conditional steps:

**Step 1 — Photos (Face + Full Body)**

- Two upload areas: "Upload Face Photo" and "Upload Full Body Photo"
- Both use `capture="user"` / `capture="environment"` for native camera or gallery
- Upload images to storage, send to `analyze-body-profile` edge function
- AI auto-detects body type, skin tone, face shape

**Step 2 — Body Profile (CONDITIONAL: only shown if user skipped photos)**

- If photos were uploaded: skip this step entirely, show AI-detected results with option to override
- If skipped: show manual selection BUT with AI-generated example images for each body type and skin tone instead of SVGs/color swatches
- Body type cards show AI-generated realistic illustrations (generated once, stored as static assets or generated on-the-fly)
- Skin tones show realistic skin examples, not just color circles

**Step 3 — Style Preferences**

- Same as current but with AI-generated style example images and this can be edited from the profile section later on

**Step 4 — Model Generation + Done**

- Call `generate-model-avatar` with the analyzed profile
- Show the generated model image
- Save everything and proceed and editable later from profile section

---

## 6. Redesigned Homepage (`HomeScreen.tsx`) — Match Reference

Restructure to match the uploaded reference image:

- **Header**: ClosetAI logo centered, notification bell left, hamburger menu right
- **Greeting**: "Good morning, {name}!" with personalized text
- **My Wardrobe Card**: 
  - Grid of 4 wardrobe item thumbnails (showing actual clothing images)
  - Total count badge (e.g., "14") in top-right
  - Category labels below thumbnails (Tops, 12, Dresses, etc.) with counts
  - Favorites count with heart icon, favorites will be favoured while style me but it shouldn't hurt the color combination
  - and style me feature return clothes keeping in mind about the colour combination, likeability on face and body analysed by AI, season, region and material of the clothes
- **Pick an Occasion Card**:
  - Large occasion icon/illustration(add occassions like college, party, casual, cultural, and so but not more than 10) (cocktail glass for Party, etc.)
  - Current occasion name displayed prominently
  - Occasion photo preview on the right side (user's model image or fashion photo), model pose will change according to occassion
  - Time of day chips (Day, Evening, Night) below
- **Rate Your Outfit Card**: Camera icon + "Rate Your Outfit" with subtitle
- **Style Me Button**: Full-width gradient button at bottom

The key visual difference: the user's AI-generated model image is displayed prominently in the occasion section, showing a realistic representation of the user.

---

## 7. Virtual Try-On in Style Me Results

When "Style Me" returns outfit suggestions:

- For each outfit, call `virtual-tryon` to generate an image of the user's model wearing those clothes
- Show the try-on image alongside the outfit items in the results sheet
- This gives users a visual preview of how the outfit would look on them

---

## Files to Create/Edit


| Action       | File                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Create       | `supabase/functions/analyze-body-profile/index.ts`                                                                   |
| Create       | `supabase/functions/generate-model-avatar/index.ts`                                                                  |
| Create       | `supabase/functions/virtual-tryon/index.ts`                                                                          |
| Edit         | `src/pages/OnboardingScreen.tsx` — complete rewrite with photo-first flow, conditional manual selection, AI analysis |
| Edit         | `src/pages/HomeScreen.tsx` — redesign to match reference image layout                                                |
| Edit         | `src/hooks/useAuth.tsx` — expose style_profile data (model_image_url)                                                |
| Edit         | `src/components/AppHeader.tsx` — add notification bell and menu icon per reference                                   |
| DB Migration | Add face_photo_url, body_photo_url, ai_body_analysis, ai_face_analysis, model_image_url to style_profiles            |


---

## Implementation Order

1. Database migration (new columns)
2. `analyze-body-profile` edge function
3. `generate-model-avatar` edge function
4. Redesigned `OnboardingScreen.tsx`
5. Redesigned `HomeScreen.tsx`
6. `virtual-tryon` edge function
7. Wire try-on into Style Me results