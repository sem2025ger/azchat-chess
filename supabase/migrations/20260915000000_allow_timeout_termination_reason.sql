-- Controlled migration: allow 'timeout' in matches.termination_reason check constraint
-- Idempotent & Safe Single-Transaction Execution

BEGIN;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_termination_reason_allowed_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_termination_reason_allowed_check
    CHECK (
      termination_reason IS NULL
      OR termination_reason IN (
        'checkmate',
        'stalemate',
        'draw',
        'resignation',
        'draw_agreement',
        'opponent_disconnected',
        'timeout'
      )
    );

COMMIT;
