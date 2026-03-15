ALTER TABLE public.drip_history ADD COLUMN image_hash text;
CREATE INDEX idx_drip_history_image_hash ON public.drip_history (user_id, image_hash);