ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source_room_id text,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS winner_color text,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS initial_fen text,
  ADD COLUMN IF NOT EXISTS final_fen text;

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

DROP POLICY IF EXISTS "Matches are viewable by everyone."
  ON public.matches;

DROP POLICY IF EXISTS "Matches can be inserted by authenticated users (temp)"
  ON public.matches;

DROP POLICY IF EXISTS "Matches can be updated by authenticated users (temp)"
  ON public.matches;

DROP POLICY IF EXISTS "Participants can view their matches"
  ON public.matches;

CREATE POLICY "Participants can view their matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  auth.uid() = white_id
  OR auth.uid() = black_id
);

CREATE INDEX IF NOT EXISTS moves_match_id_idx
  ON public.moves (match_id);

ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Moves are viewable by everyone."
  ON public.moves;

DROP POLICY IF EXISTS "Moves can be inserted by authenticated users (temp)"
  ON public.moves;

DROP POLICY IF EXISTS "Participants can view moves for their matches"
  ON public.moves;

CREATE POLICY "Participants can view moves for their matches"
ON public.moves
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches AS match_row
    WHERE match_row.id = public.moves.match_id
      AND (
        auth.uid() = match_row.white_id
        OR auth.uid() = match_row.black_id
      )
  )
);
