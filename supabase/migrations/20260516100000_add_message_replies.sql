ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS replied_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS replied_message_content text,
ADD COLUMN IF NOT EXISTS replied_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS replied_message_type text;
