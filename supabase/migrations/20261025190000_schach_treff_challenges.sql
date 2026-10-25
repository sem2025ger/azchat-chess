-- Schach-Treff Phase 4: unrated chat challenges; QA only.
BEGIN;
ALTER TABLE public.chess_club_messages
  ADD COLUMN kind text NOT NULL DEFAULT 'text'
  CONSTRAINT chess_club_messages_kind_check CHECK (kind IN ('text','challenge'));

CREATE TABLE public.chess_club_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES public.chess_club_messages(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  time_control text NOT NULL CHECK(time_control IN ('3+2','5+0','10+0')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','expired','cancelled')),
  accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  CONSTRAINT club_challenge_distinct_target CHECK(target_user_id IS DISTINCT FROM created_by),
  CONSTRAINT club_challenge_expiry CHECK(expires_at>created_at)
);
CREATE INDEX chess_club_challenges_club_status_idx ON public.chess_club_challenges(club_id,status,expires_at);
CREATE INDEX chess_club_challenges_creator_idx ON public.chess_club_challenges(created_by,status);

REVOKE ALL ON TABLE public.chess_club_challenges FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.chess_club_challenges TO authenticated;
-- The service account is the only DB writer for challenge state.
GRANT SELECT,INSERT,UPDATE ON TABLE public.chess_club_challenges TO service_role;
ALTER TABLE public.chess_club_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_challenges_member_read ON public.chess_club_challenges FOR SELECT TO authenticated
USING (EXISTS(
  SELECT 1 FROM public.chess_club_members m
  WHERE m.club_id=chess_club_challenges.club_id AND m.user_id=(SELECT auth.uid())
));
-- service_role bypasses RLS through Supabase's existing service authorization.
-- No INSERT, UPDATE or DELETE policies or grants for authenticated users.
COMMIT;
