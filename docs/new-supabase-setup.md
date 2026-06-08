# New Supabase Setup

This app has already been pointed at the new Supabase project:

- Project URL: `https://npwrjtkljiaqdidaulrz.supabase.co`
- Project ID: `npwrjtkljiaqdidaulrz`

## 1. Run the database schema

Open the Supabase dashboard for the new project.

Go to:

- `SQL Editor`

Run the full SQL bundle from:

- [supabase/bootstrap.sql](/c:/Users/zero/Desktop/code-connect/code-connect/supabase/bootstrap.sql)

That bundle includes:

- tables
- RLS policies
- helper functions
- triggers
- storage bucket policies
- realtime table setup
- profile search index

## 2. Edge functions to deploy

This app uses two Supabase edge functions:

- `translate`
- `ai-chat`

Source files:

- [translate](/c:/Users/zero/Desktop/code-connect/code-connect/supabase/functions/translate/index.ts)
- [ai-chat](/c:/Users/zero/Desktop/code-connect/code-connect/supabase/functions/ai-chat/index.ts)

## 3. Required function secret

Both functions require:

- `OPENAI_API_KEY`

Without that secret:

- translation will fail
- AI chat replies will fail

The project is now set up to use OpenAI directly from Supabase Edge Functions.

## 4. Recommended Supabase auth settings

In the Supabase dashboard, check:

- `Authentication` -> `Settings` -> `Sessions`

Recommended while stabilizing auth:

- `Time-box user sessions`: disabled
- `Inactivity timeout`: disabled
- `Single session per user`: off

## 5. Storage bucket expected by the app

The app expects a public storage bucket:

- `avatars`

The SQL bundle creates the bucket policy rules for it.

## 6. Realtime tables expected by the app

The app expects realtime enabled for:

- `public.messages`
- `public.conversations`

The SQL bundle already includes the publication statements.

## 7. Post-migration smoke test

After running the SQL and deploying functions:

1. Open the live site.
2. Create a new account.
3. Refresh the page.
4. Confirm the session stays active.
5. Search another user by display name.
6. Search another user by `#user_code`.
7. Start a conversation.
8. Send a message.
9. Edit profile and upload avatar.
10. Open AI chat and test response generation.
11. Test translation if `OPENAI_API_KEY` is configured.

## 8. If you want me to finish the migration directly

I can do more of this from here if you provide one of these:

- Supabase database password for SQL connection, or
- Supabase access token plus permission to use the Supabase CLI

With that, I can help push the schema and functions rather than only preparing them.
