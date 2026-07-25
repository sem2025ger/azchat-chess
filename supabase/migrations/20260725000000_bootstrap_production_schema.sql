-- Controlled Production Schema Bootstrap Migration
-- Target Supabase Project Ref: kmwfvvliundhuovoakoa
-- Idempotent & Safe Single-Transaction Execution

BEGIN;

--------------------------------------------------------------------------------
-- 1. PREFLIGHT ASSERTION: FAIL-FAST IF PUBLIC SCHEMA IS NOT EMPTY
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'matches', 'moves', 'matchmaking_queue', 'chat_messages')
  ) THEN
    RAISE EXCEPTION 'Bootstrap aborted: One or more target tables (profiles, matches, moves, matchmaking_queue, chat_messages) already exist in public schema.';
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. EXTENSIONS
--------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 3. TABLE DEFINITIONS
--------------------------------------------------------------------------------

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  rating_blitz integer DEFAULT 1200,
  rating_rapid integer DEFAULT 1200,
  rating_bullet integer DEFAULT 1200,
  country_code text DEFAULT 'AZ',
  role text DEFAULT 'player',
  created_at timestamp with time zone DEFAULT now()
);

-- MATCHES TABLE (Enforces server/matchPersistence.js contract)
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_room_id text,
  white_id uuid REFERENCES public.profiles(id),
  black_id uuid REFERENCES public.profiles(id),
  winner_id uuid REFERENCES public.profiles(id),
  winner_color text,
  status text NOT NULL DEFAULT 'active',
  result text,
  termination_reason text,
  time_control text NOT NULL,
  initial_time integer NOT NULL,
  increment integer DEFAULT 0,
  fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  initial_fen text,
  final_fen text,
  pgn text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- MOVES TABLE
CREATE TABLE public.moves (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  move_san text NOT NULL,
  move_number integer NOT NULL,
  fen_after text NOT NULL,
  time_taken_ms integer,
  created_at timestamp with time zone DEFAULT now()
);

-- MATCHMAKING QUEUE TABLE
CREATE TABLE public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  time_control text NOT NULL,
  region text DEFAULT 'Global',
  rating integer NOT NULL,
  status text DEFAULT 'searching',
  joined_at timestamp with time zone DEFAULT now()
);

-- CHAT MESSAGES TABLE
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

--------------------------------------------------------------------------------
-- 4. CONSTRAINTS
--------------------------------------------------------------------------------
ALTER TABLE public.matches
  ADD CONSTRAINT matches_result_allowed_check
    CHECK (
      result IS NULL
      OR result IN ('1-0', '0-1', '1/2-1/2')
    ),
  ADD CONSTRAINT matches_winner_color_allowed_check
    CHECK (
      winner_color IS NULL
      OR winner_color IN ('w', 'b')
    ),
  ADD CONSTRAINT matches_termination_reason_allowed_check
    CHECK (
      termination_reason IS NULL
      OR termination_reason IN (
        'checkmate',
        'stalemate',
        'draw',
        'resignation',
        'draw_agreement',
        'opponent_disconnected'
      )
    ),
  ADD CONSTRAINT matches_completed_result_consistency_check
    CHECK (
      status <> 'completed'
      OR (
        (
          result = '1-0'
          AND winner_color IS NOT NULL
          AND winner_color = 'w'
          AND white_id IS NOT NULL
          AND winner_id IS NOT NULL
          AND winner_id = white_id
        )
        OR (
          result = '0-1'
          AND winner_color IS NOT NULL
          AND winner_color = 'b'
          AND black_id IS NOT NULL
          AND winner_id IS NOT NULL
          AND winner_id = black_id
        )
        OR (
          result = '1/2-1/2'
          AND winner_color IS NULL
          AND winner_id IS NULL
        )
      )
    ),
  ADD CONSTRAINT matches_completed_required_fields_check
    CHECK (
      status <> 'completed'
      OR (
        result IS NOT NULL
        AND termination_reason IS NOT NULL
        AND completed_at IS NOT NULL
      )
    ),
  ADD CONSTRAINT matches_completed_at_consistency_check
    CHECK (
      completed_at IS NULL
      OR created_at IS NULL
      OR completed_at >= created_at
    );

--------------------------------------------------------------------------------
-- 5. INDEXES
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS matches_white_id_idx ON public.matches (white_id);
CREATE INDEX IF NOT EXISTS matches_black_id_idx ON public.matches (black_id);
CREATE INDEX IF NOT EXISTS matches_completed_at_idx ON public.matches (completed_at);
CREATE UNIQUE INDEX IF NOT EXISTS matches_source_room_id_unique_idx ON public.matches (source_room_id) WHERE source_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS moves_match_id_idx ON public.moves (match_id);

--------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
--------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- MATCHES POLICIES (Read-only for participants; service-role key bypasses RLS for server writes)
CREATE POLICY "Participants can view their matches"
  ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() = white_id OR auth.uid() = black_id);

-- MOVES POLICIES (Read-only for participants; service-role key bypasses RLS for server writes)
CREATE POLICY "Participants can view moves for their matches"
  ON public.moves FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches AS match_row
      WHERE match_row.id = public.moves.match_id
        AND (auth.uid() = match_row.white_id OR auth.uid() = match_row.black_id)
    )
  );

