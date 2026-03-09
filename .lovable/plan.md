

## Plan: Share Card as Image

**Goal**: When sharing, capture the actual rendered card (brand name, killer tag, photo, drip/confidence scores) as an image, with the praise line + emojis rendered below the card in the shared image.

### Approach

Use `html2canvas` to screenshot the card DOM element and share/download the resulting image.

### Changes

**1. Add dependency**: `html2canvas-pro` (or `html2canvas`)

**2. Update `OutfitRatingCard.tsx`**:
- Add a `ref` to the shareable card container
- Create a hidden "share version" of the card that includes:
  - The existing card content (ClosetAI branding, photo with killer tag, drip score, confidence rating, occasion, sub-scores)
  - Below the card: praise line with fire/sparkle emojis, styled for sharing
  - Bottom CTA: "Check your drip score → closetaireal.lovable.app"
- On share tap:
  1. Render the share-version element (briefly visible or off-screen)
  2. Use `html2canvas` to capture it as a canvas → blob → File
  3. Share via `navigator.share({ files: [file] })` or fallback to download
  4. Clean up

**3. Share card layout** (captured as image):
```text
┌─────────────────────────┐
│  ClosetAI          🔥   │
│                         │
│   [Outfit Photo]        │
│       "Killer Tag" 🔥   │
│                         │
│  8.5/10    9.2/10       │
│  Drip      Confidence   │
│  ┌────┐ ┌────┐ ┌────┐  │
│  │Color│ │Style│ │ Fit │ │
│  └────┘ └────┘ └────┘  │
├─────────────────────────┤
│ 🔥 "Praise line" ✨     │
│                         │
│ Check your drip score → │
│ closetaireal.lovable.app│
└─────────────────────────┘
```

### Files

| File | Change |
|------|--------|
| `package.json` | Add `html2canvas` dependency |
| `src/components/OutfitRatingCard.tsx` | Add ref-based card capture, hidden share layout with praise + CTA, update `handleShare` to generate image from DOM |

