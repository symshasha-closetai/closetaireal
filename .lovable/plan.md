## Plan: Expand Fallback Data + Staged Loading Animation

### Changes

#### 1. Expand killer tags & praise lines (`supabase/functions/rate-outfit/index.ts` + `src/pages/CameraScreen.tsx`)

Add 20+ more entries to both `KILLER_TAGS` and `PRAISE_LINES` arrays in the edge function, and sync the client-side `CLIENT_KILLER_TAGS` / `CLIENT_PRAISE_LINES` with the same expanded set.

New killer tags (examples): "Drip Architect 🏛️💧", "Phantom Flex 👻💪", "Vogue Villain 🦹✨", "Zen Drip Master 🧘💧", "Royal Misfit 👑🃏", "Twilight Baron 🌆🎩", "Ivory Tower King 🏰👑", "Digital Nomad Drip 💻🌍", "Obsidian Oracle 🖤🔮", "Champagne Casualty 🥂💫", "Cosmic Drifter 🌌✨", "Vintage Voltage ⚡🪩", "Luxe Outlaw 🤠💎", "Sapphire Sovereign 💙👑", "Crimson Catalyst ❤️‍🔥⚡", "Arctic Aristocrat 🧊👑", "Jade Emperor 🟢👑", "Onyx Operator 🖤🎯", "Gilded Rebel ✨🔥", "Marble Mood 🤍🏛️"

New praise lines (examples): "You're dressed like success is your default setting 💼✨", "This fit just broke the algorithm 📈🔥", "You look like you own the playlist AND the venue 🎶👑", "This outfit has more range than your favorite artist 🎤✨", "You're giving 'walked in, owned it, left' energy 🚶‍♂️💨", etc. (20+ total new ones)

#### 2. Staged Loading Animation (`src/pages/CameraScreen.tsx`)

Replace the current spinner + progress bar with a **4-step checklist animation** during analysis:

**Steps with timing:**

- Step 1: "Detecting colors..." — starts at 0s, completes at ~2s
- Step 2: "Understanding outfit style..." — starts at 2s, completes at ~4s  
- Step 3: "Calculating drip score..." — starts at 4s, completes at ~6s
- Step 4: "Generating confidence score..." — starts at 6s, completes at ~8s

**How it works:**

- In `runAnalysis`, add a `stageSteps` array to `DripState` tracking which steps are complete
- Use `setTimeout` intervals to mark each step as "done" (with checkmark animation) over 8 seconds minimum
- The AI call runs in parallel; if AI finishes before 8s, result is held until the animation completes
- Each step shows: a spinning icon while active, a green checkmark (with scale-in animation) when complete, and greyed-out text when pending

**UI structure (replaces current spinner overlay):**

```
┌────────────────────────┐
│  [outfit image, blurred]│
│                         │
│   ✅ Detecting colors   │
│   ✅ Understanding style│
│   ⏳ Calculating drip.. │
│   ○  Generating scores    │
│                         │
│   [Cancel]              │
└────────────────────────┘
```

- Add `analysisSteps` to `DripState`: `{label: string, status: 'pending'|'active'|'done'}[]`
- In `runAnalysis`, kick off a staged timer that progresses steps every ~2s
- Use `Promise.all([aiCall, minDelayPromise])` to ensure minimum 8s display
- When both complete, show result

### Files Modified

- `supabase/functions/rate-outfit/index.ts` — add ~20 more killer tags and praise lines
- `src/pages/CameraScreen.tsx` — expand client fallback arrays, implement staged loading with 4-step checklist animation, minimum 4s delay