

## Fix Drip Check — Prompt Restructure + Deploy

### Root cause

The current prompt has a structural conflict that confuses the AI model:

1. **Contradictory instructions**: The prompt says "DO NOT proceed to any other step. Output only the error JSON above." for the no-human case, but then immediately continues with scoring instructions. The model reads the entire prompt before responding, so it gets mixed signals about what to prioritize.

2. **Score-first, tag-second ordering**: The prompt asks for scores AND killer tag/praise line in one JSON, but the scoring instructions dominate the output structure. The model treats tags as just another field rather than the primary creative output.

3. **The function may not be deployed**: Edge function logs show zero entries for `rate-outfit`, meaning the latest code changes likely weren't deployed.

### Implementation

**1. Deploy the edge function**

The function needs to be explicitly deployed. This is likely why drip check "isn't working" — the deployed version may still be running old code.

**2. Restructure `supabase/functions/rate-outfit/index.ts` with a two-phase prompt**

Split the prompt into a clear system message + user message pattern:

- **System message**: Set the DRIPD AI persona, voice rules, and the two JSON output formats (human vs roast). Keep this concise and authoritative.
- **User message**: The actual analysis request with the image.

Key changes to the prompt:
- Remove the contradictory "DO NOT proceed" language — instead frame it as "IF/ELSE" clearly
- Put killer_tag and praise_line rules FIRST in the output spec
- Move scoring rules to a secondary "also include these fields" section
- Add explicit instruction: "The drip_score is calculated from the sub-scores. Use the drip_score YOU calculate to determine the tone of killer_tag and praise_line."
- Keep temperature at 0.9

**3. Use system + user message split in the API call**

```
messages: [
  { role: "system", content: systemPrompt },
  { role: "user", content: [
    { type: "text", text: "Analyze this outfit photo." },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,...` } }
  ]}
]
```

This gives the model clearer separation between instructions and the task.

### Files
- `supabase/functions/rate-outfit/index.ts` — restructured prompt with system/user split
- Deploy the function after editing

