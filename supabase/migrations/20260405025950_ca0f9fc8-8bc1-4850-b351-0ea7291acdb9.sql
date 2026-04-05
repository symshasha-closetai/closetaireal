
-- Remove the declined duplicate, keep the accepted one
DELETE FROM public.friends WHERE id = 'a716f5e6-b0ce-42e4-817e-aa4bf01c94be';

-- Add bidirectional unique constraint on friends
CREATE UNIQUE INDEX friends_pair_unique ON public.friends (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));
