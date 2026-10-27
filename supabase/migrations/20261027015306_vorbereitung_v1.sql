BEGIN;
ALTER TABLE public.spieltag_boards ADD COLUMN opponent_lichess_username text
 CHECK(opponent_lichess_username IS NULL OR opponent_lichess_username ~ '^[A-Za-z0-9_-]{2,30}$');
COMMENT ON COLUMN public.spieltag_boards.opponent_lichess_username IS 'Captain-supplied, unverified Lichess username; private to the assigned team. Never identity verification.';
GRANT UPDATE(opponent_lichess_username) ON public.spieltag_boards TO authenticated;
-- Existing explicit team SELECT and captain-only UPDATE RLS remain unchanged.
COMMIT;
