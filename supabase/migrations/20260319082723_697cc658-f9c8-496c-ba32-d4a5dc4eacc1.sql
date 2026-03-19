-- 1. Change friends default status to 'pending'
ALTER TABLE public.friends ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Add RLS policy so friend_id user can update status to 'accepted' or 'declined'
CREATE POLICY "Friend can accept/decline request"
ON public.friends
FOR UPDATE
TO authenticated
USING (auth.uid() = friend_id)
WITH CHECK (auth.uid() = friend_id AND status IN ('accepted', 'declined'));

-- 3. Create conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 4. Create conversation_participants table
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 5. Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'text',
  metadata jsonb DEFAULT NULL,
  kept boolean NOT NULL DEFAULT false,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. Security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- 7. RLS policies for conversations
CREATE POLICY "Participants can view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (public.is_conversation_participant(auth.uid(), id));

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (true);

-- 8. RLS policies for conversation_participants
CREATE POLICY "Participants can view participants"
ON public.conversation_participants FOR SELECT TO authenticated
USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can add participants to their conversations"
ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (true);

-- 9. RLS policies for messages
CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT TO authenticated
USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.is_conversation_participant(auth.uid(), conversation_id) AND sender_id = auth.uid());

CREATE POLICY "Sender can update own messages"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages"
ON public.messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- 10. Enable realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;