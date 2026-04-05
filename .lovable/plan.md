

## Fix: Human Detection Gate + Actually Savage Roasts

### Problem Analysis

Looking at the screenshot: the image is a **screenshot of an app/text** with a tiny circular profile picture. The AI detected the tiny avatar as "a human" and scored the outfit — giving 6.5 drip and "CLASSIC COOL 😎" to what is essentially a text screenshot. Two failures:

1. **Human Check is too loose** — A tiny avatar/icon in a screenshot should NOT count as "human detected." The person must be the **dominant subject** occupying significant frame space.
2. **Savage mode roasts are tame** — "I rate fits not meals" energy is NOT savage. The user wants roasts that are genuinely abusive, hilarious, controversial — the kind that make people screenshot and share because they're laughing or outraged.

### Changes

**File: `supabase/functions/rate-outfit/index.ts`**

**1. Fix CALL1_SYSTEM prompt — Dominant subject rule**

Add to the human detection step:

```
DOMINANT SUBJECT RULE (CRITICAL):
A human counts ONLY if they are the DOMINANT subject of the image — taking up at least 30-40% of the frame and clearly wearing a visible outfit.
DO NOT count:
- Tiny profile pictures, avatars, or icons within screenshots
- Small figures in the background of a landscape
- Faces in memes, thumbnails, or embedded images
- People who are less than 20% of the frame
If the dominant content is text, a screenshot, a diagram, food, an object, etc. — it is NOT a fashion photo. ROAST IT.
```

**2. Overhaul roast prompts — Make them actually savage**

Replace the filtered roast prompt (lines 391-404) and the unfiltered roast prompt (`getUnfilteredRoastPrompt`, lines 291-313) with dramatically more aggressive versions:

**Filtered roast** — witty, sarcastic, slightly mean but shareable:
- Focus ONLY on the dominant thing in the image
- Funny enough to screenshot
- Has bite but not truly offensive

**Unfiltered/Savage roast** — genuinely abusive comedy:
- Think "roast battle" energy, comedy central roast vibes
- Cuss words encouraged for comedy
- Should make people either laugh until they cry or get genuinely mad
- Attack the dominant subject relentlessly
- Controversial takes that people share because they can't believe an AI said that
- One-liners that hit like a real person who trash-talks everything

Example energy for savage mode:
- Screenshot → "bro really sent me someone else's screen like I'm tech support 💀"
- Food → "the only thing getting cooked here is whatever the hell that is on the plate"
- Random object → "you could've sent literally anything else and it would've been a better use of my time"

**3. Add dominant-subject instruction to roast Call 2**

Both roast prompts should include: "Focus ONLY on the dominant subject — the thing taking up the most space. Ignore small elements, icons, watermarks, or background details."

**4. Strengthen isRoast gate**

Add an additional check: if `call1Result.drip_reason` or `call1Result.advice` contains "no human" or "not a fashion photo" signals, force roast mode even if sub-scores aren't all zero (in case AI gives non-zero scores despite saying no human).

### Files to edit
- `supabase/functions/rate-outfit/index.ts` (CALL1_SYSTEM prompt, roast prompts, isRoast logic)

