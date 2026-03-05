-- Create update_updated_at function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Daily ratings with separate date column
CREATE TABLE public.daily_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  image_url TEXT,
  ai_feedback TEXT,
  rating_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, rating_date)
);
ALTER TABLE public.daily_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ratings" ON public.daily_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings" ON public.daily_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Style profile
CREATE TABLE public.style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  style_type TEXT,
  body_type TEXT,
  skin_tone TEXT,
  face_shape TEXT,
  body_proportions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.style_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own style profile" ON public.style_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own style profile" ON public.style_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own style profile" ON public.style_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_style_profiles_updated_at BEFORE UPDATE ON public.style_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for wardrobe images
INSERT INTO storage.buckets (id, name, public) VALUES ('wardrobe', 'wardrobe', true);
CREATE POLICY "Wardrobe images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'wardrobe');
CREATE POLICY "Users can upload wardrobe images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'wardrobe' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their wardrobe images" ON storage.objects FOR UPDATE USING (bucket_id = 'wardrobe' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their wardrobe images" ON storage.objects FOR DELETE USING (bucket_id = 'wardrobe' AND auth.uid()::text = (storage.foldername(name))[1]);