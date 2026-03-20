
-- Allow users to delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Starred/pinned messages table
CREATE TABLE public.starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  ai_message_id uuid REFERENCES public.ai_chat_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id),
  UNIQUE(user_id, ai_message_id)
);

ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own starred messages"
ON public.starred_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can star messages"
ON public.starred_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unstar messages"
ON public.starred_messages FOR DELETE TO authenticated
USING (auth.uid() = user_id);
