

## Plan: Fix Clothing Image Generation Prompts

### Problem
The `generate-clothing-image` edge function always generates images on a mannequin, regardless of item type. This causes:
1. Wrong gender mannequins (no gender passed to the function)
2. Glasses appearing on a mannequin chest instead of a face
3. Unnecessary mannequins for regular clothing items

### Solution

**File: `supabase/functions/generate-clothing-image/index.ts`**

- Accept `gender` as a new parameter from the client
- Use item type to determine the prompt strategy:
  - **Glasses/Eyewear & Jewelry/Accessories**: Show on a face/body with gender-appropriate context (e.g., "worn on a face", "worn on a wrist")
  - **All other clothing**: Flat-lay product photo on white background — NO mannequin. Just the garment laid out cleanly like an e-commerce product shot

**File: `src/pages/WardrobeScreen.tsx`**

- Pass `gender: styleProfile?.gender` to the `generate-clothing-image` function call (line 166)

### Prompt Logic (Edge Function)

```
if type is glasses/eyewear/sunglasses:
  → "worn on the face of a [gender] person, headshot, white background"
if type is jewelry/necklace/bracelet/ring/watch:
  → "worn on a [gender] person, close-up, white background"  
else:
  → "flat-lay product photograph on pure white background, neatly arranged, no mannequin, no person"
```

### Files to Change
| File | Change |
|------|--------|
| `supabase/functions/generate-clothing-image/index.ts` | Category-aware prompt, accept gender param |
| `src/pages/WardrobeScreen.tsx` | Pass gender to the edge function |

