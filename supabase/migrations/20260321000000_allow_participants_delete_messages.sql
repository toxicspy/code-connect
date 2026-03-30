DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

CREATE POLICY "Conversation participants can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));
