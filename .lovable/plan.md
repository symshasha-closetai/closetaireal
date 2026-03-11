

## Plan: Loading Skeleton for AI Avatar + Full-Screen Outfit Detail View

### 1. Loading Skeleton for AI Avatar Generation

**Current**: When generating, a spinning Sparkles icon overlays the existing image (lines 452-458). If no model URL exists, it shows a static placeholder with no loading indication.

**Change**: Replace the spinner overlay with a proper skeleton loading state:
- When `generatingModel` is true and no existing image, show a pulsing skeleton with shimmer effect (silhouette shape, animated gradient)
- When `generatingModel` is true and image exists, show the skeleton overlay instead of the spinning icon
- Use the existing `Skeleton` component from `src/components/ui/skeleton.tsx` as base

### 2. Full-Screen Outfit Detail View (Reference Screenshot)

**Current**: Outfit suggestions show in a bottom sheet as a scrollable list of cards (lines 491-587). Clicking an outfit does nothing special.

**Change**: Add a new state `selectedOutfitIdx` to track which outfit card is tapped. When tapped, show a **full-screen overlay** matching the reference screenshot design:

- Full-screen white/card background with X button top-right
- "AI Selected the Perfect Outfit for You" heading
- Outfit items displayed as overlapping product images (like the screenshot)
- Score display: `Score: X.X` with "Matches better than X%" text
- Color Matching Score with a `ScoreRing` component (already exists)
- Explanation text below
- "Rate Your Outfit" button (navigates to camera) and "Try a Different Look" link (closes detail)
- Reasoning cards grid below
- Occasion + Time badges at top

### Files to modify
- `src/pages/HomeScreen.tsx` — both changes (skeleton + full-screen detail)

### Implementation details
- New state: `selectedOutfitIdx: number | null`
- Each outfit card in the results sheet gets an `onClick` to set `selectedOutfitIdx`
- Full-screen view renders as a `motion.div` with `fixed inset-0 z-[60]` (above the results sheet)
- X button resets `selectedOutfitIdx` to null
- Skeleton uses `animate-pulse` with rounded shapes mimicking a human silhouette

