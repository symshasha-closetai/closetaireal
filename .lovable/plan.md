

## Plan: Re-crop Existing Photo + Fix Share Button

### 1. Add Re-crop Button on Today's Look Card

In `src/pages/HomeScreen.tsx`, add a Crop icon button next to the Camera button (top-right area). When clicked, it loads the existing `todayPhoto` URL into `pendingCropImage` to open the cropper. On confirm, the cropped blob goes through the same upload flow (`handleCroppedPhoto`).

### 2. Fix Slow/Broken Share Button

The share uses `html2canvas` with `useCORS: true` on a card containing a Supabase storage image. Cross-origin fetching through canvas is unreliable and slow.

**Fix**: Instead of capturing the DOM with html2canvas, draw the share card manually on a canvas:
- Fetch the photo as a blob directly (same-origin via Supabase public URL)
- Draw it on a canvas at the correct aspect ratio
- Overlay the gradient, text (daily tag, date, streak) programmatically using canvas API
- Export as PNG blob for sharing/download

This avoids html2canvas entirely for the Today's Look share, making it near-instant.

### 3. Fix ImageCropper Accessibility Warnings

Add a visually hidden `DialogTitle` and `aria-describedby={undefined}` to suppress the console errors about missing title/description.

### Files Modified
- `src/pages/HomeScreen.tsx` -- add re-crop button, replace html2canvas share with canvas-drawn approach
- `src/components/ImageCropper.tsx` -- add hidden DialogTitle for accessibility

