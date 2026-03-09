

## Plan: Fix Profile Name Not Reflecting on Home Screen

### Root Cause

The network logs reveal a **406 error** on the profiles query: `"The result contains 0 rows"`. This means the `fetchProfile` function in `useAuth` uses `.single()`, which throws an error when no row exists. The profile data is set to `null`, so:

1. The name never loads anywhere in the app
2. When the user "saves" their name on the profile page, the `UPDATE` query matches 0 rows (no profile exists), so nothing is actually saved
3. The home screen shows "Good morning, there!" instead of the user's name

The `handle_new_user` trigger should have created a profile row on signup, but it appears it didn't fire or the row was deleted during a previous "Delete Account" test.

### Fix

**`src/hooks/useAuth.tsx`** — Change `fetchProfile` to use `.maybeSingle()` instead of `.single()`, and handle the case where no profile exists by upserting one:

```typescript
const fetchProfile = useCallback(async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (!data) {
    // Create missing profile row
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({ user_id: userId, name: null })
      .select("name, avatar_url")
      .single();
    setProfile(newProfile);
  } else {
    setProfile(data);
  }
}, []);
```

This single change fixes all three symptoms:
- Profile row is auto-created if missing (self-healing)
- Name saves correctly because the row exists for `UPDATE`
- Home screen greeting shows the correct name after save because `refreshProfile` returns valid data

### Files

| File | Change |
|------|--------|
| `src/hooks/useAuth.tsx` | Use `.maybeSingle()` and auto-create missing profile row |

