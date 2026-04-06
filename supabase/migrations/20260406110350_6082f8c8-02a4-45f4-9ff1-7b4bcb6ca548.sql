
CREATE OR REPLACE FUNCTION public.create_group_conversation(group_name text, member_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  calling_user_id uuid;
  new_convo_id uuid;
  member_id uuid;
BEGIN
  calling_user_id := auth.uid();
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF group_name IS NULL OR trim(group_name) = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  IF array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) < 1 THEN
    RAISE EXCEPTION 'At least one member required';
  END IF;

  -- Create group conversation
  BEGIN
    INSERT INTO public.conversations (name, is_group)
    VALUES (trim(group_name), true)
    RETURNING id INTO new_convo_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create conversation: %', SQLERRM;
  END;

  -- Add creator as participant
  BEGIN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (new_convo_id, calling_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to add creator: %', SQLERRM;
  END;

  -- Add all other members
  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != calling_user_id THEN
      BEGIN
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (new_convo_id, member_id);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to add member %: %', member_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN new_convo_id;
END;
$function$;
