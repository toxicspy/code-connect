ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT;

INSERT INTO storage.buckets (id, name, public)
SELECT 'chat-media', 'chat-media', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'chat-media'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload chat media'
  ) THEN
    CREATE POLICY "Users can upload chat media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update chat media'
  ) THEN
    CREATE POLICY "Users can update chat media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete chat media'
  ) THEN
    CREATE POLICY "Users can delete chat media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view chat media'
  ) THEN
    CREATE POLICY "Anyone can view chat media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'chat-media');
  END IF;
END $$;
