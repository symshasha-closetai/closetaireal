

## Fix AI: Enforce Human Check + Killer Tag/Praise Line Reliability

### The Problem

From the screenshot: a chemistry diagram (neutron flow) was rated with actual scores (color: 2, posture: 4, layering: 1.5, face: 0) instead of being roasted. The AI model is ignoring the "HARD GATE" because the single prompt is too long and complex for `gemini-2.5-flash-lite` to follow reliably.

### Solution: Two-Call Architecture

Split into two separate AI calls matching the user's provided prompt structure:

**Call 1: Score + Human Check** — Focused purely on detecting humans and calculating scores. Short, strict prompt. Returns scores OR roast.

**Call 2: Killer Tag + Praise Line** — Only runs if Call 1 detected a human. Takes the `drip_score` as input (exactly as the user's prompt specifies). This dedicated call produces higher quality creative output because the model only focuses on one task.

**Server-side validation** — After Call 1, if any of these are true, force roast mode regardless of what the AI returned:
- `drip_score === 0` and all sub-scores are 0
- `face_score === 0` and `posture_score === 0` (no human indicators)
- Response contains `error: "roast"`

### Files to edit

**1. `supabase/functions/rate-outfit/index.ts`** — Complete rewrite

Call 1 prompt (scoring):
```
You analyze outfit photos. Check if there's a human wearing clothes.

IF NO HUMAN: Return {"error":"roast","roast_line":"...","drip_score":0,...all scores 0}
Match roast category: Food, Furniture, Nature, Animal, Meme, Vehicle, Object.

IF HUMAN: Return scores only:
- color_score (0-10): color coordination
- posture_score (0-10): stance, pose, confidence  
- layering_score (0-10): layers, accessories, details
- face_score (0-10): expression, energy
- drip_score = color(30%) + posture(30%) + layering(25%) + face(15%)
- confidence_rating (0-10)
```

Call 2 prompt (creative — uses user's exact prompt verbatim):
```
You are DRIPD AI — a Gen-Z fashion intelligence engine.
Input: drip_score: {score}, user_gender: {gender}
[User's exact Steps 1-6 for killer_tag and praise_line]
```

Server-side validation between calls:
- If Call 1 returns all zero scores → force roast, skip Call 2
- If Call 1 returns `error: "roast"` → return immediately, skip Call 2  
- Merge Call 2 results (killer_tag, praise_line) into Call 1 results for final response

**2. No frontend changes needed** — The response shape stays the same, just higher quality and more reliable.

### Technical details

- Both calls use `gemini-2.5-flash-lite` for speed
- Call 1: `temperature: 0.3` (deterministic scoring)
- Call 2: `temperature: 0.9` (creative output)  
- Call 1 max_tokens: 512 (just JSON scores)
- Call 2 max_tokens: 256 (just tag + line)
- Total latency: ~3-4s (parallel would break the dependency, so sequential but each call is faster due to shorter prompts)
- Roast categories and lines are identical to the user's provided list
- The edge function will be redeployed after editing

