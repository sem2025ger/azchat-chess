-- Spieltag: private team planning only. Dependencies: PR #127 then PR #128.
BEGIN;
CREATE TABLE public.spieltag_teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES public.clubs_nrw(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 100),
 UNIQUE(club_id,name)
);
-- Authoritative roster, assigned by the owner. A voluntary NRW club selection
-- is NOT proof of membership and never authorizes reading team preparations.
CREATE TABLE public.spieltag_team_members (
 team_id uuid NOT NULL REFERENCES public.spieltag_teams(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('captain','member')),
 PRIMARY KEY(team_id,user_id)
);
CREATE INDEX spieltag_members_user_idx ON public.spieltag_team_members(user_id,team_id);
CREATE TABLE public.spieltag_matches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.spieltag_teams(id) ON DELETE CASCADE,
 round_label text NOT NULL CHECK(char_length(btrim(round_label)) BETWEEN 1 AND 80),
 opponent_name text NOT NULL CHECK(char_length(btrim(opponent_name)) BETWEEN 2 AND 150),
 opponent_club_id uuid REFERENCES public.clubs_nrw(id) ON DELETE SET NULL,
 starts_at timestamptz NOT NULL CHECK(isfinite(starts_at)),
 venue text NOT NULL DEFAULT '' CHECK(char_length(venue)<=250),
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=1000),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid NOT NULL REFERENCES public.profiles(id)
);
CREATE INDEX spieltag_matches_team_date_idx ON public.spieltag_matches(team_id,starts_at);
CREATE INDEX spieltag_matches_opponent_idx ON public.spieltag_matches(opponent_club_id);
CREATE INDEX spieltag_matches_created_by_idx ON public.spieltag_matches(created_by);
CREATE INDEX spieltag_matches_updated_by_idx ON public.spieltag_matches(updated_by);
CREATE TABLE public.spieltag_boards (
 match_id uuid NOT NULL REFERENCES public.spieltag_matches(id) ON DELETE CASCADE,
 board_number smallint NOT NULL CHECK(board_number BETWEEN 1 AND 32),
 home_name text NOT NULL CHECK(char_length(btrim(home_name)) BETWEEN 1 AND 150),
 home_fide_id bigint REFERENCES public.spieler_players(fide_id) ON DELETE SET NULL,
 opponent_name text NOT NULL DEFAULT '' CHECK(char_length(opponent_name)<=150),
 opponent_fide_id bigint REFERENCES public.spieler_players(fide_id) ON DELETE SET NULL,
 result text CHECK(result IN ('1-0','0-1','1/2-1/2','not_played')),
 PRIMARY KEY(match_id,board_number)
);
CREATE INDEX spieltag_boards_home_fide_idx ON public.spieltag_boards(home_fide_id);
CREATE INDEX spieltag_boards_opponent_fide_idx ON public.spieltag_boards(opponent_fide_id);
ALTER TABLE public.spieltag_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spieltag_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spieltag_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spieltag_boards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spieltag_teams,public.spieltag_team_members,public.spieltag_matches,public.spieltag_boards FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.spieltag_teams,public.spieltag_team_members,public.spieltag_matches,public.spieltag_boards TO service_role;
GRANT SELECT ON public.spieltag_teams,public.spieltag_team_members,public.spieltag_matches,public.spieltag_boards TO authenticated;
GRANT INSERT,DELETE ON public.spieltag_matches,public.spieltag_boards TO authenticated;
-- Column grants keep identifiers/authorship immutable even through direct REST.
GRANT UPDATE(round_label,opponent_name,opponent_club_id,starts_at,venue,notes,updated_by) ON public.spieltag_matches TO authenticated;
GRANT UPDATE(home_name,home_fide_id,opponent_name,opponent_fide_id,result) ON public.spieltag_boards TO authenticated;
CREATE POLICY spieltag_member_self ON public.spieltag_team_members FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
CREATE POLICY spieltag_team_read ON public.spieltag_teams FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_team_members m WHERE m.team_id=id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY spieltag_match_read ON public.spieltag_matches FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_team_members m WHERE m.team_id=spieltag_matches.team_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY spieltag_match_insert ON public.spieltag_matches FOR INSERT TO authenticated
 WITH CHECK(created_by=(SELECT auth.uid()) AND updated_by=(SELECT auth.uid()) AND EXISTS(
 SELECT 1 FROM public.spieltag_team_members m WHERE m.team_id=spieltag_matches.team_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'));
CREATE POLICY spieltag_match_update ON public.spieltag_matches FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_team_members m WHERE m.team_id=spieltag_matches.team_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'))
 WITH CHECK(updated_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.spieltag_team_members m WHERE m.team_id=spieltag_matches.team_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'));
CREATE POLICY spieltag_match_delete ON public.spieltag_matches FOR DELETE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_team_members m WHERE m.team_id=spieltag_matches.team_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'));
CREATE POLICY spieltag_board_read ON public.spieltag_boards FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_matches g WHERE g.id=match_id));
CREATE POLICY spieltag_board_insert ON public.spieltag_boards FOR INSERT TO authenticated
 WITH CHECK(EXISTS(SELECT 1 FROM public.spieltag_matches g JOIN public.spieltag_team_members m ON m.team_id=g.team_id
 WHERE g.id=match_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'));
CREATE POLICY spieltag_board_update ON public.spieltag_boards FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_matches g JOIN public.spieltag_team_members m ON m.team_id=g.team_id
 WHERE g.id=match_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'))
 WITH CHECK(EXISTS(SELECT 1 FROM public.spieltag_matches g JOIN public.spieltag_team_members m ON m.team_id=g.team_id
 WHERE g.id=match_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'));
CREATE POLICY spieltag_board_delete ON public.spieltag_boards FOR DELETE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.spieltag_matches g JOIN public.spieltag_team_members m ON m.team_id=g.team_id
 WHERE g.id=match_id AND m.user_id=(SELECT auth.uid()) AND m.role='captain'));
COMMIT;
