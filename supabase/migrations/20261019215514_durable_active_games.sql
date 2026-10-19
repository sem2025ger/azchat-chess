-- Additive only. Apply separately after owner approval. Do not replay bootstrap.
BEGIN;

CREATE TABLE public.durable_games (
  room_id uuid PRIMARY KEY,
  match_id uuid NOT NULL UNIQUE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  owner_id uuid NOT NULL,
  fence bigint NOT NULL DEFAULT 1 CHECK (fence > 0),
  lease_until timestamptz NOT NULL,
  last_request uuid NOT NULL,
  state jsonb NOT NULL,
  result_saved boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT durable_games_state_check CHECK (
    pg_catalog.jsonb_typeof(state) = 'object'
    AND state - ARRAY['userIds','initialFen','moves','timeControl','initialTime',
      'increment','whiteTimeMs','blackTimeMs','lastMoveTimestamp','startedAt',
      'status','drawOfferBy','disconnects','outcome','completedAt','isPrivate'] = '{}'::jsonb
    AND state ?& ARRAY['userIds','status']
    AND state->>'status' IN ('active','ended')
    AND pg_catalog.jsonb_typeof(state->'userIds') = 'object'
    AND (state->'userIds'->>'w')::uuid IS NOT NULL
    AND (state->'userIds'->>'b')::uuid IS NOT NULL
    AND state->'userIds'->>'w' <> state->'userIds'->>'b'
    AND (NOT result_saved OR (state->>'status' = 'ended' AND NOT state ? 'moves'))
    AND (result_saved OR (
      state ?& ARRAY['initialFen','moves','whiteTimeMs','blackTimeMs',
        'lastMoveTimestamp','startedAt','timeControl','initialTime','increment','disconnects']
      AND pg_catalog.jsonb_typeof(state->'moves') = 'array'
      AND (state->>'whiteTimeMs')::bigint >= 0
      AND (state->>'blackTimeMs')::bigint >= 0
      AND (state->>'lastMoveTimestamp')::bigint > 0
      AND (state->>'initialTime')::integer > 0
      AND (state->>'increment')::integer >= 0
    ))
    AND (state->>'status' <> 'ended' OR state ? 'outcome')
  )
);

CREATE INDEX durable_games_recovery_idx ON public.durable_games (lease_until)
  WHERE NOT result_saved;
ALTER TABLE public.durable_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.durable_games FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.durable_games TO service_role;

