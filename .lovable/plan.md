## Plan: Premium Results Screen Redesign + Background Image Generation

Two major changes: (1) complete redesign of the OutfitRatingCard, CameraScreen, ScoreRing, and the share card capture template for a premium luxury aesthetic, and (2) allow users to close the wardrobe modal while AI generates images in the background.

---

### 1. OutfitRatingCard.tsx — Full Premium Redesign

**Photo section (hero):**

- Full-width `aspect-[3/4]` image with rounded-2xl corners and subtle shadow
- Soft gradient overlay at bottom: `from-black/60 via-black/30 to-transparent`
- "ClosetAI" branding top-left: small, `text-[10px] tracking-[0.2em] font-light text-white/80` — no pill/background, just clean text

**Score overlay on photo bottom:**

- Two small animated ScoreRings (size ~54px, stroke 3px) at bottom-left and bottom-right
- Drip ring: muted gold (`#C9A96E`), Confidence ring: soft silver (`#A8A8A8`)
- Score numbers inside: `text-sm font-light`
- Labels below rings: `text-[9px] uppercase tracking-[0.15em] text-white/50`
- Killer tag centered between them: `text-[11px] font-medium tracking-wider text-white/80` 

**Below photo — analysis section:**

- Clean card background, generous padding
- Occasion badge: `text-[10px] uppercase tracking-wider border border-border/40 rounded-full px-3 py-1`
- Praise line: `text-sm italic text-foreground/70 leading-relaxed` in serif font, no quotes wrapping, tasteful single emoji allowed
- Sub-scores row: three small ScoreRings (size 56px, stroke 3px) with muted colors — sage (`#8B9A7B`), gold (`#C9A96E`), rose (`#B08B8B`)
- "Tap for details" hint: `text-[9px] text-muted-foreground/40`
- Tooltips: light card background with `border border-border/50`, no dark backdrop
- Advice: clean text with thin `border-t border-border/20` separator, `text-sm text-foreground/60 leading-relaxed`

**Action buttons:**

- Single "Share Result" button: clean outline style, minimal — `border border-border/40 rounded-full px-5 py-2 text-xs tracking-wider`
- Download as secondary icon button next to it

**Suggestion cards:**

- Section headers: `text-xs uppercase tracking-[0.15em] text-foreground/50` — no icons
- Cards: white bg, `border border-border/20 rounded-xl p-4` — no colored backgrounds
- Category badges: `text-[9px] uppercase tracking-wider text-muted-foreground/60 border border-border/30`

---

### 2. Share Card Capture Template

- Background: clean dark charcoal `#1a1a1a`
- "ClosetAI" branding: `text-[10px] tracking-[0.25em] text-white/60` — not uppercase, not bold
- Score numbers: gold gradient text for Drip, silver for Confidence, `Inter` font medium weight
- Sub-score circles: thin 2px borders, muted tones
- Praise line: `Inter` italic, `#999` color
- CTA: `text-[9px] tracking-[0.2em] text-white/25`
- Killer tag: gen z slnags which can go viral and loved by gen z as our customer base will be young people 

---

### 3. ScoreRing.tsx — Refined

- Default stroke width: 3 (down from 6)
- Score text: `text-sm font-light` (down from `text-lg font-semibold`)
- Label: `text-[9px] uppercase tracking-[0.15em]` (down from `text-[11px]`)
- Track color: `stroke-border/20` instead of `stroke-secondary`

---

### 4. CameraScreen.tsx — Copy Updates

&nbsp;

- Subtitle: "Upload or capture your outfit for styling insights"
- "Check Another Photo" button: outline style instead of gradient

---

### 5. rate-outfit Edge Function — Refined Tone

Keep Gen Z friendly but elevate:

- `killer_tag`: refined but still catchy (e.g., "Effortless Chic", "Main Character", "Vibe Curator") with appropriate emojis
- `praise_line`: stylish and shareable, allow tasteful emojis but no slang overload. Examples: "Serving festive elegance ✨", "Fit check: passed."
- `advice`: professional stylist tone
- Keep scoring weights explicit in prompt: Color 25%, Style 20%, Fit 25%, Occasion 20%, Accessories 10%

---

### 6. Background Image Generation in Wardrobe

**File: `src/pages/WardrobeScreen.tsx**`

Currently the user is stuck on the modal while "Generating clean images..." runs. Change to:

- When user taps "Add X Item(s)", immediately close the modal and show a small persistent toast/banner at bottom saying "Generating images for X items..."
- Run the `handleSaveDetected` logic in the background (items get inserted as they finish)
- Use a ref or state outside the modal to track background generation
- On completion, show success toast and refresh items list
- If modal is reopened during generation, show a "Still generating..." indicator
- and allow user to add more while the previous is generatinga nd queue that

**Implementation approach:**

- Move `handleSaveDetected` logic to work independently of modal state
- Use `useRef` to track ongoing generation
- `resetModal()` called immediately after starting generation
- Progress tracked via state that persists outside modal
- Items added to `items` state as each one completes (already does this)

---

### Files to modify

- `src/components/OutfitRatingCard.tsx` — full premium redesign + share card
- `src/components/ScoreRing.tsx` — thinner, lighter
- `src/pages/CameraScreen.tsx` — updated copy
- `supabase/functions/rate-outfit/index.ts` — refined tone with scoring weights
- `src/pages/WardrobeScreen.tsx` — background image generation