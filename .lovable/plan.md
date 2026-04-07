

## Plan: Switch Drip Check to OpenAI GPT-4.1 + Add Dripd Observation

### Summary

Move the entire drip check pipeline (scoring, killer tag, praise line, styling tips) from Gemini to **OpenAI GPT-4.1** via direct API. Replace the "Today's Look" card on the home page with a **"Dripd Observation"** card that shows an AI-generated style observation based on past drip check history. Shopping suggestions, Dripd Calendar, and Style Architect remain on Gemini 2.5 Flash.

Shopping suggestion prompt will be rewritten to give image-specific advice about what's missing/can be improved (e.g., "A structured blazer over that white tee would elevate the whole look").

User will provide exact prompts for killer tag, praise line, styling tips, and Dripd observation — these will be copy-pasted in once provided.

---

### Step 1: Add OpenAI API Key

Use the `add_secret` tool to request the user's OpenAI API key as `OPENAI_API_KEY`.

### Step 2: Rewrite `supabase/functions/rate-outfit/index.ts`

**Replace `callGemini()` with `callOpenAI()`:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4.1` (for all calls: scoring, caption, roast)
- Auth: `Bearer ${OPENAI_API_KEY}`
- Remove `getApiKey()` (Gemini key rotation) — use single `OPENAI_API_KEY`

**Keep everything else identical:** prompts (CALL1_SYSTEM, CAPTION_SYSTEM), server-side score calculation, roast detection, fallback logic. Just swap the transport layer.

User will provide updated prompts later — placeholder with current prompts for now.

### Step 3: Replace "Today's Look" with "Dripd Observation" on Home Page

**File: `src/pages/HomeScreen.tsx`**

Replace the "Today's Look Card" (lines 667-723) with a "Dripd Observation" card:
- On load, fetch the user's last 5-10 drip check entries from `drip_history`
- Summarize them (scores, killer tags, outfit descriptions) into a short context string
- Call a new edge function `generate-dripd-observation` with this context
- Display the AI observation as a styled card (e.g., "You've been rocking dark tones lately — try a pop of color to break the pattern 🎨")
- Cache the observation for 24 hours via `deviceCache`
- Remove: today photo upload, crop, share, daily tag — all of it

**Remove related state/handlers:** `todayPhoto`, `handleTodayPhotoUpload`, `handleCroppedPhoto`, `handleRecropPhoto`, `handleShareTodayLook`, `photoFileRef`, `pendingCropImage`, `uploadingPhoto`, `sharingLook`, `getDailyTag`, `dailyTags`, `streak` display from this card.

### Step 4: Create `supabase/functions/generate-dripd-observation/index.ts`

New edge function:
- Input: `{ dripHistory: [{score, killer_tag, outfit_description, timestamp}], gender }`
- Uses **OpenAI GPT-4.1** (`OPENAI_API_KEY`)
- Prompt: Analyze the user's recent drip check patterns and generate a short, personalized style observation (2-3 sentences). Note trends in colors, scores, style evolution. Gen-Z tone.
- Output: `{ observation: "string" }`
- Add to `supabase/config.toml` with `verify_jwt = false`

### Step 5: Update Shopping Suggestions — `supabase/functions/generate-suggestions/index.ts`

**Stays on Gemini 2.5 Flash** but rewrite the `type === "shopping"` prompt:
- Analyze what's visible in the image (top, bottom, accessories, colors, patterns)
- Advise what's MISSING or can be IMPROVED based on what's seen
- Sophisticated fashion expert tone (not generic "try accessories")
- Example: "That white crew-neck is clean but adding a tailored navy blazer would instantly elevate the silhouette"
- Upgrade model from `gemini-2.5-flash-lite` to `gemini-2.5-flash`

### Step 6: Confirm Gemini stays for Calendar + Style Architect

- `generate-outfit-calendar/index.ts` — no changes, stays on Gemini
- `style-me/index.ts` — no changes, stays on Gemini
- `analyze-style-personality/index.ts` — no changes, stays on Gemini

---

### Technical Summary

| Feature | Model | API |
|---------|-------|-----|
| Drip Check (scoring + sub-scores) | GPT-4.1 | OpenAI direct |
| Killer Tag + Praise Line | GPT-4.1 | OpenAI direct |
| Styling Tips | GPT-4.1 | OpenAI direct |
| Dripd Observation (new) | GPT-4.1 | OpenAI direct |
| Shopping Suggestions | Gemini 2.5 Flash | Google direct |
| Dripd Calendar | Gemini 2.5 Flash | Google direct |
| Style Architect (style-me) | Gemini 2.5 Flash | Google direct |
| Style Personality | Gemini 2.5 Flash | Google direct |

**Files changed:**
1. `supabase/functions/rate-outfit/index.ts` — swap Gemini → OpenAI GPT-4.1
2. `src/pages/HomeScreen.tsx` — replace Today's Look with Dripd Observation
3. `supabase/functions/generate-dripd-observation/index.ts` — new edge function
4. `supabase/functions/generate-suggestions/index.ts` — rewrite shopping prompt, upgrade to gemini-2.5-flash
5. `supabase/config.toml` — add generate-dripd-observation entry

**New secret needed:** `OPENAI_API_KEY`

