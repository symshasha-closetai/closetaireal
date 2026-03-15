

## Plan: Fix Wardrobe Suggestions Source and Persist All State Across Navigation

### Problem 1: "Not my wardrobe"
In `CameraScreen.tsx`, `globalDripState.wardrobeItems` is initialized as `[]` and **never populated** with the user's actual wardrobe. This empty array is passed to `OutfitRatingCard`, which then passes it to the `generate-suggestions` edge function. With no wardrobe context, the AI invents random items.

**Fix**: Fetch the user's wardrobe items from the database when CameraScreen mounts and store them in `globalDripState.wardrobeItems`.

### Problem 2: Suggestions lost on navigation
`wardrobeSuggestions`, `shoppingSuggestions`, `detectedItems`, `suggestionImages`, and `savedSuggestions` are all local `useState` inside `OutfitRatingCard`. When the user navigates away, the component unmounts and all this state is destroyed.

**Fix**: Move these into `globalDripState` so they persist across navigation, same as the existing `image`/`result`/`analyzing` fields already do.

### Changes

#### `src/pages/CameraScreen.tsx`
- Add `wardrobeSuggestions`, `shoppingSuggestions`, `detectedItems`, `suggestionImages`, `savedSuggestions` to the `DripState` type and initial state
- On mount, fetch wardrobe items from `supabase.from("wardrobe")` for the logged-in user and call `updateGlobal({ wardrobeItems: items })`
- Pass all persisted suggestion state down to `OutfitRatingCard` via props
- When `clearImage` is called, also reset suggestions

#### `src/components/OutfitRatingCard.tsx`
- Accept new props for persisted state: `wardrobeSuggestions`, `shoppingSuggestions`, `detectedItems`, `suggestionImages`, `savedSuggestions`, plus setter callbacks (`onWardrobeSuggestionsChange`, etc.)
- Replace local `useState` for these fields with the props/callbacks
- This way the state lives in the global singleton and survives navigation

### Files Modified
- `src/pages/CameraScreen.tsx` — fetch wardrobe, persist suggestion state globally
- `src/components/OutfitRatingCard.tsx` — use props instead of local state for suggestions

