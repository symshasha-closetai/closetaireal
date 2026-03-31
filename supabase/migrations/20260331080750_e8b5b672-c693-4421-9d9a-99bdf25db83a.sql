
-- Create a SECURITY DEFINER function to atomically create a conversation with participants
-- This bypasses the RLS SELECT policy issue where the user isn't a participant yet at SELECT time
CREATE OR REPLACE FUNCTION public.create_conversation_with_participants(friend_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_convo_id uuid;
  calling_user_id uuid;
BEGIN
  calling_user_id := auth.uid();
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the conversation
  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO new_convo_id;

  -- Add both participants
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (new_convo_id, calling_user_id);

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (new_convo_id, friend_id);

  RETURN new_convo_id;
END;
$$;
