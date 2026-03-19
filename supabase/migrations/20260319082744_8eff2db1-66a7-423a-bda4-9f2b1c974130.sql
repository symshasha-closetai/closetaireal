-- Tighten conversation creation: user must add themselves as participant
DROP POLICY "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Tighten participant insertion: must be adding self or be existing participant
DROP POLICY "Users can add participants to their conversations" ON public.conversation_participants;
CREATE POLICY "Users can add self as participant"
ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_conversation_participant(auth.uid(), conversation_id));