CREATE OR REPLACE FUNCTION public.unblock_chat_user(_blocked_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.blocks
  WHERE blocker_id = auth.uid()
    AND blocked_user_id = _blocked_user_id;

  DELETE FROM public.blocked_users
  WHERE blocker_user_id = auth.uid()
    AND blocked_user_id = _blocked_user_id;

  DELETE FROM public.blocked_devices
  WHERE blocker_user_id = auth.uid()
    AND blocked_user_id = _blocked_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_and_accept_chat_request(_request_id uuid)
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
    AND status IN ('pending', 'rejected')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  PERFORM public.unblock_chat_user(_request.sender_id);

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
