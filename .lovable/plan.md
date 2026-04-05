

## Plan: Fix Welcome Toast + Overhaul Savage Mode with AI-Validated Copy Bank

### Two Issues

**1. Welcome toast fires every session**
- In `useAuth.tsx` line 72, `toast("Welcome to Dripd!")` fires whenever a profile doesn't exist and gets created. But it also fires on first login after signup (expected) AND can fire if profile fetch returns null due to timing. 
- Fix: only show it when a brand-new profile row is inserted (first-time user). Use a localStorage flag `dripd_welcomed` so it never repeats.

**2. Savage Mode is broken — `gender` variable is undefined**
- **Root cause found**: In `rate-outfit/index.ts` line 362, the request body destructures `imageBase64, imageUrl, styleProfile, unfiltered` but **never extracts `gender`**. Yet `gender` is used on lines 386, 404, and 513. This means every request sends `gender=undefined` to the AI, breaking the gender-based tone logic that Savage Mode depends on.
- Fix: extract `gender` from `styleProfile.gender` and default to `"unknown"`.

**3. Replace AI-generated copy with a pre-built bank of 200+ killer tags and praise lines**
- Instead of relying on Call 2 to generate copy (which fails due to safety filters, truncation, and undefined gender), build a massive bank of lines using AI beforehand, then select from them at runtime.
- The bank will be organized by: `gender` (male/female/unknown) × `scene_type` (solo/couple/group) × `score_tier` (0-4, 4.1-6, 6.1-8, 8.1-10) × `mode` (standard/savage).
- Each combination gets ~10-15 unique entries — totaling 200+ entries.
- Lines will be controversial, hilarious, and screenshot-worthy — pre-validated by AI before inclusion.
- At runtime: randomly select from the matching bucket, track used entries per user session to prevent repeats.

---

### Implementation

#### File 1: `src/hooks/useAuth.tsx`
- Add localStorage check before showing welcome toast:
  ```
  if (!localStorage.getItem("dripd_welcomed")) {
    localStorage.setItem("dripd_welcomed", "1");
    toast("Welcome to Dripd!", ...);
  }
  ```

#### File 2: `supabase/functions/rate-outfit/index.ts`
- **Fix gender extraction** (line ~362): `const gender = styleProfile?.gender || "unknown";`
- **Replace Call 2 entirely** with a lookup from a pre-built copy bank embedded in the function.
- The bank will be a large constant object keyed by `{mode}_{scene}_{tier}_{gender}`, each containing an array of `{killer_tag, praise_line}` objects.
- At runtime: pick a random entry from the matching bucket. No more Call 2 API call needed — this eliminates safety blocks, truncation, and latency.
- Keep `needsCopyFallback()` as a validation layer — if the selected entry somehow fails validation, pick another from the same bucket.
- **Generate the bank using AI** (one-time script run) with entries like:
  - Male, Savage, Elite: `{"killer_tag": "Built Different 😈", "praise_line": "no cap you walked in like you own the building and honestly? you might"}`
  - Female, Savage, Needs Work: `{"killer_tag": "Brave Choice 💀", "praise_line": "lowkey the confidence is doing more work than the outfit and that's saying something"}`
  - Couple, Standard, Fire: `{"killer_tag": "Power Pair 🔥", "praise_line": "y'all look like the couple everyone secretly wants to be"}`

#### File 3: One-time AI script to generate the copy bank
- Use `lovable_ai.py` to generate all entries organized by category.
- Each entry must pass quality checks: has wit, matches tier energy, has slang for savage mode, sounds plural for couples/groups.
- Output as JSON, then embed directly in the edge function.

---

### Architecture Change

```text
BEFORE:
  Call 1 (scoring) → Call 2 (copy generation) → validate → fallback
  Problems: Call 2 fails (safety), gender undefined, latency

AFTER:
  Call 1 (scoring) → lookup from pre-built bank → done
  Benefits: instant, no safety issues, always works, 200+ unique lines
```

### Expected Outcome
- Welcome toast shows only once per device, ever.
- Savage Mode works immediately — no more API failures for copy.
- Every result has a unique, high-quality, tier-appropriate killer tag and praise line.
- Response time drops by ~2-3 seconds (no Call 2).
- Lines are genuinely controversial/funny/shareable as requested.

