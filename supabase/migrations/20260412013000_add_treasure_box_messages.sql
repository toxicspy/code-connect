ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS hidden_message TEXT,
ADD COLUMN IF NOT EXISTS is_opened BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_message_type_check'
  ) THEN
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('text', 'treasure'));
  END IF;
END $$;

UPDATE public.messages
SET message_type = 'text'
WHERE message_type IS NULL;
