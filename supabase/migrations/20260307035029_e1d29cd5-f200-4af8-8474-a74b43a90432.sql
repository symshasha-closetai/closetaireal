ALTER TABLE public.style_profiles 
  ADD COLUMN IF NOT EXISTS face_photo_url text,
  ADD COLUMN IF NOT EXISTS body_photo_url text,
  ADD COLUMN IF NOT EXISTS ai_body_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_face_analysis jsonb,
  ADD COLUMN IF NOT EXISTS model_image_url text;