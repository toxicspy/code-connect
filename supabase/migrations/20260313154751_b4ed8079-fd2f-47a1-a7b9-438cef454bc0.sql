
-- Drop and recreate the permissive policies
DROP POLICY "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = id AND user_id = auth.uid())
);

DROP POLICY "Authenticated users can join conversations" ON public.conversation_participants;
CREATE POLICY "Users can add themselves to conversations" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
