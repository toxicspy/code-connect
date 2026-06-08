CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
ON public.profiles
USING gin (display_name gin_trgm_ops);
