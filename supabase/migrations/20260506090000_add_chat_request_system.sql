ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS device_id text;

UPDATE public.profiles
SET username = COALESCE(NULLIF(username, ''), display_name)
WHERE username IS NULL;

CREATE TABLE IF NOT EXISTS public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT chat_requests_no_self_request CHECK (sender_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.chat_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chats_no_self_pair CHECK (user1_id <> user2_id)
);

CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_no_self_block CHECK (blocker_id <> blocked_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_requests_pending_pair_idx
ON public.chat_requests (sender_id, receiver_id)
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS chats_pair_idx
ON public.chats (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

CREATE UNIQUE INDEX IF NOT EXISTS blocks_pair_idx
ON public.blocks (blocker_id, blocked_user_id);

CREATE INDEX IF NOT EXISTS chat_requests_receiver_status_idx
ON public.chat_requests (receiver_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_requests_sender_status_idx
ON public.chat_requests (sender_id, status, created_at DESC);

ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own chat requests" ON public.chat_requests;
CREATE POLICY "Users can insert own chat requests"
ON public.chat_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can view incoming chat requests" ON public.chat_requests;
CREATE POLICY "Receivers can view incoming chat requests"
ON public.chat_requests
FOR SELECT
TO authenticated
USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Senders can view outgoing chat requests" ON public.chat_requests;
CREATE POLICY "Senders can view outgoing chat requests"
ON public.chat_requests
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can update incoming chat requests" ON public.chat_requests;
CREATE POLICY "Receivers can update incoming chat requests"
ON public.chat_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
CREATE POLICY "Users can view their chats"
ON public.chats
FOR SELECT
TO authenticated
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can create their chats" ON public.chats;
CREATE POLICY "Users can create their chats"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocks;
CREATE POLICY "Users can view own blocks"
ON public.blocks
FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can insert own blocks" ON public.blocks;
CREATE POLICY "Users can insert own blocks"
ON public.blocks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.sync_profile_device_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET device_id = NEW.device_id
  WHERE user_id = NEW.user_id
    AND (device_id IS DISTINCT FROM NEW.device_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_device_id_from_user_devices ON public.user_devices;
CREATE TRIGGER sync_profile_device_id_from_user_devices
AFTER INSERT OR UPDATE OF device_id, last_seen_at
ON public.user_devices
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_device_id();

CREATE OR REPLACE FUNCTION public.get_latest_device_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.device_id FROM public.profiles p WHERE p.user_id = _user_id),
    (
      SELECT ud.device_id
      FROM public.user_devices ud
      WHERE ud.user_id = _user_id
      ORDER BY ud.last_seen_at DESC
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.send_chat_request(_receiver_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_id uuid := auth.uid();
  _sender_device_id text;
  _request_id uuid;
  _daily_count integer;
BEGIN
  IF _sender_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _receiver_id IS NULL OR _receiver_id = _sender_id THEN
    RAISE EXCEPTION 'Invalid receiver';
  END IF;

  _sender_device_id := public.get_latest_device_id(_sender_id);

  IF EXISTS (
    SELECT 1
    FROM public.blocks b
    WHERE b.blocker_id = _receiver_id
      AND (
        b.blocked_user_id = _sender_id
        OR (_sender_device_id IS NOT NULL AND b.blocked_device_id = _sender_device_id)
      )
  ) THEN
    RAISE EXCEPTION 'Access restricted due to policy violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chat_requests cr
    WHERE cr.sender_id = _sender_id
      AND cr.receiver_id = _receiver_id
      AND cr.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Request already pending';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE LEAST(c.user1_id, c.user2_id) = LEAST(_sender_id, _receiver_id)
      AND GREATEST(c.user1_id, c.user2_id) = GREATEST(_sender_id, _receiver_id)
  ) THEN
    RAISE EXCEPTION 'Chat already available';
  END IF;

  SELECT COUNT(*)
  INTO _daily_count
  FROM public.chat_requests cr
  WHERE cr.sender_id = _sender_id
    AND cr.created_at >= date_trunc('day', now());

  IF _daily_count >= 5 THEN
    RAISE EXCEPTION 'Daily request limit reached';
  END IF;

  INSERT INTO public.chat_requests (sender_id, receiver_id)
  VALUES (_sender_id, _receiver_id)
  RETURNING id INTO _request_id;

  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_chat_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request record;
  _conversation_id uuid;
  _chat_id uuid;
BEGIN
  SELECT *
  INTO _request
  FROM public.chat_requests
  WHERE id = _request_id
    AND receiver_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT c.id, c.conversation_id
  INTO _chat_id, _conversation_id
  FROM public.chats c
  WHERE LEAST(c.user1_id, c.user2_id) = LEAST(_request.sender_id, _request.receiver_id)
    AND GREATEST(c.user1_id, c.user2_id) = GREATEST(_request.sender_id, _request.receiver_id)
  LIMIT 1;

  IF _conversation_id IS NULL THEN
    INSERT INTO public.conversations (created_by)
    VALUES (auth.uid())
    RETURNING id INTO _conversation_id;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES
      (_conversation_id, _request.sender_id),
      (_conversation_id, _request.receiver_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.chats (user1_id, user2_id, conversation_id, request_id)
    VALUES (
      LEAST(_request.sender_id, _request.receiver_id),
      GREATEST(_request.sender_id, _request.receiver_id),
      _conversation_id,
      _request.id
    )
    ON CONFLICT ((LEAST(user1_id, user2_id)), (GREATEST(user1_id, user2_id)))
    DO UPDATE SET conversation_id = COALESCE(public.chats.conversation_id, EXCLUDED.conversation_id),
                  request_id = EXCLUDED.request_id
    RETURNING id INTO _chat_id;
  END IF;

  UPDATE public.chat_requests
  SET status = 'accepted',
      updated_at = now(),
      responded_at = now()
  WHERE id = _request.id;

  RETURN jsonb_build_object(
    'request_id', _request.id,
    'chat_id', _chat_id,
    'conversation_id', _conversation_id,
    'sender_id', _request.sender_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_chat_request(_request_id uuid, _should_block boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request record;
  _blocked_device_id text;
  _block_id uuid;
BEGIN
  SELECT *
  INTO _request
  FROM public.chat_requests
  WHERE id = _request_id
    AND receiver_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  UPDATE public.chat_requests
  SET status = 'rejected',
      updated_at = now(),
      responded_at = now()
  WHERE id = _request.id;

  IF _should_block THEN
    _blocked_device_id := public.get_latest_device_id(_request.sender_id);

    INSERT INTO public.blocks (blocker_id, blocked_user_id, blocked_device_id)
    VALUES (auth.uid(), _request.sender_id, _blocked_device_id)
    ON CONFLICT (blocker_id, blocked_user_id)
    DO UPDATE SET blocked_device_id = COALESCE(EXCLUDED.blocked_device_id, public.blocks.blocked_device_id)
    RETURNING id INTO _block_id;

    INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id)
    VALUES (auth.uid(), _request.sender_id)
    ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING;

    IF _blocked_device_id IS NOT NULL THEN
      INSERT INTO public.blocked_devices (blocker_user_id, blocked_user_id, device_id)
      VALUES (auth.uid(), _request.sender_id, _blocked_device_id)
      ON CONFLICT (device_id, blocker_user_id, blocked_user_id) DO NOTHING;
    END IF;

    RETURN _block_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_chat_user(_blocked_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _blocked_device_id text;
  _block_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _blocked_user_id IS NULL OR _blocked_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  _blocked_device_id := public.get_latest_device_id(_blocked_user_id);

  INSERT INTO public.blocks (blocker_id, blocked_user_id, blocked_device_id)
  VALUES (auth.uid(), _blocked_user_id, _blocked_device_id)
  ON CONFLICT (blocker_id, blocked_user_id)
  DO UPDATE SET blocked_device_id = COALESCE(EXCLUDED.blocked_device_id, public.blocks.blocked_device_id)
  RETURNING id INTO _block_id;

  INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id)
  VALUES (auth.uid(), _blocked_user_id)
  ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING;

  IF _blocked_device_id IS NOT NULL THEN
    INSERT INTO public.blocked_devices (blocker_user_id, blocked_user_id, device_id)
    VALUES (auth.uid(), _blocked_user_id, _blocked_device_id)
    ON CONFLICT (device_id, blocker_user_id, blocked_user_id) DO NOTHING;
  END IF;

  RETURN _block_id;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