-- SECURITY INVOKER: only service_role has table privileges and bypasses RLS.
-- One call is one transaction. Row locks plus revision/fence/lease checks fence
-- overlapping processes. A request UUID resolves a lost acknowledgement.
CREATE FUNCTION public.durable_game_transition(
  p_operation text, p_room_id uuid, p_match_id uuid, p_owner_id uuid,
  p_fence bigint, p_revision bigint, p_request_id uuid, p_state jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  r public.durable_games%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_operation = 'scan' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'rows', COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(g)) FROM public.durable_games g WHERE NOT g.result_saved
    ), '[]'::jsonb));
  END IF;
  IF p_operation = 'start' THEN
    IF p_state->>'status' IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_start';
    END IF;
    INSERT INTO public.durable_games
      (room_id, match_id, owner_id, lease_until, last_request, state)
      VALUES (p_room_id, p_match_id, p_owner_id,
        pg_catalog.clock_timestamp() + interval '15 seconds', p_request_id, p_state)
      ON CONFLICT (room_id) DO NOTHING;
  END IF;

  SELECT * INTO r FROM public.durable_games WHERE room_id = p_room_id FOR UPDATE;
  v_now := pg_catalog.clock_timestamp(); -- evaluate AFTER acquiring the lock
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF p_operation = 'read' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'row', pg_catalog.to_jsonb(r));
  END IF;
  IF p_operation = 'claim' THEN
    IF r.lease_until > v_now THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'owned_elsewhere');
    END IF;
    UPDATE public.durable_games SET owner_id = p_owner_id, fence = fence + 1,
      lease_until = v_now + interval '15 seconds', updated_at = v_now
      WHERE room_id = p_room_id RETURNING * INTO r;
    RETURN pg_catalog.jsonb_build_object('ok', true, 'row', pg_catalog.to_jsonb(r));
  END IF;
  IF r.owner_id IS DISTINCT FROM p_owner_id OR r.fence IS DISTINCT FROM p_fence
    OR r.lease_until <= v_now THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'ownership_lost');
  END IF;
  IF p_operation = 'renew' THEN
    UPDATE public.durable_games SET lease_until = v_now + interval '15 seconds',
      updated_at = v_now WHERE room_id = p_room_id RETURNING * INTO r;
  ELSIF p_operation = 'complete' AND r.result_saved THEN
    -- A response can be lost after the atomic result+compaction transaction.
    IF EXISTS (SELECT 1 FROM public.matches m WHERE m.id = r.match_id
      AND m.source_room_id = r.room_id::text AND m.status = 'completed'
      AND m.white_id = (r.state->'userIds'->>'w')::uuid
      AND m.black_id = (r.state->'userIds'->>'b')::uuid
      AND m.result = r.state->'outcome'->>'result') THEN
      RETURN pg_catalog.jsonb_build_object('ok', true, 'row', pg_catalog.to_jsonb(r));
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'completed_match_conflict';
  ELSIF r.last_request = p_request_id THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'row', pg_catalog.to_jsonb(r));
  ELSIF p_operation IN ('commit', 'ack', 'complete') THEN
    IF r.revision IS DISTINCT FROM p_revision OR r.result_saved THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'revision_conflict');
    END IF;
    IF p_operation = 'complete' THEN
      IF r.state->>'status' <> 'ended'
        OR pg_catalog.jsonb_typeof(p_state->'pgn') IS DISTINCT FROM 'string'
        OR pg_catalog.jsonb_typeof(p_state->'finalFen') IS DISTINCT FROM 'string'
        OR p_state->>'finalFen' = '' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_completion';
      END IF;
      INSERT INTO public.matches (id, source_room_id, white_id, black_id,
        winner_id, winner_color, status, result, termination_reason, time_control,
        initial_time, increment, fen, initial_fen, final_fen, pgn, created_at, completed_at)
      VALUES (r.match_id, r.room_id::text, (r.state->'userIds'->>'w')::uuid,
        (r.state->'userIds'->>'b')::uuid,
        CASE r.state->'outcome'->>'winnerColor'
          WHEN 'w' THEN (r.state->'userIds'->>'w')::uuid
          WHEN 'b' THEN (r.state->'userIds'->>'b')::uuid ELSE NULL END,
        r.state->'outcome'->>'winnerColor', 'completed', r.state->'outcome'->>'result',
        r.state->'outcome'->>'reason', r.state->>'timeControl',
        (r.state->>'initialTime')::integer, (r.state->>'increment')::integer,
        p_state->>'finalFen', r.state->>'initialFen', p_state->>'finalFen', p_state->>'pgn',
        (r.state->>'startedAt')::timestamptz, (r.state->>'completedAt')::timestamptz)
      ON CONFLICT (id) DO NOTHING;
      -- Verify the exact immutable result after a duplicate, not an unrelated
      -- source-room or ID conflict. All existing matches constraints still apply.
      IF NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = r.match_id
        AND m.source_room_id = r.room_id::text AND m.status = 'completed'
        AND m.white_id = (r.state->'userIds'->>'w')::uuid
        AND m.black_id = (r.state->'userIds'->>'b')::uuid
        AND m.result = r.state->'outcome'->>'result'
        AND m.termination_reason = r.state->'outcome'->>'reason'
        AND m.final_fen = p_state->>'finalFen' AND m.pgn = p_state->>'pgn') THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'completed_match_conflict';
      END IF;
      p_state := pg_catalog.jsonb_build_object('userIds', r.state->'userIds',
        'status', 'ended', 'outcome', r.state->'outcome');
    ELSIF p_operation = 'ack' THEN
      -- Never erase the handoff on an unconfirmed or unrelated result.
      IF r.state->>'status' <> 'ended' OR NOT EXISTS (
        SELECT 1 FROM public.matches m WHERE m.id = r.match_id
          AND m.source_room_id = r.room_id::text AND m.status = 'completed'
          AND m.white_id = (r.state->'userIds'->>'w')::uuid
          AND m.black_id = (r.state->'userIds'->>'b')::uuid
          AND m.result = r.state->'outcome'->>'result'
      ) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'result_unconfirmed');
      END IF;
      p_state := pg_catalog.jsonb_build_object('userIds', r.state->'userIds',
        'status', 'ended', 'outcome', r.state->'outcome');
    ELSE
      IF r.state->>'status' = 'ended'
        OR p_state->'userIds' IS DISTINCT FROM r.state->'userIds'
        OR p_state->'initialFen' IS DISTINCT FROM r.state->'initialFen'
        OR p_state->'startedAt' IS DISTINCT FROM r.state->'startedAt'
        OR p_state->'timeControl' IS DISTINCT FROM r.state->'timeControl'
        OR p_state->'initialTime' IS DISTINCT FROM r.state->'initialTime'
        OR p_state->'increment' IS DISTINCT FROM r.state->'increment' THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_transition');
      END IF;
    END IF;
    UPDATE public.durable_games SET state = p_state, revision = revision + 1,
      last_request = p_request_id, result_saved = (p_operation IN ('ack', 'complete')), updated_at = v_now
      WHERE room_id = p_room_id RETURNING * INTO r;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_operation';
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'row', pg_catalog.to_jsonb(r));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.durable_game_transition(text,uuid,uuid,uuid,bigint,bigint,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.durable_game_transition(text,uuid,uuid,uuid,bigint,bigint,uuid,jsonb)
  TO service_role;
COMMIT;
