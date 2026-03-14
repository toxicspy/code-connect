-- Allow users to see other participants in their conversations using security definer
DROP POLICY IF EXISTS "Users can view their participations" ON public.conversation_participants;

CREATE POLICY "Users can view their participations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_conversation_participant(conversation_id, auth.uid())
);