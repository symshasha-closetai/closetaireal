CREATE TABLE public.user_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  suggestion text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own suggestions" ON public.user_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own suggestions" ON public.user_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);