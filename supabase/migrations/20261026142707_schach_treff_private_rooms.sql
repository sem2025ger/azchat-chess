BEGIN;
ALTER TABLE public.chess_clubs ADD COLUMN kind text NOT NULL DEFAULT 'community' CHECK(kind IN ('community','room')),
 ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX club_rooms_creator_idx ON public.chess_clubs(created_by) WHERE kind='room';
CREATE TABLE public.chess_club_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT(now()+interval '14 days'),
 max_uses integer NOT NULL DEFAULT 50 CHECK(max_uses BETWEEN 1 AND 50),uses integer NOT NULL DEFAULT 0 CHECK(uses>=0 AND uses<=max_uses)
);
CREATE INDEX club_invites_club_idx ON public.chess_club_invites(club_id);
CREATE INDEX club_invites_creator_idx ON public.chess_club_invites(created_by);
ALTER TABLE public.chess_club_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chess_club_invites FROM PUBLIC,anon,authenticated,service_role;
-- Own membership helper avoids recursive member/club RLS. No caller-supplied user.
CREATE FUNCTION private.my_club_member(p_club uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=p_club AND user_id=auth.uid());
$fn$;
REVOKE ALL ON FUNCTION private.my_club_member(uuid) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.my_club_member(uuid) TO authenticated;
-- Anonymous callers must not evaluate the authenticated-only membership helper.
DROP POLICY chess_clubs_public_read ON public.chess_clubs;
CREATE POLICY chess_clubs_public_read ON public.chess_clubs FOR SELECT TO anon USING(is_open);
CREATE POLICY chess_clubs_member_read ON public.chess_clubs FOR SELECT TO authenticated USING(is_open OR private.my_club_member(id));
ALTER POLICY chess_club_members_read ON public.chess_club_members USING(
 private.my_club_member(club_id) OR EXISTS(SELECT 1 FROM public.chess_clubs c WHERE c.id=club_id AND c.is_open));

CREATE FUNCTION public.create_club_room(p_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid(); answer uuid; clean text:=btrim(p_name);
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF clean IS NULL OR char_length(clean) NOT BETWEEN 3 AND 60 THEN RAISE EXCEPTION 'invalid_room_name' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,1));
 IF (SELECT count(*) FROM public.chess_clubs WHERE created_by=actor AND kind='room')>=2 THEN RAISE EXCEPTION 'room_limit' USING ERRCODE='23514'; END IF;
 answer:=gen_random_uuid();
 INSERT INTO public.chess_clubs(id,slug,name,country_code,is_open,kind,created_by) VALUES(answer,'room-'||replace(answer::text,'-',''),clean,'DE',false,'room',actor);
 INSERT INTO public.chess_club_members(club_id,user_id,role) VALUES(answer,actor,'admin');
 RETURN answer;
END $fn$;
CREATE FUNCTION public.create_club_invite(p_club_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE plain text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.chess_club_members m JOIN public.chess_clubs c ON c.id=m.club_id
  WHERE m.club_id=p_club_id AND m.user_id=auth.uid() AND m.role IN ('admin','moderator') AND c.kind='room') THEN
  RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 plain:=encode(extensions.gen_random_bytes(16),'hex');
 INSERT INTO public.chess_club_invites(club_id,created_by,token_hash) VALUES(p_club_id,auth.uid(),encode(sha256(convert_to(plain,'UTF8')),'hex'));
 RETURN plain;
END $fn$;
CREATE FUNCTION public.join_club_by_invite(p_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=auth.uid(); invite public.chess_club_invites%ROWTYPE;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'invite_invalid' USING ERRCODE='22023'; END IF;
 SELECT * INTO invite FROM public.chess_club_invites WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invite_invalid' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=invite.club_id AND user_id=actor) THEN RETURN invite.club_id; END IF;
 IF invite.expires_at<=now() THEN RAISE EXCEPTION 'invite_expired' USING ERRCODE='22023'; END IF;
 IF invite.uses>=invite.max_uses THEN RAISE EXCEPTION 'invite_used' USING ERRCODE='23514'; END IF;
 INSERT INTO public.chess_club_members(club_id,user_id) VALUES(invite.club_id,actor) ON CONFLICT DO NOTHING;
 IF FOUND THEN UPDATE public.chess_club_invites SET uses=uses+1 WHERE id=invite.id; END IF;
 RETURN invite.club_id;
END $fn$;
REVOKE ALL ON FUNCTION public.create_club_room(text),public.create_club_invite(uuid),public.join_club_by_invite(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_club_room(text),public.create_club_invite(uuid),public.join_club_by_invite(text) TO authenticated;
COMMIT;
