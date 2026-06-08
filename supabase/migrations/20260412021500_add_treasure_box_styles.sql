ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS text_style TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS theme_type TEXT NOT NULL DEFAULT 'classic';

UPDATE public.messages
SET text_style = 'normal'
WHERE text_style IS NULL;

UPDATE public.messages
SET theme_type = 'classic'
WHERE theme_type IS NULL;
