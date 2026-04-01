
-- Create an atomic function to find or create a 1:1 conversation
CREATE OR REPLACE FUNCTION public.find_or_create_conversation(friend_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  calling_user_id uuid;
  existing_convo_id uuid;
  new_convo_id uuid;
BEGIN
  calling_user_id := auth.uid();
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find existing 1:1 conversation between the two users
  SELECT cp1.conversation_id INTO existing_convo_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = calling_user_id
    AND cp2.user_id = friend_id
    AND cp1.conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      GROUP BY conversation_id
      HAVING count(*) = 2
    )
  LIMIT 1;

  IF existing_convo_id IS NOT NULL THEN
    RETURN existing_convo_id;
  END IF;

  -- Create new conversation with both participants
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO new_convo_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (new_convo_id, calling_user_id), (new_convo_id, friend_id);

  RETURN new_convo_id;
END;
$$;
