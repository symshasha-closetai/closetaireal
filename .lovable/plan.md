

## Plan: Reorganize Profile into Tabbed Categories + Drip History + Wardrobe Sharing

Restructure the cluttered Profile screen into clean tabbed sections, add a drip history tab with saved shareable cards, and add sharing capabilities to wardrobe items. Also requires a new `brand` column on the wardrobe table.

---

### 1. Profile Screen — Tabbed Layout

**File: `src/pages/ProfileScreen.tsx`**

Replace the single scrolling page with a horizontal tab bar using Radix Tabs. Four tabs:

**Tab: Personal**
- Avatar upload (existing)
- Display Name input
- Gender selector (moved from StyleProfileEditor)
- Email (read-only)
- Change Password button (calls `supabase.auth.updateUser`)
- Save button

**Tab: Personality**
- AI Model preview (moved from StyleProfileEditor)
- Re-upload face/body photos (moved from StyleProfileEditor)
- Body Type picker (moved from StyleProfileEditor)
- Skin Tone picker (moved from StyleProfileEditor)
- Face Shape picker (moved from StyleProfileEditor)
- Refresh Illustrations button (moved from StyleProfileEditor)
- Save & Regenerate Model button

**Tab: Styling**
- Style Preferences multi-select (moved from StyleProfileEditor)
- Save button

**Tab: History**
- Drip History — saved rating cards (see section 3)
- Outfit History — list of past checked outfits from `daily_ratings` table

Bottom of all tabs: Sign Out + Delete Account buttons (always visible)

---

### 2. Refactor StyleProfileEditor

**File: `src/components/StyleProfileEditor.tsx`**

Break into smaller exportable sub-components so ProfileScreen tabs can import them individually:
- `GenderPicker` — gender selection grid
- `BodyProfileSection` — AI model preview, photo re-upload, body type, skin tone, face shape pickers
- `StylePreferencesSection` — style multi-select
- Keep `handleSaveAndRegenerate`, `handleReuploadPhotos`, `handleRefreshIllustrations` logic accessible

---

### 3. Drip History Tab

**New behavior in `CameraScreen.tsx`:**
- After a successful rating, save the share card image (compressed) to localStorage with key `drip-history-{timestamp}`
- Store metadata: `{ image, score, killerTag, praiseLine, timestamp }`

**In History tab:**
- Display saved drip cards as a grid of thumbnails
- Tap to view full card
- Each card has Share and Delete buttons
- Share uses `navigator.share()` or downloads PNG
- Delete removes from localStorage

---

### 4. Database Migration — Add `brand` to wardrobe

Add a nullable `brand` text column to the `wardrobe` table so items can store brand names.

```sql
ALTER TABLE public.wardrobe ADD COLUMN brand text;
```

Update `analyze-clothing` edge function prompt to also detect/return `brand` if visible.

---

### 5. Wardrobe Sharing

**File: `src/pages/WardrobeScreen.tsx`**

- Add `brand` field display on wardrobe item cards (small badge under name)
- Add `brand` field to edit form
- Add share button on each wardrobe item card — generates a shareable image card with:
  - Item photo
  - Item name + brand
  - ClosetAI branding + CTA
- Add multi-select mode: long-press or "Select" button to toggle selection, then "Share X items" button generates a collage card with all selected items, brand names, and ClosetAI branding

---

### 6. Update Types

- Update `ClothingItem` type in WardrobeScreen to include `brand`
- Update `DetectedItem` type to include `brand`
- Update `analyze-clothing` edge function to return `brand` field

---

### Files to modify
- `src/pages/ProfileScreen.tsx` — complete rewrite with Tabs
- `src/components/StyleProfileEditor.tsx` — break into sub-components
- `src/pages/CameraScreen.tsx` — save drip cards to localStorage on rating
- `src/pages/WardrobeScreen.tsx` — brand display, share single/multi items
- `supabase/functions/analyze-clothing/index.ts` — detect brand
- Database migration: add `brand` column to `wardrobe`

