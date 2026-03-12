CREATE TABLE public.saved_outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  occasion text,
  score numeric,
  explanation text,
  items jsonb NOT NULL DEFAULT '[]',
  tryon_image text,
  score_breakdown jsonb,
  reasoning jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own saved outfits" ON public.saved_outfits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own saved outfits" ON public.saved_outfits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved outfits" ON public.saved_outfits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.saved_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image text,
  drip_score numeric,
  killer_tag text,
  suggestion_type text NOT NULL DEFAULT 'wardrobe',
  item_name text NOT NULL,
  category text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own saved suggestions" ON public.saved_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own saved suggestions" ON public.saved_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved suggestions" ON public.saved_suggestions FOR DELETE TO authenticated USING (auth.uid() = user_id);