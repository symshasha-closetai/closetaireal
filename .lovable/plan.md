

## Plan: Wardrobe Retry Button, AI Fallback System with Killer Tags DB

### 1. Wardrobe Card — Always-Visible Regenerate Button (`src/pages/WardrobeScreen.tsx`)

Currently the retry button only shows when image loading fails (`onError`). Add a small regenerate (refresh) icon button on every wardrobe card (next to edit/share/delete buttons at top), so users can regenerate the AI image anytime — not just on failure.

- Add a `RefreshCw` button in the top button row (lines 644-658) that calls `retryImageGeneration(item)`
- Show a spinner when regenerating (`retryingImages.has(item.id)`)

### 2. AI Fallback System in `rate-outfit` Edge Function (`supabase/functions/rate-outfit/index.ts`)

Add a 7-second timeout on the Gemini API call. If it times out or fails, return a randomly generated fallback result instead of an error.

**Fallback data (hardcoded in the edge function):**

- **30+ killer tags**: "Urban Samurai 🗡️✨", "Silent Billionaire 💰🖤", "Street Alpha 🔥👑", "Midnight Artist 🎨🌙", "Campus CEO 💼🎓", "Soft Rebel 🌸⚡", "Velvet Operator 🎭✨", "Neon Maverick 💜⚡", "Shadow Stylist 🖤🕶️", "Minimal King 👑✨", "Dark Academia Don 📚🖤", "Chrome Heart Drip 💎🔗", "Sunset Sovereign 🌅👑", "Retro Royalty 👑🪩", "Ice Cold Flex ❄️💎", "Golden Hour Glow ☀️✨", "Main Character Mode 🎬✨", "Quiet Luxury King 🤫👑", "Concrete Runway 🏙️💫", "Denim Dynasty 👖👑", "Monochrome Monarch 🖤🤍", "Electric Elegance ⚡✨", "Silk Road Style 🧣✨", "Stealth Drip 🥷💧", "Boulevard Boss 🛣️👔", "Cozy Commander ☁️🫡", "Pastel Powerhouse 🍬💪", "Grunge Royalty 🎸👑", "Polo Club Captain 🏇✨", "Night Shift Drip 🌃💧"

- **30+ praise lines**: "You walked in and the room stopped scrolling 📱✨", "This fit said 'I woke up and chose excellence' 💅🔥", "You're not dressed, you're ARMED 🗡️✨", "Serving looks that need their own zip code 📍💫", "You're already dressed like the main character 🎬👑", etc.

- **Scores**: All randomly between 7.0-9.5
- **Reasons**: Generic but positive ("Great color coordination", "Strong silhouette choices", etc.)

**Implementation in `rate-outfit/index.ts`:**
- Wrap the `callWithFallback` in a `Promise.race` with a 7-second timeout
- On timeout OR any error, return a random fallback result
- Never return an error to the client

### 3. Client-Side Fallback (`src/pages/CameraScreen.tsx`)

- In `runAnalysis`, if the edge function returns an error or no result, use the same fallback approach client-side (random scores 7-9.5, random tag/praise from a local array)
- Remove the `toast.error` on failure — silently use fallback
- Always show a complete result to the user

### Files Modified
- `src/pages/WardrobeScreen.tsx` — add regenerate button on every card
- `supabase/functions/rate-outfit/index.ts` — 7s timeout + fallback data arrays
- `src/pages/CameraScreen.tsx` — client-side fallback, no error toasts

