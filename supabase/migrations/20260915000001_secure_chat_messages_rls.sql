-- Migration: Secure chat_messages INSERT policy to require match participation
-- Safe single-transaction execution
BEGIN;

DROP POLICY IF EXISTS "Chat insertable by participants." ON public.chat_messages;

CREATE POLICY "Chat insertable by participants."
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = player_id
  AND EXISTS (
    SELECT 1
    FROM public.matches AS match_row
    WHERE match_row.id = public.chat_messages.match_id
      AND (
        auth.uid() = match_row.white_id
        OR auth.uid() = match_row.black_id
      )
  )
);

COMMIT;
