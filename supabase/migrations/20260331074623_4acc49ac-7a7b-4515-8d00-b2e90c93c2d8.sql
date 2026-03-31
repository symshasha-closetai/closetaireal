ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"streak":true,"competition":true,"progression":true,"social":true}'::jsonb;