BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  rating_blitz integer DEFAULT 1200,
  rating_rapid integer DEFAULT 1200,
  rating_bullet integer DEFAULT 1200,
  country_code text DEFAULT 'AZ',
  role text DEFAULT 'player',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT matches_result_allowed_check
    CHECK (result IS NULL OR result IN ('1-0','0-1','1/2-1/2')),
  CONSTRAINT matches_winner_color_allowed_check
    CHECK (winner_color IS NULL OR winner_color IN ('w','b')),
  CONSTRAINT matches_termination_reason_allowed_check
    CHECK (
      termination_reason IS NULL OR termination_reason IN (
        'checkmate','stalemate','draw','resignation',
        'draw_agreement','opponent_disconnected','timeout'
      )
    ),
  CONSTRAINT matches_completed_result_consistency_check
    CHECK (
      status <> 'completed'
      OR (
        (result='1-0' AND winner_color='w' AND white_id IS NOT NULL AND winner_id=white_id)
        OR (result='0-1' AND winner_color='b' AND black_id IS NOT NULL AND winner_id=black_id)
        OR (result='1/2-1/2' AND winner_color IS NULL AND winner_id IS NULL)
      )
    ),
  CONSTRAINT matches_completed_required_fields_check
    CHECK (
      status <> 'completed'
      OR (result IS NOT NULL AND termination_reason IS NOT NULL AND completed_at IS NOT NULL)
    ),
  CONSTRAINT matches_completed_at_consistency_check
    CHECK (completed_at IS NULL OR created_at IS NULL OR completed_at >= created_at)
);

CREATE TABLE public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  move_san text NOT NULL,
  move_number integer NOT NULL,
  fen_after text NOT NULL,
  time_taken_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  time_control text NOT NULL,
  region text DEFAULT 'Global',
  rating integer NOT NULL,
  status text DEFAULT 'searching',
  joined_at timestamptz DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX matches_white_id_idx ON public.matches(white_id);
CREATE INDEX matches_black_id_idx ON public.matches(black_id);
CREATE INDEX matches_completed_at_idx ON public.matches(completed_at);
CREATE UNIQUE INDEX matches_source_room_id_unique_idx
  ON public.matches(source_room_id) WHERE source_room_id IS NOT NULL;
CREATE INDEX moves_match_id_idx ON public.moves(match_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Participants can view their matches"
ON public.matches FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = white_id
  OR (SELECT auth.uid()) = black_id
);

CREATE POLICY "Participants can view moves for their matches"
ON public.moves FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches AS m
    WHERE m.id = public.moves.match_id
      AND ((SELECT auth.uid()) = m.white_id OR (SELECT auth.uid()) = m.black_id)
  )
);

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  IF clean_uname = '' THEN clean_uname := 'user'; END IF;

  clean_uname := left(clean_uname, 30);
  final_uname := clean_uname || '_' || replace(new.id::text, '-', '');

  INSERT INTO public.profiles(id, username)
  VALUES (new.id, final_uname)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

INSERT INTO public.profiles(id, username)
SELECT
  u.id,
  left(
    COALESCE(
      NULLIF(regexp_replace(u.raw_user_meta_data->>'username', '[^a-zA-Z0-9_]', '', 'g'), ''),
      NULLIF(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''),
      'user'
    ),
    30
  ) || '_' || replace(u.id::text, '-', '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  missing_tables integer;
  auth_count integer;
  profile_count integer;
  timeout_ok boolean;
BEGIN
  SELECT count(*) INTO missing_tables
  FROM (VALUES ('profiles'),('matches'),('moves'),('matchmaking_queue'),('chat_messages')) AS x(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=x.name
  );

  IF missing_tables <> 0 THEN
    RAISE EXCEPTION 'Bootstrap failed: % required table(s) missing.', missing_tables;
  END IF;

  SELECT count(*) INTO auth_count FROM auth.users;
  SELECT count(*) INTO profile_count FROM public.profiles;
  IF profile_count < auth_count THEN
    RAISE EXCEPTION 'Bootstrap failed: profiles % < auth users %.', profile_count, auth_count;
  END IF;

  SELECT position('timeout' in pg_get_constraintdef(c.oid)) > 0
  INTO timeout_ok
  FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public'
    AND t.relname='matches'
    AND c.conname='matches_termination_reason_allowed_check';

  IF COALESCE(timeout_ok,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Bootstrap failed: timeout constraint missing.';
  END IF;
END;
$$;

COMMIT;