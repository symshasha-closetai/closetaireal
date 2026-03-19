CREATE TABLE public.daily_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  look_date date NOT NULL DEFAULT CURRENT_DATE,
  streak integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, look_date)
);

ALTER TABLE public.daily_looks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own looks" ON public.daily_looks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own looks" ON public.daily_looks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own looks" ON public.daily_looks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own looks" ON public.daily_looks FOR DELETE USING (auth.uid() = user_id);