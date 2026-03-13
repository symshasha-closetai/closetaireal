
CREATE TABLE public.drip_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text,
  score numeric NOT NULL,
  killer_tag text,
  praise_line text,
  full_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drip_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drip history" ON public.drip_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own drip history" ON public.drip_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own drip history" ON public.drip_history FOR DELETE USING (auth.uid() = user_id);
