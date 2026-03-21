ALTER TABLE public.style_profiles 
ADD COLUMN IF NOT EXISTS style_personality text,
ADD COLUMN IF NOT EXISTS style_personality_reason text,
ADD COLUMN IF NOT EXISTS style_personality_updated_at timestamp with time zone;