

## Plan: Add Welcome Toast for First-Time Users

Add a toast notification in `src/hooks/useAuth.tsx` when a new profile row is auto-created in `fetchProfile`.

### Change

**`src/hooks/useAuth.tsx`**
- Import `toast` from `sonner`
- In the `if (!data)` branch of `fetchProfile`, after successfully inserting the new profile, call `toast("Welcome to ClosetAI!", { description: "Let's set up your style profile." })`

Single file, ~2 lines added.

