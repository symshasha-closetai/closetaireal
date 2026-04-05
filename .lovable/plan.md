

## Plan: Replace Copy Bank with Live AI Caption Generation

### Problem
The current system picks random pre-written captions from a static bank of 248 entries. These don't match the actual outfit — a guy in a suit might get "Bro Lost a Bet 💀". No AI, no sense, no sync.

### Fix
Replace the copy bank with a live AI call (Call 2) that sees what Call 1 detected and generates a fresh, contextual killer tag + praise line every single time.

### Architecture
```text
CURRENT (broken):
  Call 1 (scoring) → random pick from 248 static lines → done
  
FIXED:
  Call 1 (scoring + outfit_description) → Call 2 (live AI caption) → done
  If Call 2 fails → retry once → tiny fallback
```

### Changes

**File: `supabase/functions/rate-outfit/index.ts`**

1. **Delete** the entire `COPY_BANK` object (~248 entries), `pickFromBank()`, `pickRoastFromBank()`, and `getScoreTier()` functions

2. **Update Call 1 prompt** — add one field to the JSON output: `outfit_description` (10-15 word description of what the person is wearing). This gives Call 2 real context

3. **Add Call 2** — a new function `generateCaption()` that calls the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `google/gemini-2.5-flash`:
   - System prompt: the exact savage persona (savage best friend, Gen Z humor, chaotic but clever, focus only on outfit/vibe/confidence)
   - User message: outfit description from Call 1 + score + gender + scene type + mode (standard vs savage)
   - Uses **tool calling** for structured output — guarantees `{killer_tag, praise_line}` JSON, no parsing failures
   - Standard mode: witty, fun, clever comparisons
   - Savage mode: borderline viral, chaotic, "like a friend roasting you publicly"

4. **Add roast Call 2** — for non-human images, generate a live roast caption instead of picking from a static roast bank. Uses the roast category from Call 1 (FOOD/ANIMAL/MEME etc.)

5. **Hybrid fallback** — if Call 2 fails, retry once. If still fails, use 4 minimal generic lines (one per tier) instead of the massive bank

### Call 2 Details

The system prompt enforces:
- killer_tag: max 5 words, savage/funny
- praise_line: max 20 words, viral caption
- Structure: relatable setup → twist → punchline
- Mode-aware tone: standard = witty, savage = borderline viral chaos
- Gender-aware: "bro/my guy" for male, "bestie/queen" for female
- Scene-aware: plural language for couples/groups

Tool calling payload ensures structured JSON output — no `JSON.parse` failures.

### Expected Result
- Every caption is fresh, unique, and actually describes what the person is wearing
- Savage Mode produces genuinely funny, chaotic, screenshot-worthy content that syncs with the scene
- Adds ~1-1.5s latency (worth it for contextual results)
- Hybrid fallback ensures the app never breaks

