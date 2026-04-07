## Plan: Apply All Custom Prompts to Edge Functions

Now that all four prompts are provided, here's how they'll be applied.

### Step 1: Update `supabase/functions/rate-outfit/index.ts`

**Replace `callGemini()` with `callOpenAI()**` — same JSON parsing logic, but hits `https://api.openai.com/v1/chat/completions` with model `gpt-4.1` and `Bearer ${OPENAI_API_KEY}`. Remove `getApiKey()` (Gemini key rotation).

**Replace `CALL1_SYSTEM` (lines 59-99)** with the user's drip check prompt:

- "Savage Gen Z fashion critic" persona
- Detect solo male/female/couple/group/no human
- No human means 0 scores
- Scores: Drip, Confidence, Allure, Domination (0-10)
- Brutal/sarcastic/witty tone
- Output format: Tag (2-3 words) + Line (1 savage sentence)
- Keep the JSON structure compatible with existing client code by mapping: Allure→attractiveness_score, Domination→dominance_score, etc.

**Replace `CALL1_SYSTEM` styling_tips section** with the styling advice prompt:

- "DRIPD AI Stylist — world-class fashion intelligence engine"
- WHAT WORKS (1-2 insights), WHAT FEELS OFF, UPGRADE MOVES (1-2 improvements)
- Clean, confident, slightly edgy tone

**Merge into a single Call 1** — the drip check prompt handles scoring + tag + line, and the styling advice prompt handles tips. Both get sent together as one GPT-4.1 call to reduce latency.

**Remove `CAPTION_SYSTEM` and Call 2 entirely** — the new drip check prompt generates killer_tag and praise_line in Call 1 itself, eliminating the need for a separate caption call. Remove `generateCaption()` and `generateRoastCaption()` functions.

**Update roast handling** — the new prompt handles "no human" detection natively. Keep server-side drip_score calculation.

### Step 2: Create `supabase/functions/generate-dripd-observation/index.ts`

New edge function using GPT-4.1 with the user's observation prompt:

- "DRIPD AI Stylist — elite fashion intelligence"
- Accepts `{ dripHistory, gender }` — last 5-10 entries with scores, tags, outfit descriptions
- Uses `user_memory` from drip history to reference past patterns
- Output: WORKS, OFF, FIX, OBSERVATION sections
- Returns `{ observation: "string" }` for display on home page card

### Step 3: Update `src/pages/HomeScreen.tsx`

Replace "Today's Look" card with "Dripd Observation" card that:

- Fetches last 7 days drip_history entries on load
- Calls `generate-dripd-observation` edge function
- Caches result for 7 days via deviceCache
- Displays the observation text in a styled card

### Step 4: No changes to Shopping Suggestions

Already updated in previous implementation to use `gemini-2.5-flash` with sophisticated prompts.

---

### Files changed

1. `supabase/functions/rate-outfit/index.ts` — full rewrite: OpenAI GPT-4.1, new prompts, single-call architecture
2. `supabase/functions/generate-dripd-observation/index.ts` — new edge function with observation prompt
3. `src/pages/HomeScreen.tsx` — Dripd Observation card (replacing Today's Look)