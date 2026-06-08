CREATE TABLE IF NOT EXISTS public.user_encryption_identities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_encryption_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view encryption identities"
ON public.user_encryption_identities
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own encryption identity"
ON public.user_encryption_identities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own encryption identity"
ON public.user_encryption_identities
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_encryption_identities_updated_at
BEFORE UPDATE ON public.user_encryption_identities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