-- MATCHMAKING QUEUE POLICIES
CREATE POLICY "Queue viewable by authenticated users"
  ON public.matchmaking_queue FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert themselves"
  ON public.matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can update their queue status"
  ON public.matchmaking_queue FOR UPDATE USING (auth.uid() = player_id);

-- CHAT MESSAGES POLICIES
CREATE POLICY "Chat viewable by everyone."
  ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat insertable by participants."
  ON public.chat_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

--------------------------------------------------------------------------------
-- 7. TRIGGER FUNCTION FOR NEW USER SIGNUP
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_uname text;
  clean_uname text;
  final_uname text;
BEGIN
  raw_uname := new.raw_user_meta_data->>'username';
  IF raw_uname IS NULL OR trim(raw_uname) = '' THEN
    raw_uname := split_part(new.email, '@', 1);
  END IF;

  clean_uname := regexp_replace(COALESCE(raw_uname, 'user'), '[^a-zA-Z0-9_]', '', 'g');
  IF clean_uname = '' THEN
    clean_uname := 'user';
  END IF;

  clean_uname := left(clean_uname, 30);
  final_uname := clean_uname || '_' || replace(new.id::text, '-', '');

  INSERT INTO public.profiles (id, username)
  VALUES (new.id, final_uname)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

--------------------------------------------------------------------------------
-- 8. EXISTING AUTH USERS BACKFILL
--------------------------------------------------------------------------------
INSERT INTO public.profiles (id, username)
SELECT
  u.id,
  left(
    COALESCE(
      NULLIF(regexp_replace(u.raw_user_meta_data->>'username', '[^a-zA-Z0-9_]', '', 'g'), ''),
      NULLIF(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''),
      'user'
    ), 30
  ) || '_' || replace(u.id::text, '-', '') AS username
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 9. POSTFLIGHT ASSERTIONS
--------------------------------------------------------------------------------
DO $$
DECLARE
  v_auth_count integer;
  v_profile_count integer;
  v_unmapped_count integer;
  v_missing_tables integer;
  v_missing_constraints integer;
  v_missing_policies integer;
  v_client_write_policies integer;
BEGIN
  -- Assert required tables exist
  SELECT count(*) INTO v_missing_tables
  FROM (VALUES ('profiles'), ('matches'), ('moves'), ('matchmaking_queue'), ('chat_messages')) AS t(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.table_name
  );

  IF v_missing_tables > 0 THEN
    RAISE EXCEPTION 'Postflight assertion failed: % required table(s) missing from public schema.', v_missing_tables;
  END IF;

  -- Assert profile counts and completeness vs auth.users
  SELECT count(*) INTO v_auth_count FROM auth.users;
  SELECT count(*) INTO v_profile_count FROM public.profiles;

  IF v_profile_count < v_auth_count THEN
    RAISE EXCEPTION 'Postflight assertion failed: profile count (%) is smaller than auth.users count (%).', v_profile_count, v_auth_count;
  END IF;

  SELECT count(*) INTO v_unmapped_count
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

  IF v_unmapped_count > 0 THEN
    RAISE EXCEPTION 'Postflight assertion failed: % auth.users row(s) lack matching profiles row(s).', v_unmapped_count;
  END IF;

  -- Assert required constraints exist on matches
  SELECT count(*) INTO v_missing_constraints
  FROM (VALUES
    ('matches_result_allowed_check'),
    ('matches_winner_color_allowed_check'),
    ('matches_termination_reason_allowed_check'),
    ('matches_completed_result_consistency_check'),
    ('matches_completed_required_fields_check'),
    ('matches_completed_at_consistency_check')
  ) AS c(constraint_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'matches' AND constraint_name = c.constraint_name
  );

  IF v_missing_constraints > 0 THEN
    RAISE EXCEPTION 'Postflight assertion failed: % required constraint(s) missing on public.matches.', v_missing_constraints;
  END IF;

  -- Assert participant SELECT policies exist
  SELECT count(*) INTO v_missing_policies
  FROM (VALUES
    ('matches', 'Participants can view their matches'),
    ('moves', 'Participants can view moves for their matches')
  ) AS p(table_name, policy_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p.table_name AND policyname = p.policy_name
  );

  IF v_missing_policies > 0 THEN
    RAISE EXCEPTION 'Postflight assertion failed: % required SELECT policy/policies missing.', v_missing_policies;
  END IF;

  -- Assert NO client-write policies exist on matches or moves
  SELECT count(*) INTO v_client_write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('matches', 'moves')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');

  IF v_client_write_policies > 0 THEN
    RAISE EXCEPTION 'Postflight assertion failed: % unexpected client-write policy/policies found on matches/moves.', v_client_write_policies;
  END IF;

END $$;

--------------------------------------------------------------------------------
-- 10. READ-ONLY SUMMARY REPORT
--------------------------------------------------------------------------------
SELECT count(*) AS total_auth_users FROM auth.users;
SELECT count(*) AS total_profiles FROM public.profiles;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'matches', 'moves', 'matchmaking_queue', 'chat_messages')
ORDER BY table_name;

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'matches'
ORDER BY constraint_name;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

COMMIT;
