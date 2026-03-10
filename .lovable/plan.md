

## Plan

### 1. Desktop layout: Full-size model on right, options on left
The current layout already has left/right split on `lg:`, but on mobile the model appears first (`order-1`) and controls second (`order-2`). On desktop, the model panel width is `lg:w-[340px]` which is small. Will:
- Increase model panel to `lg:w-[420px]` for a more prominent full-body display
- Keep mobile order as-is (model on top, controls below) since that's natural for mobile
- Ensure `object-contain` is used so the full body shows without cropping

### 2. Remove/simplify page transition animations
The `container`/`item` stagger animation with `framer-motion` can cause visual stutter when navigating. Will:
- Remove the `motion.div variants={container}` wrapper and `variants={item}` from all children in HomeScreen
- Replace with simple `div` elements — no entry animation that can get stuck
- Keep button press animations (scale on tap) since those are instant

### 3. Fix Home button in BottomNav being obscured
The screenshot shows the Home button appears shadowed/covered. The issue is the `gradient-accent opacity-10` active indicator background blending poorly. Will:
- Increase opacity of the active tab indicator or change it to a solid subtle background
- Ensure the Home icon and label are clearly visible when active

### Files to modify
- `src/pages/HomeScreen.tsx` — Remove stagger animations, widen model panel
- `src/components/BottomNav.tsx` — Fix active tab visibility

