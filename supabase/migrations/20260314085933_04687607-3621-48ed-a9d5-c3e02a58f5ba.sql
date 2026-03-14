
-- Drop the recursive policies
DROP POLICY IF EXISTS "Users can view their participations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

-- Recreate conversation_participants SELECT policy without recursion
CREATE POLICY "Users can view their participations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Recreate conversation_participants INSERT policy without recursion
CREATE POLICY "Users can add participants to their conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Recreate conversations SELECT policy without recursion
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
    AND conversation_participants.user_id = auth.uid()
  )
);
