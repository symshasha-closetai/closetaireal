
CREATE OR REPLACE FUNCTION public.create_group_conversation(group_name text, member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  calling_user_id uuid;
  new_convo_id uuid;
  member_id uuid;
BEGIN
  calling_user_id := auth.uid();
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) < 1 THEN
    RAISE EXCEPTION 'At least one member required';
  END IF;

  -- Create group conversation
  INSERT INTO public.conversations (name, is_group)
  VALUES (group_name, true)
  RETURNING id INTO new_convo_id;

  -- Add creator as participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (new_convo_id, calling_user_id);

  -- Add all other members
  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != calling_user_id THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (new_convo_id, member_id);
    END IF;
  END LOOP;

  RETURN new_convo_id;
END;
$$;
