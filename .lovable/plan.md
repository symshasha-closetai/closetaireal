## Plan: Replace Copy Bank with Live AI Caption Generation + Fix Welcome Toast

### What's Changing

The current system picks from a static bank of ~248 pre-written captions. You've flagged that this breaks trust -- the tags don't sync with the actual scene/outfit, and it feels like random generic lines. The fix: generate a fresh, scene-aware killer tag and praise line on every request using a dedicated AI call via the Lovable AI Gateway.

### Architecture

```text
CURRENT:
  Call 1 (Gemini, scoring) → pickFromBank(mode, scene, gender, tier) → done
  Problem: tags don't match actual outfit, feel random

NEW:
  Call 1 (Gemini, scoring + outfit description) → Call 2 (Lovable AI, caption generation) → done
  If Call 2 fails → retry once → generic fallback
```

### Implementation

#### File 1: `supabase/functions/rate-outfit/index.ts`

&nbsp;

**Modify Call 1 prompt**: Add one field to the scoring JSON output -- `outfit_description` (a 10-15 word description of what the person is actually wearing). This gives Call 2 real context about the outfit.

**Add Call 2**: A new AI call via the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `google/gemini-1.5-pro` (balanced speed/quality). The system prompt will be exactly the savage persona prompt you provided:

- Savage best friend in a group chat
- Gen Z humor, meme language, chaotic but clever
- Focus ONLY on outfit/vibe/confidence
- Standard mode: witty and fun. Savage mode: borderline viral, slightly chaotic, "like a friend roasting you publicly"
- Output: `killer_tag` (max 5 words) + `praise_line` (max 20 words, viral caption)
- The user message includes: outfit description from Call 1, score tier, gender, scene type, and mode

**Call 2 uses tool calling** (structured output) to guarantee valid JSON with exactly `{killer_tag, praise_line}` -- no parsing failures.

**Fallback**: If Call 2 fails or returns invalid data, retry once. If still fails, use a minimal generic fallback (3-4 safe lines per tier) -- from the massive bank.

**Roast mode for non-humans**: Also generate live via Call 2 with a roast-specific prompt or pre-built roast bank.

#### File 2: `src/hooks/useAuth.tsx` (already fixed)

The welcome toast fix with `localStorage.getItem("dripd_welcomed")` is already in place from the previous edit. No changes needed.

### Technical Details

**Call 2 payload structure:**

```typescript
const call2Body = {
  model: "google/gemini-2.5-flash",
  messages: [
    { role: "system", content: SAVAGE_PERSONA_PROMPT },
    { role: "user", content: `Outfit: ${outfitDescription}. Score: ${dripScore}/10 (${tier}). Gender: ${gender}. Scene: ${sceneType}. Mode: ${mode}.` }
  ],
  tools: [{
    type: "function",
    function: {
      name: "generate_caption",
      parameters: {
        type: "object",
        properties: {
          killer_tag: { type: "string", description: "Max 5 words, savage/funny tag" },
          praise_line: { type: "string", description: "Max 20 words, viral caption" }
        },
        required: ["killer_tag", "praise_line"]
      }
    }
  }],
  tool_choice: { type: "function", function: { name: "generate_caption" } }
};
```

**Why this works now vs before:**

- Call 2 gets the actual outfit description, score, and scene -- captions will be contextual
- Tool calling forces structured output -- no JSON parse failures
- Lovable AI Gateway handles auth automatically via `LOVABLE_API_KEY`
- Balanced model (`gemini-2.5-pro`) is fast enough (~1-1.5s) and creative enough
- The "borderline viral" risk level works well with this model -- it won't safety-block outfit roasts

**Latency impact:** Adds ~1-1.5s vs the instant bank lookup, but captions will actually match the outfit.

### Expected Outcome

- Every caption is fresh, contextual, and synced to the actual outfit in the photo
- Savage Mode produces genuinely funny, chaotic, screenshot-worthy content
- No more generic/disconnected tags that "break trust"
- Structured output via tool calling prevents parse failures
- Hybrid fallback ensures the app never breaks even if the caption call fails