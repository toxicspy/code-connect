CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_users_unique_pair UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT blocked_users_no_self_block CHECK (blocker_user_id <> blocked_user_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant block records"
ON public.blocked_users
FOR SELECT
TO authenticated
USING (auth.uid() = blocker_user_id OR auth.uid() = blocked_user_id);

CREATE POLICY "Users can create their own block records"
ON public.blocked_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "Users can delete their own block records"
ON public.blocked_users
FOR DELETE
TO authenticated
USING (auth.uid() = blocker_user_id);

CREATE OR REPLACE FUNCTION public.is_sender_blocked_in_conversation(_conversation_id uuid, _sender_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.blocked_users bu
      ON bu.blocker_user_id = cp.user_id
     AND bu.blocked_user_id = _sender_id
    WHERE cp.conversation_id = _conversation_id
      AND cp.user_id <> _sender_id
  );
$$;

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

CREATE POLICY "Users can send messages to their conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
  AND NOT public.is_sender_blocked_in_conversation(conversation_id, auth.uid())
);
