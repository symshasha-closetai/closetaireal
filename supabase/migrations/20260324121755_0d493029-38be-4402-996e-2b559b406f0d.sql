
-- Add kept column to three tables
ALTER TABLE drip_history ADD COLUMN kept boolean NOT NULL DEFAULT false;
ALTER TABLE saved_outfits ADD COLUMN kept boolean NOT NULL DEFAULT false;
ALTER TABLE saved_suggestions ADD COLUMN kept boolean NOT NULL DEFAULT false;

-- Add UPDATE RLS policies for drip_history, saved_outfits, saved_suggestions
CREATE POLICY "Users can update own drip history"
ON public.drip_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved outfits"
ON public.saved_outfits FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved suggestions"
ON public.saved_suggestions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
