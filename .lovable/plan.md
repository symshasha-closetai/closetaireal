

## Plan: Optimize Image Upload Pipeline for AI Latency

### Problem
`CameraScreen.runAnalysis` reads the raw file as base64 without compression — large phone photos (5-10MB) are sent directly to Gemini, causing slow API responses. The `compressImage` utility exists but isn't used in the drip check flow.

### Changes

#### 1. Update `compressImage` defaults (`src/lib/imageCompression.ts`)
- Change default `maxWidth`/`maxHeight` from 1200 → **800**
- Add iterative quality reduction: start at 0.7, if blob > 300KB, retry at 0.5, then 0.3
- This ensures all images sent to AI are under 300KB while maintaining visual quality for fashion analysis

#### 2. Use `compressImage` in drip check (`src/pages/CameraScreen.tsx`)
- In `runAnalysis`, replace the raw `FileReader` base64 conversion with `compressImage(file, 800, 800)`
- Use the returned `base64` directly (already stripped of data URL prefix)
- Update progress stage to "Compressing image..." at the start (progress: 5)
- Move "Reading your outfit..." to after compression (progress: 15)

#### 3. Use `compressImage` in wardrobe analysis (`src/pages/WardrobeScreen.tsx`)
- In `handleFileSelected`, the file is already compressed before `analyze-clothing` call — verify it uses the updated 800px defaults
- If it's using custom params, align to 800px max

### Files Modified
- `src/lib/imageCompression.ts` — lower defaults to 800px, add size-capping loop
- `src/pages/CameraScreen.tsx` — use `compressImage` instead of raw FileReader
- `src/pages/WardrobeScreen.tsx` — ensure wardrobe upload uses same 800px compression

