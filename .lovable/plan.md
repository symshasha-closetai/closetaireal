## Plan: Style Personality Expansion + "Suggest Me" Input + Minor Fixes

### 1. Expand Style Personality Categories

**File: `src/pages/ProfileScreen.tsx**` (lines ~98-106)

Add more personality detection rules before the fallback, including:

- **Dark Academia** — keywords: "formal", "classic" + dark colors (black, brown, navy) or materials like tweed, wool, leather
- **Cottagecore** — keywords: "bohemian", "boho" + floral patterns or light/pastel colors, linen/cotton materials
- **Y2K Nostalgia** — keywords: "streetwear" + bright/bold colors, denim, crop items
- **Techwear** — keywords: "sporty", "urban" + synthetic/nylon materials
- **Preppy** — keywords: "classic", "smart" + polo, blazer items
- **Grunge** — keywords: "street", plaid, denim + dark tones
- **Quiet Luxury** — keywords: "minimalist", "formal" + premium materials (cashmere, silk)
- **Eclectic Mix** — high variety of styles (no single dominant pattern)

Also use color analysis from wardrobe items to improve accuracy. Display the tag as "My Style Personality: {tag}" format.

### 2. "Suggest Me" Free-text Input in Personal Tab

**File: `src/pages/ProfileScreen.tsx**`

Add a new section in the Personal tab (below the privacy notice) with:

- A textarea labeled "Suggest Me" with placeholder "Tell us anything — what you'd like to improve, features you want, style goals..."
- A "Send" button that saves the suggestion to a `user_suggestions` table in the database
- Show a confirmation toast on submit
- Send an email to [symshasha@gmail.com](mailto:symshasha@gmail.com) carrying the suggestion

**Database migration:** Create a `user_suggestions` table:

```sql
CREATE TABLE public.user_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  suggestion text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own suggestions" ON public.user_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own suggestions" ON public.user_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
```

### 3. Style Personality Display Format

Update the badge below avatar from just `{tag}` to `My Style Personality: {tag}` with the tag portion in a slightly bolder/accent style.

4. APIs should be called from backend so that it is not exposed

### Files to modify

- `src/pages/ProfileScreen.tsx` — expanded personality logic, "Suggest Me" textarea, updated badge format
- Database migration — `user_suggestions` table