CREATE TABLE IF NOT EXISTS public.ai_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_message_id uuid NOT NULL REFERENCES public.ai_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('❤️', '😂', '👍', '😮', '😢', '🔥')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_message_reactions_unique_user_message UNIQUE (ai_message_id, user_id)
);

CREATE INDEX IF NOT EXISTS ai_message_reactions_message_idx
ON public.ai_message_reactions (ai_message_id, created_at);

ALTER TABLE public.ai_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI reactions" ON public.ai_message_reactions;
CREATE POLICY "Users can view own AI reactions"
ON public.ai_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_chat_messages m
    WHERE m.id = ai_message_reactions.ai_message_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can react to own AI chat messages" ON public.ai_message_reactions;
CREATE POLICY "Users can react to own AI chat messages"
ON public.ai_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.ai_chat_messages m
    WHERE m.id = ai_message_reactions.ai_message_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own AI reactions" ON public.ai_message_reactions;
CREATE POLICY "Users can update own AI reactions"
ON public.ai_message_reactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own AI reactions" ON public.ai_message_reactions;
CREATE POLICY "Users can delete own AI reactions"
ON public.ai_message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_message_reactions;
