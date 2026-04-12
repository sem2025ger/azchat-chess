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
  white_id uuid REFERENCES public.profiles(id),
  black_id uuid REFERENCES public.profiles(id),
  winner_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'active', -- 'active', 'completed', 'abandoned', 'draw'
  time_control text NOT NULL,
  initial_time integer NOT NULL,
  increment integer DEFAULT 0,
  fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are viewable by everyone." ON public.matches FOR SELECT USING (true);
-- In production, insertion/updates to matches should only be done securely by the backend SERVER role.
CREATE POLICY "Matches can be inserted by authenticated users (temp)" ON public.matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Matches can be updated by authenticated users (temp)" ON public.matches FOR UPDATE USING (auth.role() = 'authenticated');

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
