

# Plan: Faster Analysis with Skip, AI-Generated Wardrobe Images, and Realistic Model Avatar

## 1. Add Skip Button During AI Analysis (OnboardingScreen.tsx)

During the analyzing state (lines 297-312), add a "Skip" button that:
- Cancels the analysis wait and goes to step 1 (manual body profile selection)
- Uses `AbortController` to cancel the fetch if possible
- Shows estimated time remaining and a "Skip for now" button below the progress bar

## 2. Use Faster AI Model for Body Analysis (analyze-body-profile edge function)

Switch from `google/gemini-2.5-flash` to `google/gemini-2.5-flash-lite` for faster analysis. The lite model is sufficient for detecting body type, skin tone, and face shape — it's the fastest option available.

## 3. AI-Generated Clean Product Images for Wardrobe

**New edge function: `supabase/functions/generate-clothing-image/index.ts`**

After `analyze-clothing` detects items, for each detected item:
- Call `google/gemini-2.5-flash-image` with the original photo + prompt: "Extract and generate a clean, realistic product photo of ONLY the [item name] ([color] [material]) from this image. Show it flat-lay on a white background, photorealistic, no mannequin, no person."
- Upload the generated image to storage
- Use this generated image as `image_url` in the wardrobe instead of the raw upload

**Changes to `WardrobeScreen.tsx`:**
- After AI detects items, call `generate-clothing-image` for each selected item during save
- Show a "Generating clean images..." progress state
- Store the AI-generated image URL, not the raw uploaded photo

## 4. Realistic AI Model That Resembles the User (generate-model-avatar edge function)

The current prompt says "fashion illustration" which produces cartoon-like results. Fix:

- Change prompt to emphasize **photorealistic** rendering that closely resembles the uploaded photos
- Pass both the face and body photos as reference images alongside the text description
- Update the prompt: "Generate a photorealistic full-body photo of a person with these exact characteristics... The result should look like a real photograph, NOT an illustration or cartoon. Match the person's actual appearance from the reference photos as closely as possible."
- Use `google/gemini-3-pro-image-preview` instead of `gemini-2.5-flash-image` for higher quality
- Accept `facePhotoUrl` and `bodyPhotoUrl` params so the AI can use them as visual references

**Changes to `generate-model-avatar/index.ts`:**
- Accept optional `facePhotoUrl` and `bodyPhotoUrl` in request body
- Include reference images in the prompt as image_url content
- Rewrite prompt for photorealism instead of illustration style

**Changes to `OnboardingScreen.tsx`:**
- Pass `facePhotoUrl` and `bodyPhotoUrl` to `generate-model-avatar` so the AI can reference the real person

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/OnboardingScreen.tsx` | Add skip button during analysis, pass photo URLs to model generator |
| `supabase/functions/analyze-body-profile/index.ts` | Switch to `gemini-2.5-flash-lite` for speed |
| `supabase/functions/generate-model-avatar/index.ts` | Photorealistic prompt, accept reference photos, use `gemini-3-pro-image-preview` |
| `supabase/functions/generate-clothing-image/index.ts` | New function: generate clean product photos from uploaded images |
| `src/pages/WardrobeScreen.tsx` | Generate clean product images during save instead of using raw upload |
| `src/components/StyleProfileEditor.tsx` | Pass photo URLs when regenerating model |

