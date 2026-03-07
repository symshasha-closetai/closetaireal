# Plan: Split-Layout Home Screen, AI Example Images, Material Presets, Weather-Aware Styling

## Overview

Redesign the home screen with a split layout: AI model on the right, controls on the left. Add AI-generated example images to profile/style options. Add predefined material selection to wardrobe. Update Style Me to consider weather and material.

**Note on "3D model"**: True 3D avatar generation from photos is beyond current AI capabilities in this stack. Instead, we'll display the AI-generated photorealistic model prominently on the right side with a subtle parallax/depth effect using CSS transforms and framer-motion to give a 3D feel. The model already uses `gemini-3-pro-image-preview` with face/body reference photos for resemblance.

## 1. Home Screen Split Layout

**File: `src/pages/HomeScreen.tsx**`

Redesign from single-column to a two-panel layout (on wider screens) or stacked with model prominent:

- **Right panel**: Large AI model image (full height, with subtle parallax on scroll), face resembling the user
- **Left panel**: Occasion selector, time of day, Style Me button, Rate Outfit
- On mobile: model image at top (hero), controls below
- Add a 3D-like tilt effect on the model image using framer-motion's `useMotionValue` + `useTransform` for mouse/touch tracking

## 2. AI-Generated Example Images for Profile Options

**Files: `src/components/StyleProfileEditor.tsx`, `src/pages/OnboardingScreen.tsx**`

For body types, face shapes, and style preferences, replace emojis/text with AI-generated reference images:

- Create a new edge function `supabase/functions/generate-option-images/index.ts` that generates small example images for each option (e.g., "sporty style outfit on a male body", "hourglass body shape silhouette on a female body"), male or female body will be decided based on what the user last posted in the wardrobe 
- Pre-generate these images at build time or lazy-load on first view and cache in storage
- Better approach: use static prompts and generate on-demand, cache in `wardrobe` bucket under `option-images/` path
- Show small thumbnail previews next to each option so users can clearly see what each style/body type looks like

**New edge function: `supabase/functions/generate-option-images/index.ts**`

- Accepts `{ category: "body_type"|"style"|"face_shape", label: string }`
- Returns a generated example image
- Uses `gemini-2.5-flash-image` for speed

**Client changes**:

- On mount, check if cached images exist in storage for each option
- If not, generate lazily and store
- Show skeleton loaders while generating

## 3. Predefined Material Selection in Wardrobe

**File: `src/pages/WardrobeScreen.tsx**`

Replace the free-text material input in detected items with a dropdown of predefined options:

- Cotton, Linen, Polyester, Silk, Wool, Denim, Leather, Nylon, Chiffon, Velvet, Satin, Other
- Keep "Other" option that shows a text input for custom materials
- Apply to both AI-detected items editing and manual add mode
- allow editing in added clothes in wardrobe

## 4. Weather + Material Awareness in Style Me

**File: `supabase/functions/style-me/index.ts**`

- Accept optional `weather` parameter (or auto-detect from client using a free weather API or browser geolocation)
- Add material to the consideration factors in the system prompt
- Update prompt to explicitly mention: "Consider the weather conditions, material breathability and comfort, and how fabrics interact with temperature and humidity"

**File: `src/pages/HomeScreen.tsx**`

- Add a weather indicator/selector (could use browser geolocation + a free weather API, or manual selection: Hot, Warm, Cool, Cold, Rainy)
- Pass weather + material info to style-me function

## Files to Create/Edit


| File                                                 | Change                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/pages/HomeScreen.tsx`                           | Split layout with model on right, controls on left, weather selector, 3D tilt effect |
| `src/pages/WardrobeScreen.tsx`                       | Material dropdown with presets (Cotton, Linen, etc.)                                 |
| `supabase/functions/style-me/index.ts`               | Add weather + material awareness to prompt                                           |
| `src/components/StyleProfileEditor.tsx`              | Add AI-generated example images for options                                          |
| `src/pages/OnboardingScreen.tsx`                     | Add AI-generated example images for body/style options                               |
| `supabase/functions/generate-option-images/index.ts` | New: generate example images for style/body options                                  |


## Implementation Order

1. Home screen split layout with model on right + 3D tilt effect
2. Weather selector on home screen + update style-me function
3. Material presets dropdown in wardrobe
4. AI-generated option images edge function
5. Integrate option images into StyleProfileEditor and OnboardingScreen