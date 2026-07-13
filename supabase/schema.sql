-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
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

-- Row Level Security for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- MATCHES
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_room_id text,
  white_id uuid REFERENCES public.profiles(id),
  black_id uuid REFERENCES public.profiles(id),
  winner_id uuid REFERENCES public.profiles(id),
  winner_color text,
  status text NOT NULL DEFAULT 'active', -- 'active', 'completed', 'abandoned', 'draw'
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

ALTER TABLE public.matches
  ADD CONSTRAINT matches_result_allowed_check
    CHECK (
      result IS NULL
      OR result IN ('1-0', '0-1', '1/2-1/2')
    ) NOT VALID,
  ADD CONSTRAINT matches_winner_color_allowed_check
    CHECK (
      winner_color IS NULL
      OR winner_color IN ('w', 'b')
    ) NOT VALID,
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
    ) NOT VALID,
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
    ) NOT VALID,
  ADD CONSTRAINT matches_completed_required_fields_check
    CHECK (
      status <> 'completed'
      OR (
        result IS NOT NULL
        AND termination_reason IS NOT NULL
        AND completed_at IS NOT NULL
      )
    ) NOT VALID,
  ADD CONSTRAINT matches_completed_at_consistency_check
    CHECK (
      completed_at IS NULL
      OR created_at IS NULL
      OR completed_at >= created_at
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS matches_white_id_idx
  ON public.matches (white_id);

CREATE INDEX IF NOT EXISTS matches_black_id_idx
  ON public.matches (black_id);

CREATE INDEX IF NOT EXISTS matches_completed_at_idx
  ON public.matches (completed_at);

CREATE INDEX IF NOT EXISTS matches_source_room_id_idx
  ON public.matches (source_room_id);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view their matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  auth.uid() = white_id
  OR auth.uid() = black_id
);

-- MOVES
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

ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Moves are viewable by everyone." ON public.moves FOR SELECT USING (true);
CREATE POLICY "Moves can be inserted by authenticated users (temp)" ON public.moves FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- MATCHMAKING QUEUE
CREATE TABLE public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  time_control text NOT NULL,
  region text DEFAULT 'Global',
  rating integer NOT NULL,
  status text DEFAULT 'searching', -- 'searching', 'matched', 'cancelled'
  joined_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Queue viewable by authenticated users" ON public.matchmaking_queue FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert themselves" ON public.matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can update their queue status" ON public.matchmaking_queue FOR UPDATE USING (auth.uid() = player_id);

-- CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat viewable by everyone." ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat insertable by participants." ON public.chat_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Helpful function to handle new user signup automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
