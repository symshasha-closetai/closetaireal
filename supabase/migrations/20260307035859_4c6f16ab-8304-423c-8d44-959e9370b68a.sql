CREATE POLICY "Users can delete own style profile"
ON public.style_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);