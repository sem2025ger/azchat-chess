-- Clubs NRW v1: additive, QA only, no games or automated league imports.
BEGIN;
CREATE TABLE public.clubs_nrw (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{3,64}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 120),
 city text NOT NULL CHECK(length(btrim(city)) BETWEEN 2 AND 100),
 address text CHECK(address IS NULL OR length(address)<=250),
 training_times text CHECK(training_times IS NULL OR length(training_times)<=500),
 website_url text CHECK(website_url IS NULL OR (website_url ~ '^https://[a-zA-Z0-9.-]+(/[^[:space:]]*)?$' AND length(website_url)<=500)),
 source_url text CHECK(source_url IS NULL OR length(source_url)<=500),
 published boolean NOT NULL DEFAULT false
);
CREATE TABLE public.clubs_nrw_members (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 club_id uuid NOT NULL REFERENCES public.clubs_nrw(id) ON DELETE CASCADE,
 public_roster boolean NOT NULL DEFAULT false,
 chosen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clubs_nrw_roster_idx ON public.clubs_nrw_members(club_id) WHERE public_roster;
-- Club role assignments are service-role only; users cannot promote themselves.
CREATE TABLE public.clubs_nrw_roles (
 club_id uuid NOT NULL REFERENCES public.clubs_nrw(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('owner','moderator','admin')),
 PRIMARY KEY(club_id,user_id)
);
CREATE TABLE public.clubs_nrw_calendar (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES public.clubs_nrw(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 4 AND 120),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz CHECK(ends_at IS NULL OR ends_at>starts_at),
 venue text CHECK(venue IS NULL OR length(venue)<=200),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid NOT NULL REFERENCES public.profiles(id)
);
CREATE INDEX clubs_nrw_calendar_by_date ON public.clubs_nrw_calendar(club_id,starts_at);
CREATE TABLE public.clubs_nrw_league_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES public.clubs_nrw(id) ON DELETE CASCADE,
 season text NOT NULL CHECK(length(season) BETWEEN 4 AND 20),
 league text NOT NULL CHECK(length(league) BETWEEN 3 AND 100),
 team text NOT NULL CHECK(length(team) BETWEEN 3 AND 120),
 place integer NOT NULL CHECK(place BETWEEN 1 AND 100),
 played integer NOT NULL DEFAULT 0 CHECK(played BETWEEN 0 AND 100),
 match_points numeric(5,1) NOT NULL DEFAULT 0 CHECK(match_points BETWEEN 0 AND 200),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),
 UNIQUE(club_id,season,league,team)
);
-- Link only to an existing PR #126 closed room, never create a game here.
CREATE TABLE public.clubs_nrw_room_links (
 club_id uuid NOT NULL REFERENCES public.clubs_nrw(id) ON DELETE CASCADE,
 room_id uuid NOT NULL UNIQUE REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
 PRIMARY KEY(club_id,room_id)
);
CREATE TABLE public.clubs_nrw_duels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 home_club_id uuid NOT NULL REFERENCES public.clubs_nrw(id),
 away_club_id uuid NOT NULL REFERENCES public.clubs_nrw(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 4 AND 120),
 proposed_for timestamptz,
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','withdrawn')),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(home_club_id <> away_club_id)
);
REVOKE ALL ON public.clubs_nrw,public.clubs_nrw_members,public.clubs_nrw_roles,
 public.clubs_nrw_calendar,public.clubs_nrw_league_rows,public.clubs_nrw_room_links,
 public.clubs_nrw_duels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.clubs_nrw TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clubs_nrw_members TO authenticated;
GRANT SELECT ON public.clubs_nrw_roles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clubs_nrw_calendar,public.clubs_nrw_league_rows TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.clubs_nrw_room_links TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.clubs_nrw_duels TO authenticated;
ALTER TABLE public.clubs_nrw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_nrw_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_nrw_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_nrw_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_nrw_league_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_nrw_room_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_nrw_duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY nrw_club_read ON public.clubs_nrw FOR SELECT TO anon,authenticated USING(published);
CREATE POLICY nrw_member_read ON public.clubs_nrw_members FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public_roster);
CREATE POLICY nrw_member_insert ON public.clubs_nrw_members FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.clubs_nrw c WHERE c.id=club_id AND c.published));
CREATE POLICY nrw_member_update ON public.clubs_nrw_members FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.clubs_nrw c WHERE c.id=club_id AND c.published));
CREATE POLICY nrw_member_delete ON public.clubs_nrw_members FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY nrw_role_self ON public.clubs_nrw_roles FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION public.clubs_nrw_editor(p_club uuid,p_admin boolean DEFAULT false)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.clubs_nrw_roles r WHERE r.club_id=p_club AND r.user_id=(SELECT auth.uid())
 AND (NOT p_admin OR r.role IN ('admin','owner')));
 $$;
