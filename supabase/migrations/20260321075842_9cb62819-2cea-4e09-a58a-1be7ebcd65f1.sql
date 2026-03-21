
CREATE TABLE public.outfit_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  outfit_date DATE NOT NULL,
  outfit_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, outfit_date)
);

ALTER TABLE public.outfit_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar" ON public.outfit_calendar FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar" ON public.outfit_calendar FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar" ON public.outfit_calendar FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar" ON public.outfit_calendar FOR DELETE TO authenticated USING (auth.uid() = user_id);
