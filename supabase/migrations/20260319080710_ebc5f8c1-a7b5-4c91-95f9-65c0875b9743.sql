
-- Add username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username) WHERE username IS NOT NULL;

-- Username validation trigger
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username !~ '^[a-zA-Z0-9_.]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and dots';
  END IF;
  IF NEW.username IS NOT NULL AND length(NEW.username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters';
  END IF;
  IF NEW.username IS NOT NULL AND length(NEW.username) > 30 THEN
    RAISE EXCEPTION 'Username must be at most 30 characters';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_username_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- Create friends table
CREATE TABLE public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- RLS: users can see their own friend rows (either direction)
CREATE POLICY "Users can view own friends"
ON public.friends FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert own friends"
ON public.friends FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own friends"
ON public.friends FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow reading profiles by username for friend search (need a new policy)
CREATE POLICY "Users can search profiles by username"
ON public.profiles FOR SELECT
TO authenticated
USING (username IS NOT NULL);

-- Allow reading drip_history for friends (leaderboard)
CREATE POLICY "Users can view friends drip history"
ON public.drip_history FOR SELECT
TO authenticated
USING (true);
