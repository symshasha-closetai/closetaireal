

## Plan: Fix Streak Bug + Verify Current Setup

### Issue Found: Streak Keys Mismatch
HomeScreen reads/writes streak using `streak-${user.id}` with a JSON object `{count, lastDate}`. CameraScreen writes to completely different keys: `streakCount` and `lastCheckInDate`. They never communicate.

### Fix (`src/pages/CameraScreen.tsx`)
Replace the streak logic in `runAnalysis` (lines 350-360) to use the same format as HomeScreen:

```typescript
const today = new Date().toDateString();
const yesterday = new Date(Date.now() - 86400000).toDateString();
let newStreak = 1;
try {
  const raw = localStorage.getItem(`streak-${userId}`);
  if (raw) {
    const { count, lastDate } = JSON.parse(raw);
    if (lastDate === yesterday) newStreak = count + 1;
    else if (lastDate === today) newStreak = count; // already counted today
    else newStreak = 1;
  }
} catch {}
localStorage.setItem(`streak-${userId}`, JSON.stringify({ count: newStreak, lastDate: today }));
```

This ensures both Today's Look uploads and Drip Checks contribute to the same streak counter.

### Speed Status
The edge function is correctly configured to call `gemini-2.0-flash` directly with `GOOGLE_AI_API_KEY` and a 15s timeout. The CDN upload optimization is in place (sends URL instead of base64 when possible). The 5s min animation is set. No further code changes needed for speed -- the bottleneck is Gemini API response time (~2-5s typical).

### Files Modified
- `src/pages/CameraScreen.tsx` -- fix streak localStorage keys to match HomeScreen format

