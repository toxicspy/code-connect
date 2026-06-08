CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('❤️', '😂', '👍', '😮', '😢', '🔥')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_unique_user_message UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
ON public.message_reactions (message_id, created_at);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view reactions in their conversations" ON public.message_reactions;
CREATE POLICY "Participants can view reactions in their conversations"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can react in their conversations" ON public.message_reactions;
CREATE POLICY "Users can react in their conversations"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own reactions" ON public.message_reactions;
CREATE POLICY "Users can update own reactions"
ON public.message_reactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.message_reactions;
CREATE POLICY "Users can delete own reactions"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
