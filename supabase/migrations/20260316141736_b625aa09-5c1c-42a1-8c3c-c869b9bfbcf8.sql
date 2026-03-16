
CREATE TABLE public.ai_chat_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'AI Assistant',
  avatar_url text,
  system_prompt text DEFAULT 'You are a helpful AI assistant. Be concise and friendly.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI profiles" ON public.ai_chat_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create AI profiles" ON public.ai_chat_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AI profiles" ON public.ai_chat_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI profiles" ON public.ai_chat_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_profile_id uuid NOT NULL REFERENCES public.ai_chat_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI messages" ON public.ai_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI messages" ON public.ai_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI messages" ON public.ai_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
