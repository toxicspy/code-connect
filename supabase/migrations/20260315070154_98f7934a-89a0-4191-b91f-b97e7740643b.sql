
-- Add pinned and archived columns to conversation_participants
ALTER TABLE public.conversation_participants 
  ADD COLUMN is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Allow users to update their own participation (for pin/archive)
CREATE POLICY "Users can update their own participation"
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own participation (leave/delete chat)
CREATE POLICY "Users can delete their own participation"
  ON public.conversation_participants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
