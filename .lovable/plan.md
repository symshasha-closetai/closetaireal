

## Plan: Swap Camera and Wardrobe in Navigation

The user wants to interchange the Camera and Wardrobe tabs in the bottom navigation — so Camera appears before Wardrobe.

### Changes

**`src/components/BottomNav.tsx`**
- Swap the tab order: Home → **Camera** → **Wardrobe** → Profile (currently Home → Wardrobe → Camera → Profile)

**`src/App.tsx`**
- Swap the route order to match (cosmetic consistency, no functional impact)

This is a straightforward 2-line swap in the tabs array. No other files need changes since routes are path-based, not order-dependent.

