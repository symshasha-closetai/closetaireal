

## Plan: Fix Dripd Observation vanishing + Deploy edge functions

### Problem 1: Edge functions not deployed
The `rate-outfit` and `generate-dripd-observation` edge functions show **no logs at all**, meaning the updated code was never deployed. The functions need to be explicitly deployed for the new GPT-4.1 prompts to take effect. No SQL needed.

### Problem 2: Dripd Observation loads then vanishes
This is an **auth race condition**. The `useEffect` runs when `user` first appears, sets `observationFetchedRef.current = true`, and starts fetching. But during Supabase auth re-initialization, the component may re-mount with `user` briefly null, resetting the `dripdObservation` state to null. Since the ref is already `true`, it never refetches.

**Fix**: Store the observation result more defensively — don't gate rendering solely on transient state. Use the cache as the source of truth on mount, and don't let auth flickering reset the state.

### Changes

**1. Deploy edge functions**
- Deploy `rate-outfit` and `generate-dripd-observation` so the new brutal GPT-4.1 prompts actually run.

**2. Fix observation vanishing in `src/pages/HomeScreen.tsx`**
- Initialize `dripdObservation` state from cache immediately (not inside useEffect), so it persists across auth re-renders.
- Move cache read to state initializer: `useState(() => getCache(...))`
- Keep the useEffect for fetching fresh data only when cache is empty.
- Reset `observationFetchedRef` properly if user changes.

### Files changed
1. `src/pages/HomeScreen.tsx` — fix observation state initialization from cache
2. Deploy: `rate-outfit`, `generate-dripd-observation`

