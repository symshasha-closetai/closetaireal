

## Plan: Profile Enhancements + Wardrobe Outfit Count + Local Photo Storage

Four changes: (1) clear suggestion cache button in profile, (2) AI-derived style personality tag, (3) outfit count in wardrobe header, (4) local-only photo privacy notice + store photos locally.

---

### 1. Clear Suggestion Image Cache — Profile Body Tab

**File: `src/pages/ProfileScreen.tsx`**

Add a second button next to "Refresh All Illustrations" in the Body tab that clears suggestion image cache from localStorage (keys starting with `suggestion-img-` or matching the cache pattern from OutfitRatingCard).

Also add it to `useStyleProfileActions` in `StyleProfileEditor.tsx` as a `handleClearSuggestionCache` method that removes all `suggestion-img-*` keys from localStorage.

---

### 2. Style Personality Tag — Profile Below Avatar

**File: `src/pages/ProfileScreen.tsx`**

Below the avatar section, show a computed "style personality" badge (e.g., "Elegant Minimalist", "Streetcore", "Classic Sophisticate").

**Logic:** Analyze the user's wardrobe items (types, styles, materials) and style preferences to derive a personality tag. Create a helper function `computeStylePersonality` that:
- Fetches wardrobe items from Supabase (types, materials, colors, brands)
- Combines with `styleProfile.style_type` preferences
- Maps dominant patterns to personality labels:
  - Mostly formal/classic materials → "Classic Sophisticate"
  - Streetwear-heavy → "Streetcore"
  - Minimalist preferences + neutral colors → "Elegant Minimalist"
  - Mix of vintage + modern → "Vintage Rebel"
  - Sporty/gym items dominant → "Athleisure Icon"
  - Bohemian preferences → "Boho Spirit"
  - Smart casual mix → "Smart Casual"
  - Default fallback → "Style Explorer"
- Cache result in localStorage with a 1-day TTL
- Display as a subtle badge: `text-[11px] tracking-wider text-primary/70 bg-primary/5 border border-primary/10 rounded-full px-3 py-1`

---

### 3. Outfit Count in Wardrobe Header

**File: `src/pages/WardrobeScreen.tsx`**

Below the existing `{items.length} items` text, add a line showing potential full outfits count.

**Logic:** Count items by category (Tops, Bottoms, Shoes). Full outfits = `min(topsCount, bottomsCount, shoesCount)`. Display as: `"~{count} full outfits possible"` in `text-[11px] text-muted-foreground/60`.

---

### 4. Local Photo Privacy Notice + Store Photos Locally

**File: `src/pages/ProfileScreen.tsx`**

In the Personal tab, add a privacy notice card below the avatar:
- Small card with a lock icon: "Your photos are stored locally on your device only"
- `text-[10px] text-muted-foreground` with a subtle `bg-secondary/30 border border-border/20 rounded-xl p-3`

For the avatar, keep it uploading to storage (needed for cross-device access), but add the notice specifically about drip check photos being local-only (which they already are — stored in localStorage).

---

### Files to modify
- `src/pages/ProfileScreen.tsx` — cache clear button, style personality badge, privacy notice
- `src/components/StyleProfileEditor.tsx` — add `handleClearSuggestionCache` to actions hook
- `src/pages/WardrobeScreen.tsx` — outfit count line

