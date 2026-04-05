ALTER TABLE public.drip_history ADD COLUMN IF NOT EXISTS mode text DEFAULT 'standard';
ALTER TABLE public.drip_history ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'success';