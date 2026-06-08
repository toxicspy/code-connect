ALTER TABLE public.message_reactions
DROP CONSTRAINT IF EXISTS message_reactions_emoji_check;

ALTER TABLE public.message_reactions
ADD CONSTRAINT message_reactions_emoji_check
CHECK (emoji IN (U&'\2764\FE0F', U&'\01F602', U&'\01F44D', U&'\01F62E', U&'\01F622', U&'\01F525'));

ALTER TABLE public.ai_message_reactions
DROP CONSTRAINT IF EXISTS ai_message_reactions_emoji_check;

ALTER TABLE public.ai_message_reactions
ADD CONSTRAINT ai_message_reactions_emoji_check
CHECK (emoji IN (U&'\2764\FE0F', U&'\01F602', U&'\01F44D', U&'\01F62E', U&'\01F622', U&'\01F525'));
