

## Add "Login Later" Guest Mode with Smart Sign-Up Prompts

### What it does

Users can skip auth, explore the app freely (drip check, wardrobe), but get a persuasive sign-up popup after key actions to encourage account creation.

### Implementation

**1. Add guest mode to auth context (`src/hooks/useAuth.tsx`)**

- Add `isGuest: boolean` and `setGuestMode: (v: boolean) => void` to `AuthContextType`
- Store guest state in a `useState` (not localStorage — resets each session intentionally)
- When guest mode is active, `user` stays `null` but `loading` is `false`

**2. Add "Login Later" button to auth screen (`src/pages/AuthScreen.tsx`)**

- Add a subtle "Explore without an account" / "Login Later" link at the top of the page
- On click: call `setGuestMode(true)` and navigate to `/`

**3. Update routing to allow guest access (`src/App.tsx`)**

- Modify `ProtectedRoute` to also allow access when `isGuest === true`
- Guest users skip onboarding check
- Auth route redirects guests to `/` as well
- Show `BottomNav` for guests too (but hide Messages/Profile tabs or grey them out)

**4. Create a reusable sign-up prompt dialog (`src/components/SignUpPromptDialog.tsx`)**

- A beautifully designed modal with sophisticated copy:
  - Title: "Your Drip Deserves to Be Remembered"
  - Body: "This score, this look, this moment — it all disappears without an account. Sign up in 10 seconds and never lose a drip check again."
  - CTA: "Create My Account" (navigates to `/auth`)
  - Secondary: "Maybe Later" (dismisses)
- For wardrobe variant:
  - Title: "Your Wardrobe Is Building Itself"
  - Body: "Every piece you add shapes your style DNA. Without an account, it vanishes when you close the app. Lock it in."
- Accept a `variant: "drip" | "wardrobe"` prop to switch copy

**5. Trigger prompt after drip check result (`src/pages/CameraScreen.tsx`)**

- After `runAnalysis` completes and shows result, if `isGuest` is true:
  - Still show the full result (scores, killer tag, praise line)
  - Skip `saveDripToHistory` DB save (no user ID)
  - After a 2-second delay, show the `SignUpPromptDialog` with `variant="drip"`

**6. Trigger prompt after wardrobe add (`src/pages/WardrobeScreen.tsx`)**

- After successfully adding an item to wardrobe (which will fail for guests since no user ID):
  - Intercept the add flow — if `isGuest`, show the item visually but don't attempt DB insert
  - Show `SignUpPromptDialog` with `variant="wardrobe"`

**7. Guest restrictions**

- Messages and Chat routes: redirect guests to auth with a toast "Sign up to message friends"
- Profile: redirect guests to auth
- Wardrobe: allow browsing UI but trigger prompt on add
- Drip Check: fully functional, prompt after result
- Leaderboard: viewable

### Files to edit
- `src/hooks/useAuth.tsx` — add `isGuest` + `setGuestMode`
- `src/pages/AuthScreen.tsx` — add "Login Later" button
- `src/App.tsx` — update `ProtectedRoute` + routing for guests
- `src/components/SignUpPromptDialog.tsx` — new reusable prompt component
- `src/pages/CameraScreen.tsx` — trigger prompt after drip result for guests
- `src/pages/WardrobeScreen.tsx` — trigger prompt after wardrobe add for guests
- `src/components/BottomNav.tsx` — handle guest nav restrictions

