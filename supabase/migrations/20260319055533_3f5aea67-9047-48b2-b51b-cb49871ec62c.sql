
-- Custom categories table
CREATE TABLE public.wardrobe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.wardrobe_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories" ON public.wardrobe_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.wardrobe_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.wardrobe_categories FOR DELETE USING (auth.uid() = user_id);

-- Add custom_category to wardrobe
ALTER TABLE public.wardrobe ADD COLUMN custom_category text DEFAULT NULL;
