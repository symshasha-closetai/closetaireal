## Fix Drip Check AI + Challenge Send + No-Crop Photos

### What's changing

1. **Rewrite the AI prompt** in `rate-outfit` edge function using your exact prompt (killer tag + praise line as primary outputs, scores as secondary)
2. **Change "Send" to "Challenge"** with provocative CTA ("Beat my drip 🔥")
3. **Shared card shows drip score + confidence only** (already does, keeping it)
4. **Drip card in messages opens fullscreen** when tapped
5. **No cropping anywhere** — photos use `object-contain` with auto-sized containers

No SQL changes needed. This is all prompt + UI work.

### Files to edit

**1. `supabase/functions/rate-outfit/index.ts**` — Rewrite prompt

- Replace the entire system prompt with the user's provided prompt verbatim
- Keep the scoring JSON fields (drip_score, color_score, posture_score, layering_score, face_score, confidence_rating, drip_reason, confidence_reason, color_reason, posture_reason, layering_reason, face_reason, advice) in the "human detected" format
- Add killer_tag and praise_line as the primary creative outputs using the user's exact step-by-step instructions
- The roast mode returns `{killer_tag: null, praise_line: null, error: "roast", roast_line: "..."}`  plus zeroed scores
- Keep same API call structure (system/user message split, gemini-2.5-flash-lite, temperature 0.9)

**2. `src/components/OutfitRatingCard.tsx**` — Challenge button + no-crop

- Change the Send button label to "Challenge" with a swords icon
- Update `SendToFriendPicker` content to `"Beat my drip 🔥"` as the message text
- Hero image: change from `object-contain max-h-[70vh]` to `object-contain w-full` with no forced aspect ratio (container auto-sizes to image)
- Share card (`captureCard`): instead of cover-fit cropping, contain-fit the image preserving full aspect ratio with letterboxing on dark background

**3. `src/components/MessageBubble.tsx**` — Fullscreen drip card + no-crop

- For `drip_card` content type: make the card tappable → opens a fullscreen overlay with the image, scores, and killer tag
- Change `aspect-[3/4] object-cover` to `object-contain w-full` so the image isn't cropped in the chat bubble
- Add a fullscreen modal state that renders the drip card large when tapped
- Show the challenge text ("Beat my drip 🔥") below the card in the bubble

**4. `src/pages/CameraScreen.tsx**` — No-crop during analysis

- Line 487: change `aspect-[3/4] object-cover` to `object-contain w-full` on the analyzing preview image so nothing gets cut off during the loading state

### Technical details

- The prompt rewrite uses the user's exact structure with Steps 0-6 and the Final Test
- Score calculation formula stays: `drip_score = color(30%) + posture(30%) + layering(25%) + face(15%)`
- The fullscreen drip card in messages will be a simple fixed overlay with backdrop blur, dismissible by tap
- Challenge metadata will include `confidence_rating` alongside existing `score` and `killer_tag`
- Deploy edge function after editing