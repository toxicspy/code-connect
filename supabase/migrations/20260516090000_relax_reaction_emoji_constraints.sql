ALTER TABLE public.message_reactions
DROP CONSTRAINT IF EXISTS message_reactions_emoji_check;

ALTER TABLE public.message_reactions
ADD CONSTRAINT message_reactions_emoji_check
CHECK (
  emoji = ANY (
    ARRAY[
      chr(10084) || chr(65039),
      chr(128514),
      chr(128077),
      chr(128558),
      chr(128546),
      chr(128293)
    ]
  )
);

ALTER TABLE public.ai_message_reactions
DROP CONSTRAINT IF EXISTS ai_message_reactions_emoji_check;

ALTER TABLE public.ai_message_reactions
ADD CONSTRAINT ai_message_reactions_emoji_check
CHECK (
  emoji = ANY (
    ARRAY[
      chr(10084) || chr(65039),
      chr(128514),
      chr(128077),
      chr(128558),
      chr(128546),
      chr(128293)
    ]
  )
);
