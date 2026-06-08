CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  user_agent text,
  platform text,
  language text,
  timezone text,
  screen_resolution text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_devices_unique_pair UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.blocked_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  blocker_user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_devices_unique_triplet UNIQUE (device_id, blocker_user_id, blocked_user_id)
);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
ON public.user_devices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own devices"
ON public.user_devices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
ON public.user_devices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view relevant blocked devices"
ON public.blocked_devices
FOR SELECT
TO authenticated
USING (auth.uid() = blocker_user_id OR auth.uid() = blocked_user_id);

CREATE POLICY "Users can create blocked device records"
ON public.blocked_devices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "Users can delete their blocked device records"
ON public.blocked_devices
FOR DELETE
TO authenticated
USING (auth.uid() = blocker_user_id);

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS device_id text;

CREATE OR REPLACE FUNCTION public.is_device_blocked(_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_devices
    WHERE device_id = _device_id
  );
$$;
