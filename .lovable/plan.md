

# Plan: Onboarding Flow, AI Style Me, and AI Outfit Rating with Shareable Card

## Overview

Three major features: (1) post-signup onboarding wizard, (2) real AI-powered Style Me suggestions, and (3) real AI outfit rating with a shareable results card and improvement suggestions.

---

## 1. Onboarding Flow (after signup)

**New file: `src/pages/OnboardingScreen.tsx`**
- Multi-step wizard (3-4 steps) with framer-motion transitions:
  - **Step 1 — Profile Photo**: Upload avatar (reuse existing avatar upload logic from ProfileScreen)
  - **Step 2 — Body Info**: Select body type (Hourglass, Pear, Rectangle, Apple, Inverted Triangle), skin tone (Fair, Light, Medium, Olive, Dark, Deep), face shape (Oval, Round, Square, Heart, Oblong)
  - **Step 3 — Style Preferences**: Pick preferred styles (Casual, Formal, Streetwear, Minimalist, Bohemian, Classic, Sporty) — multi-select chips
  - **Step 4 — Complete**: Welcome message, navigate to Home
- Saves data to `style_profiles` and `profiles` tables
- Skippable but encouraged

**Routing changes in `App.tsx`:**
- Add `/onboarding` route
- After signup, redirect to `/onboarding` instead of `/` (check if `style_profiles` row exists for user; if not, redirect to onboarding)

**Auth hook update (`useAuth.tsx`):**
- Add `hasCompletedOnboarding` flag by checking `style_profiles` table

---

## 2. AI Style Me — Real Outfit Suggestions

**New edge function: `supabase/functions/style-me/index.ts`**
- Accepts: user's wardrobe items (names, types, colors, materials), selected occasion, time of day, style profile (body type, style preferences)
- Uses Lovable AI (`google/gemini-3-flash-preview`) to generate 2-3 outfit combinations from the user's wardrobe
- Returns structured JSON via tool calling: array of outfits, each with top/bottom/shoes/accessories IDs, outfit name, score, and explanation

**Update `HomeScreen.tsx`:**
- "Style Me" button triggers loading state, calls `style-me` edge function with wardrobe data + occasion + time
- Shows results in a bottom sheet or new view: outfit cards with matched items from wardrobe, AI explanation, and occasion tag

**Update `supabase/config.toml`:**
- Add `[functions.style-me]` with `verify_jwt = false`

---

## 3. AI Outfit Rating with Shareable Card + Improvement Tips

**New edge function: `supabase/functions/rate-outfit/index.ts`**
- Accepts: base64 image of the outfit
- Uses Lovable AI (`google/gemini-3-flash-preview`) with vision to analyze the outfit
- Returns via tool calling: overall score, color score, style score, fit score, detected occasion, detailed advice, improvement suggestions (array of tips like "swap to a brown belt", "add gold earrings"), and purchase recommendations (items not in wardrobe that would improve the look)

**Update `CameraScreen.tsx`:**
- Replace `simulateAnalysis()` with real AI call to `rate-outfit` edge function
- After analysis, render a **Shareable Card** component:
  - User's photo, scores (Overall, Color, Style, Fit) in score rings, occasion badge, AI quote
  - "Share" button using Web Share API (`navigator.share`) or download as image (using html2canvas or similar — but to keep it simple, use Web Share API with text summary)
- Below the card, render **Improvement Suggestions** section:
  - "From Your Wardrobe" — items the AI suggests swapping in (matched against wardrobe data)
  - "Shopping Suggestions" — items to buy (text recommendations from AI)
  - Each suggestion shows item name, category, reason

**New component: `src/components/OutfitRatingCard.tsx`**
- Reusable shareable card with score rings, advice, and share button

**Update `supabase/config.toml`:**
- Add `[functions.rate-outfit]` with `verify_jwt = false`

---

## Database Changes

No schema changes needed — existing tables (`style_profiles`, `wardrobe`, `daily_ratings`, `outfits`) cover all requirements.

---

## Files to Create/Edit

| Action | File |
|--------|------|
| Create | `src/pages/OnboardingScreen.tsx` |
| Create | `supabase/functions/style-me/index.ts` |
| Create | `supabase/functions/rate-outfit/index.ts` |
| Create | `src/components/OutfitRatingCard.tsx` |
| Edit | `src/App.tsx` — add onboarding route + redirect logic |
| Edit | `src/hooks/useAuth.tsx` — add onboarding check |
| Edit | `src/pages/HomeScreen.tsx` — wire Style Me to edge function |
| Edit | `src/pages/CameraScreen.tsx` — real AI rating + shareable card + suggestions |
| Edit | `supabase/config.toml` — add new function configs |

