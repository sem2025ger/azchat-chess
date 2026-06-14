-- Explanation of schema:
-- 1. this table stores only games with an official chess result;
-- 2. games abandoned without an official result are not persisted in Phase 1;
-- 3. a future no-contest/aborted model can be added separately;
-- 4. result and winner are authoritative for outcome;
-- 5. termination records the ending reason.
-- 6. matches.id is the durable game identifier;
-- 7. source_room_id records the originating Socket.IO room (nullable and not unique; rooms may be reused across games).
-- 8. PGN is the canonical source for reconstructing the review;
-- 9. username and rating values are historical snapshots;
-- 10. Phase 1 initially persists only games where both players are authenticated;
-- 11. guest multiplayer remains supported, but guest games are not persisted;
-- 12. server persistence is not implemented by this migration;
-- 13. the participant SELECT policy becomes useful only after future server persistence writes real Supabase user UUIDs into white_id and black_id;
-- 14. the service-role key must exist only on the backend and must never be exposed through Vite or frontend environment variables.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.matches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_room_id text,
    white_id uuid NOT NULL REFERENCES public.profiles(id),
    black_id uuid NOT NULL REFERENCES public.profiles(id),
    winner_id uuid NULL REFERENCES public.profiles(id),
    white_username text NOT NULL,
    black_username text NOT NULL,
    white_rating integer NOT NULL,
    black_rating integer NOT NULL,
    rating_pool text NOT NULL,
    time_control text NOT NULL,
    initial_time integer NOT NULL,
    increment integer NOT NULL DEFAULT 0,
    initial_fen text NOT NULL,
    final_fen text NOT NULL,
    pgn text NOT NULL,
    result text NOT NULL,
    termination text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT matches_white_diff_black
        CHECK (white_id <> black_id),
    CONSTRAINT matches_winner_valid
        CHECK (
            winner_id IS NULL
            OR winner_id = white_id
            OR winner_id = black_id
        ),
    CONSTRAINT matches_rating_pool_check
        CHECK (rating_pool IN ('bullet', 'blitz', 'rapid')),
    CONSTRAINT matches_ratings_nonnegative
        CHECK (white_rating >= 0 AND black_rating >= 0),
    CONSTRAINT matches_initial_time_positive
        CHECK (initial_time > 0),
    CONSTRAINT matches_increment_nonnegative
        CHECK (increment >= 0),
    CONSTRAINT matches_completed_after_created
        CHECK (completed_at >= created_at),
    CONSTRAINT matches_result_check
        CHECK (result IN ('1-0', '0-1', '1/2-1/2')),
    CONSTRAINT matches_result_winner_consistent CHECK (
        (
            result = '1/2-1/2'
            AND winner_id IS NULL
        )
        OR
        (
            result = '1-0'
            AND winner_id IS NOT NULL
            AND winner_id = white_id
        )
        OR
        (
            result = '0-1'
            AND winner_id IS NOT NULL
            AND winner_id = black_id
        )
    ),
    CONSTRAINT matches_termination_check CHECK (
        termination IN (
            'checkmate',
            'resignation',
            'timeout',
            'draw_agreement',
            'stalemate',
            'insufficient_material',
            'threefold_repetition',
            'fifty_move_rule',
            'disconnect',
            'abandoned'
        )
    )
);

CREATE INDEX matches_white_id_completed_at_idx ON public.matches (white_id, completed_at DESC);
CREATE INDEX matches_black_id_completed_at_idx ON public.matches (black_id, completed_at DESC);
CREATE INDEX matches_completed_at_idx ON public.matches (completed_at DESC);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
    auth.uid() = white_id
    OR auth.uid() = black_id
);
