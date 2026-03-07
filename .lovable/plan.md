

# Plan: Wardrobe UX Fixes, Dark/Light Mode Toggle, Mannequin-Style Images, Enhanced Rating Card, and AI-Generated Suggestion Images

## Issues Identified

1. **"Generating clean images" button gets cut off** — it's inside the modal at the bottom but gets hidden by the bottom nav or viewport edge
2. **No dark/light mode toggle** — the app has `.dark` CSS variables but no `ThemeProvider` or toggle. The user's browser extension (Dark Reader) provides the dark look, not the app itself
3. **Clothing images should show on a mannequin** matching the user's body proportions, not flat-lay
4. **Rating card needs**: uploaded photo with scores, Gen Z praising caption, clickable scores showing reasoning, and real/AI-generated images for suggestions (not icons)
5. **Shopping suggestions show generic icons** instead of realistic product images

---

## 1. Add Dark/Light Mode Toggle

**Files: `src/App.tsx`, `src/components/AppHeader.tsx`**

- Wrap the app with `ThemeProvider` from `next-themes` (already installed)
- Add a sun/moon toggle button in `AppHeader` replacing the bell icon or alongside it
- This makes `dark:` classes work properly and gives users explicit control

## 2. Fix "Generating clean images" Visibility

**File: `src/pages/WardrobeScreen.tsx`**

- Add `mb-20` padding at the bottom of the modal content so the generating progress button is always visible above the bottom nav
- Move the progress indicator above the save button as a separate element, not inside it

## 3. Mannequin-Style Clothing Images Instead of Flat-Lay

**File: `supabase/functions/generate-clothing-image/index.ts`**

Update the prompt from flat-lay to mannequin style:
- "Generate a photorealistic image of this clothing item displayed on a mannequin/dress form that matches these body proportions: [user's body type]. Show the complete garment on the mannequin against a clean white/light gray background. No face, just a body form. Professional fashion photography style."
- Accept optional `bodyType` parameter from the client to match proportions

**File: `src/pages/WardrobeScreen.tsx`**
- Pass user's body type from style profile to `generate-clothing-image`

## 4. Enhanced Outfit Rating Card

**File: `src/components/OutfitRatingCard.tsx`**

Major redesign:
- **Photo prominent at top** with scores overlaid
- **Gen Z praising caption** — add `praise_line` to the rating result (a trendy, Gen Z-style compliment like "main character energy fr fr" or "this fit is giving everything it needs to give")
- **Clickable scores** — each `ScoreRing` becomes tappable. On tap, show a small tooltip/popover with the reasoning for that score (transparent backdrop)
- **AI-generated images for shopping suggestions** — instead of category icons, generate product images for each shopping suggestion

**File: `supabase/functions/rate-outfit/index.ts`**

Add to the tool schema:
- `praise_line`: Gen Z trending praise caption
- Per-score reasoning: `color_reason`, `style_reason`, `fit_reason`, `overall_reason`
- `shopping_suggestions[].image_prompt`: a short description AI can use to generate a product image

## 5. AI-Generated Images for Shopping Suggestions

**File: `src/components/OutfitRatingCard.tsx`**

For shopping suggestions without wardrobe matches:
- Call `generate-clothing-image` (without a source image, just from text) to generate a product image for each suggestion
- Show a loading skeleton while generating
- Cache results in component state

Alternatively, generate these images server-side in `rate-outfit` to avoid multiple round-trips. But that would make the rating very slow. Better approach: show icons initially, then lazy-load AI images.

---

## Files to Create/Edit

| File | Change |
|------|--------|
| `src/App.tsx` | Add `ThemeProvider` from next-themes |
| `src/components/AppHeader.tsx` | Add sun/moon dark mode toggle |
| `src/pages/WardrobeScreen.tsx` | Fix modal bottom padding, pass bodyType to image gen |
| `supabase/functions/generate-clothing-image/index.ts` | Change prompt from flat-lay to mannequin style with body proportions |
| `src/components/OutfitRatingCard.tsx` | Add Gen Z caption, clickable score tooltips, lazy-load AI images for suggestions |
| `supabase/functions/rate-outfit/index.ts` | Add `praise_line`, per-score `*_reason` fields, `image_prompt` for shopping items |
| `supabase/functions/generate-suggestion-image/index.ts` | New: generate product images from text descriptions for shopping suggestions |

## Implementation Order

1. Dark/light mode toggle (App.tsx + AppHeader.tsx)
2. Fix wardrobe modal "generating" visibility
3. Update generate-clothing-image to mannequin style
4. Update rate-outfit edge function with new fields
5. Redesign OutfitRatingCard with all enhancements
6. Create suggestion image generation (lazy-load in rating card)

