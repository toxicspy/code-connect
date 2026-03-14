-- Add creator tracking to make freshly inserted conversations immediately visible to creator
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill existing rows from first participant (safe for existing data)
UPDATE public.conversations c
SET created_by = x.user_id
FROM (
  SELECT cp.conversation_id, MIN(cp.user_id::text)::uuid AS user_id
  FROM public.conversation_participants cp
  GROUP BY cp.conversation_id
) x
WHERE c.id = x.conversation_id
  AND c.created_by IS NULL;

-- Ensure new conversations are attributed to the authenticated creator
ALTER TABLE public.conversations
ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.conversations
ALTER COLUMN created_by SET NOT NULL;

-- Replace conversations policies to avoid insert+select RLS failure
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_conversation_participant(id, auth.uid())
);