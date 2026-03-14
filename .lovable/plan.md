

## Plan: On-Demand Suggestions After Drip Check

### Problem
Currently, wardrobe and shopping suggestions are always included in the drip check result and rendered immediately (shopping images auto-generate too). The user wants suggestions to only appear when explicitly requested via buttons.

### Changes

#### 1. Split Drip Check from Suggestions (`supabase/functions/rate-outfit/index.ts`)
- Remove `wardrobe_suggestions` and `shopping_suggestions` from the rate-outfit prompt entirely
- This makes the drip check faster and cheaper (less output tokens)
- The drip result will only contain scores, killer_tag, praise_line, advice, occasion

#### 2. Add Two Suggestion Buttons to OutfitRatingCard (`src/components/OutfitRatingCard.tsx`)
- After the advice/action buttons section, show two stacked buttons:
  - "Get Wardrobe Suggestions" (Shirt icon)
  - "Get Shopping Suggestions" (ShoppingBag icon)
- Each button triggers a new edge function call to generate suggestions on demand
- Once loaded, replace the button with the existing suggestion list UI
- Add state: `showWardrobe` / `loadingWardrobe` / `wardrobeSuggestions` and same for shopping

#### 3. New Edge Function: `generate-suggestions` (`supabase/functions/generate-suggestions/index.ts`)
- Accepts: `imageBase64`, `wardrobeItems`, `styleProfile`, `type` ("wardrobe" | "shopping")
- Uses `gemini-2.5-flash-lite` with fallback to `gemma-3-4b-it` (light text task)
- Returns only the relevant suggestions array
- Wardrobe suggestions reference user's wardrobe items; shopping suggestions include `image_prompt`

#### 4. Update RatingResult Type (`src/pages/CameraScreen.tsx`)
- Make `wardrobe_suggestions` and `shopping_suggestions` optional in the type (they won't come from rate-outfit anymore)

#### 5. Pass imageBase64 to OutfitRatingCard
- Already passed as prop — ensure it's available for the suggestion function calls

### Files Modified
- `supabase/functions/rate-outfit/index.ts` — remove suggestions from prompt
- `supabase/functions/generate-suggestions/index.ts` — new function for on-demand suggestions
- `src/components/OutfitRatingCard.tsx` — replace auto-render with two buttons + lazy loading
- `src/pages/CameraScreen.tsx` — make suggestion types optional

