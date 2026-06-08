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
  ) OR EXISTS (
    SELECT 1
    FROM public.blocked_users bu
    WHERE bu.blocker_user_id = _receiver_id
      AND bu.blocked_user_id = _sender_id
  ) OR EXISTS (
    SELECT 1
    FROM public.blocked_devices bd
    WHERE bd.blocker_user_id = _receiver_id
      AND bd.blocked_user_id = _sender_id
      AND (_sender_device_id IS NOT NULL AND bd.device_id = _sender_device_id)
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
