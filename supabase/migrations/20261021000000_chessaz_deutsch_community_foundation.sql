-- ChessAZ Deutsch community foundation. REVIEW ONLY: never apply to production automatically.
-- One public, open founding club. All participant data remains protected by RLS.
BEGIN;

CREATE TABLE public.chess_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '',
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chess_club_members (
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX chess_club_members_user_idx ON public.chess_club_members(user_id);

CREATE TABLE public.chess_club_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200 AND body = btrim(body)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chess_club_messages_feed_idx ON public.chess_club_messages(club_id, created_at DESC);

CREATE TABLE public.chess_club_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 4 AND 100),
  format text NOT NULL DEFAULT 'blitz' CHECK (format IN ('bullet', 'blitz', 'rapid')),
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'scheduled', 'cancelled', 'completed')),
  min_players smallint NOT NULL DEFAULT 4 CHECK (min_players BETWEEN 2 AND 32),
  max_players smallint NOT NULL DEFAULT 16 CHECK (max_players BETWEEN 2 AND 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chess_club_events_capacity_check CHECK (min_players <= max_players)
);
CREATE INDEX chess_club_events_feed_idx ON public.chess_club_events(club_id, created_at DESC);

CREATE TABLE public.chess_club_event_participants (
  event_id uuid NOT NULL REFERENCES public.chess_club_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX chess_club_event_participants_user_idx
  ON public.chess_club_event_participants(user_id);

-- Explicit grants: no global table default privileges and no browser UPDATE on
-- membership roles, event status or authorship.
REVOKE ALL ON TABLE public.chess_clubs, public.chess_club_members,
  public.chess_club_messages, public.chess_club_events,
  public.chess_club_event_participants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chess_clubs TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.chess_club_members TO authenticated;
GRANT SELECT, INSERT ON public.chess_club_messages TO authenticated;
GRANT SELECT, INSERT ON public.chess_club_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.chess_club_event_participants TO authenticated;

ALTER TABLE public.chess_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY chess_clubs_public_read ON public.chess_clubs FOR SELECT TO anon, authenticated
  USING (is_open);
-- Open club membership is discoverable to signed-in chess players; this is a
-- public community roster, not a private-membership model.
CREATE POLICY chess_club_members_read ON public.chess_club_members FOR SELECT TO authenticated
  USING (true);
CREATE POLICY chess_club_members_join ON public.chess_club_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND role = 'member'
    AND EXISTS (SELECT 1 FROM public.chess_clubs c WHERE c.id = club_id AND c.is_open)
  );
CREATE POLICY chess_club_members_leave ON public.chess_club_members FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND role = 'member');

CREATE POLICY chess_club_messages_read ON public.chess_club_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chess_club_members m
    WHERE m.club_id = chess_club_messages.club_id AND m.user_id = (SELECT auth.uid())
  ));
CREATE POLICY chess_club_messages_post ON public.chess_club_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chess_club_members m
      WHERE m.club_id = chess_club_messages.club_id AND m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY chess_club_events_read ON public.chess_club_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chess_club_members m
    WHERE m.club_id = chess_club_events.club_id AND m.user_id = (SELECT auth.uid())
  ));
CREATE POLICY chess_club_events_create ON public.chess_club_events FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND status = 'collecting'
    AND EXISTS (
      SELECT 1 FROM public.chess_club_members m
      WHERE m.club_id = chess_club_events.club_id AND m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY chess_club_event_participants_read ON public.chess_club_event_participants
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.chess_club_events e
    JOIN public.chess_club_members m ON m.club_id = e.club_id
    WHERE e.id = chess_club_event_participants.event_id
      AND m.user_id = (SELECT auth.uid())
  ));
CREATE POLICY chess_club_event_participants_join ON public.chess_club_event_participants
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chess_club_events e
      JOIN public.chess_club_members m ON m.club_id = e.club_id
      WHERE e.id = chess_club_event_participants.event_id
        AND e.status = 'collecting'
        AND m.user_id = (SELECT auth.uid())
        AND (SELECT count(*) FROM public.chess_club_event_participants p
             WHERE p.event_id = e.id) < e.max_players
    )
  );
CREATE POLICY chess_club_event_participants_leave ON public.chess_club_event_participants
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

INSERT INTO public.chess_clubs (slug, name, description, country_code)
VALUES ('chessaz-deutsch', 'ChessAZ Deutsch',
  'Deutschsprachiges Schachforum für Austausch und gemeinsame Events.', 'DE');

COMMIT;
