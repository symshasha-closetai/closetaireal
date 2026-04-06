## Plan: Integrate Full 6-Step DRIPD Prompt Structure

### What Changes

Replace the current short system prompts (`CAPTION_SYSTEM_SAVAGE`, `CAPTION_SYSTEM_STANDARD`, `ROAST_SYSTEM`) with your detailed 6-step prompt structure. This single mega-prompt handles everything: human check roasts, scene detection, killer tags, gender-gated praise lines, social chaos, and cuss word rules. Direct lovable API — no gateway.

### File: `supabase/functions/rate-outfit/index.ts`

**1. Replace `CAPTION_SYSTEM_SAVAGE**` with your full Steps 0–6 prompt (the exact text you provided). This becomes the savage mode system prompt for Call 2. Key differences from the current prompt:

- `killer_tag` becomes 2–3 words (no emoji requirement)
- `praise_line` becomes one raw sentence (no period, no word limit trick)
- Hard gender gates: male = loud hype + cuss, female ≥8 = cold flirty only, female <8 = bestie chaos
- Built-in roast categories with specific lines per category
- Cuss words used freely as hype tools (bitch, fuck, motherfucker, etc.)

**2. Replace `CAPTION_SYSTEM_STANDARD**` with the same 6-step structure but **without the cuss word rules** — Steps 0–5 stay identical (roast categories, scene read, killer tag mapping, gender tones) but Step 6 Voice Rules removes the unfiltered cuss word permission. Praise lines stay witty/clever without profanity. The gender tone gates (male hype, female flirty at ≥8, bestie below) still apply.

**3. Replace `ROAST_SYSTEM**` — roast handling is now built into the main prompt (Step 0). Update `generateRoastCaption()` to use the same savage/standard prompt with a user message indicating "no human detected, category: X". The response now returns `{"killer_tag": null, "praise_line": null, "error": "roast", "roast_line": "..."}` — update parsing to extract `roast_line` and map it to the existing `praise_line` field for UI compatibility.

**4. Update `generateCaption()` user message** — pass `face_hidden` boolean from Call 1 (already detected) so the prompt can trigger face-hidden overrides for killer tag and praise line.

**5. Update roast response mapping** — when Call 2 returns `error: "roast"`, map `roast_line` → `praise_line` and set `killer_tag` to a fallback like "Wrong Photo 💀" so the UI displays correctly.

**No changes to**: Call 1, scoring logic, `callGemini()`, UI components, share card, fallback captions, CORS.

### Architecture (unchanged)

```text
Call 1: Direct Gemini API (gemini-2.5-flash-lite, temp 0.3) → scores + outfit_description + face_hidden
Call 2: Direct lovable API temp 0.9) → killer_tag + praise_line (using full 6-step prompt)
```

### Why This Works

- The 6-step structure gives the model explicit score→tone mappings with example lines, eliminating tone drift
- Hard gender gates (non-negotiable rules + final check) prevent the model from blending male/female tones
- Built-in roast categories with pre-written lines ensure non-human images get category-matched responses
- Face-hidden overrides are now explicitly handled in the prompt
- Same direct Gemini API, same API keys, zero new dependencies