

# Replace Placeholder Logo with Uploaded Dripd Logo

## What
Copy the uploaded Dripd logo image to replace all placeholder logo files across the project.

## Changes

1. **Copy uploaded logo to public directory** as `public/dripd-logo-192.webp` (used in `index.html` preload, `SplashScreen`, `AuthScreen`, `LeaderboardTab`, service worker precache)

2. **Copy to src/assets** as `src/assets/dripd-logo.webp` and `src/assets/dripd-logo.png` (used in share cards / watermarks in `HomeScreen`, `WardrobeScreen`, `ProfileScreen`)

3. **Update `index.html`** — add a favicon link pointing to the new logo

4. **Note on dark mode**: The logo is white text on black background. The `SplashScreen` already applies `dark:brightness-0 dark:invert` for dark mode compatibility. For light mode, the black background will be visible — may need to add a CSS filter or use the logo as-is if that's the intended look.

## Files
- Copy: `user-uploads://WhatsApp_Image_2026-03-21_at_2.09.19_PM.jpeg` → `public/dripd-logo-192.webp`, `src/assets/dripd-logo.webp`, `src/assets/dripd-logo.png`
- Edit: `index.html` (add favicon)

