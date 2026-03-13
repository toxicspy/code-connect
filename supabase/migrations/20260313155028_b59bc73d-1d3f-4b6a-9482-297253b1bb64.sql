
-- Drop the restrictive conversation insert policy and use a simpler one
DROP POLICY "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);

-- Add a policy so participant insert can also add the other user (for creating DM conversations)
DROP POLICY "Users can add themselves to conversations" ON public.conversation_participants;
CREATE POLICY "Users can add participants to their conversations" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid())
);