REVOKE ALL ON FUNCTION public.clubs_nrw_editor(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clubs_nrw_editor(uuid,boolean) TO authenticated;
CREATE POLICY nrw_calendar_read ON public.clubs_nrw_calendar FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.clubs_nrw c WHERE c.id=club_id AND c.published));
CREATE POLICY nrw_calendar_add ON public.clubs_nrw_calendar FOR INSERT TO authenticated WITH CHECK(public.clubs_nrw_editor(club_id) AND created_by=(SELECT auth.uid()) AND updated_by=(SELECT auth.uid()));
CREATE POLICY nrw_calendar_edit ON public.clubs_nrw_calendar FOR UPDATE TO authenticated USING(public.clubs_nrw_editor(club_id)) WITH CHECK(public.clubs_nrw_editor(club_id) AND updated_by=(SELECT auth.uid()));
CREATE POLICY nrw_calendar_remove ON public.clubs_nrw_calendar FOR DELETE TO authenticated USING(public.clubs_nrw_editor(club_id));
CREATE POLICY nrw_league_read ON public.clubs_nrw_league_rows FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.clubs_nrw c WHERE c.id=club_id AND c.published));
CREATE POLICY nrw_league_add ON public.clubs_nrw_league_rows FOR INSERT TO authenticated WITH CHECK(public.clubs_nrw_editor(club_id,true) AND updated_by=(SELECT auth.uid()));
CREATE POLICY nrw_league_edit ON public.clubs_nrw_league_rows FOR UPDATE TO authenticated USING(public.clubs_nrw_editor(club_id,true)) WITH CHECK(public.clubs_nrw_editor(club_id,true) AND updated_by=(SELECT auth.uid()));
CREATE POLICY nrw_league_remove ON public.clubs_nrw_league_rows FOR DELETE TO authenticated USING(public.clubs_nrw_editor(club_id,true));
-- No dependency on an unmerged 'kind' SQL column: if absent, links fail closed.
CREATE FUNCTION public.clubs_nrw_room_editor(p_club uuid,p_room uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.clubs_nrw_roles r WHERE r.club_id=p_club AND r.user_id=(SELECT auth.uid()))
 AND EXISTS(
  SELECT 1 FROM public.chess_clubs c JOIN public.chess_club_members m ON m.club_id=c.id
  WHERE c.id=p_room AND NOT c.is_open AND pg_catalog.to_jsonb(c)->>'kind'='room'
   AND m.user_id=(SELECT auth.uid()) AND m.role IN('admin','moderator'));
 $$;
REVOKE ALL ON FUNCTION public.clubs_nrw_room_editor(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clubs_nrw_room_editor(uuid,uuid) TO authenticated;
CREATE POLICY nrw_room_read ON public.clubs_nrw_room_links FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.chess_club_members m WHERE m.club_id=room_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY nrw_room_add ON public.clubs_nrw_room_links FOR INSERT TO authenticated WITH CHECK(public.clubs_nrw_room_editor(club_id,room_id));
CREATE POLICY nrw_room_remove ON public.clubs_nrw_room_links FOR DELETE TO authenticated USING(public.clubs_nrw_room_editor(club_id,room_id));
CREATE POLICY nrw_duel_read ON public.clubs_nrw_duels FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.clubs_nrw c WHERE c.id=home_club_id AND c.published)
 AND EXISTS(SELECT 1 FROM public.clubs_nrw c WHERE c.id=away_club_id AND c.published));
CREATE POLICY nrw_duel_add ON public.clubs_nrw_duels FOR INSERT TO authenticated WITH CHECK(
 public.clubs_nrw_editor(home_club_id) AND created_by=(SELECT auth.uid()) AND status='proposed');
CREATE POLICY nrw_duel_update ON public.clubs_nrw_duels FOR UPDATE TO authenticated USING(public.clubs_nrw_editor(home_club_id))
 WITH CHECK(public.clubs_nrw_editor(home_club_id) AND status IN ('proposed','withdrawn'));
-- Curated directory entries; no invented training addresses or meeting hours.
INSERT INTO public.clubs_nrw(slug,name,city,website_url,source_url,published) VALUES
 ('bochumer-sv-02','Bochumer Schachverein 02','Bochum','https://bochumersv02.de','https://ergebnisdienst.svr-schach.de/index.php/vereine?saison=0&view=vereinsliste',true),
 ('sg-bochum-1931','Schachgesellschaft Bochum 1931','Bochum',NULL,'https://ergebnisdienst.svr-schach.de/index.php/vereine?saison=0&view=vereinsliste',true);

-- Prevent editor forgery of authorship and cross-club reassignment after INSERT.
CREATE FUNCTION public.clubs_nrw_immutable_identity_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
 BEGIN
  IF TG_OP='UPDATE' AND (
    (pg_catalog.to_jsonb(NEW)->>'club_id' IS DISTINCT FROM pg_catalog.to_jsonb(OLD)->>'club_id')
    OR (TG_TABLE_NAME='clubs_nrw_calendar' AND pg_catalog.to_jsonb(NEW)->>'created_by' IS DISTINCT FROM pg_catalog.to_jsonb(OLD)->>'created_by')
    OR (TG_TABLE_NAME='clubs_nrw_duels' AND (
       pg_catalog.to_jsonb(NEW)->>'home_club_id' IS DISTINCT FROM pg_catalog.to_jsonb(OLD)->>'home_club_id'
       OR pg_catalog.to_jsonb(NEW)->>'away_club_id' IS DISTINCT FROM pg_catalog.to_jsonb(OLD)->>'away_club_id'
       OR pg_catalog.to_jsonb(NEW)->>'created_by' IS DISTINCT FROM pg_catalog.to_jsonb(OLD)->>'created_by'))
  ) THEN
   RAISE EXCEPTION 'immutable_record_identity' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION public.clubs_nrw_immutable_identity_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER clubs_nrw_calendar_identity BEFORE UPDATE ON public.clubs_nrw_calendar
 FOR EACH ROW EXECUTE FUNCTION public.clubs_nrw_immutable_identity_guard();
CREATE TRIGGER clubs_nrw_league_identity BEFORE UPDATE ON public.clubs_nrw_league_rows
 FOR EACH ROW EXECUTE FUNCTION public.clubs_nrw_immutable_identity_guard();
CREATE TRIGGER clubs_nrw_duel_identity BEFORE UPDATE ON public.clubs_nrw_duels
 FOR EACH ROW EXECUTE FUNCTION public.clubs_nrw_immutable_identity_guard();
COMMIT;