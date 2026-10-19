'use strict';

const { createClient } = require('@supabase/supabase-js');
const { setTimeout: delay } = require('node:timers/promises');

const VALID_RESULTS = new Set(['1-0', '0-1', '1/2-1/2']);
const VALID_TERMINATION_REASONS = new Set([
  'checkmate',
  'stalemate',
  'draw',
  'resignation',
  'draw_agreement',
  'opponent_disconnected',
  'timeout',
]);
const DRAW_TERMINATION_REASONS = new Set([
  'stalemate',
  'draw',
  'draw_agreement',
]);
const DECISIVE_TERMINATION_REASONS = new Set([
  'checkmate',
  'resignation',
  'opponent_disconnected',
  'timeout',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

class MatchPersistenceError extends Error {
  constructor(message, { cause, code, status } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'MatchPersistenceError';

    if (code !== undefined) {
      this.code = code;
    }
    if (Number.isInteger(status)) this.status = status;
  }
}

function validationError(message) {
  return new MatchPersistenceError(`Invalid completed match: ${message}`, {
    code: 'MATCH_VALIDATION_ERROR',
  });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireUuid(value, fieldName) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw validationError(`${fieldName} must be a valid UUID`);
  }
}

function normalizeTimestamp(value, fieldName) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw validationError(`${fieldName} must be a valid date or ISO timestamp`);
    }

    return value.toISOString();
  }

  if (
    typeof value !== 'string'
    || !ISO_TIMESTAMP_PATTERN.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    throw validationError(`${fieldName} must be a valid date or ISO timestamp`);
  }

  return new Date(value).toISOString();
}

function validateCompletedMatch(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw validationError('record must be a non-null object');
  }

  requireUuid(record.id, 'id');
  requireUuid(record.whiteId, 'whiteId');
  requireUuid(record.blackId, 'blackId');

  if (record.whiteId === record.blackId) {
    throw validationError('whiteId and blackId must be different');
  }

  if (!isNonEmptyString(record.sourceRoomId)) {
    throw validationError('sourceRoomId must be a non-empty string');
  }

  if (!isNonEmptyString(record.timeControl)) {
    throw validationError('timeControl must be a non-empty string');
  }

  if (!Number.isInteger(record.initialTime) || record.initialTime <= 0) {
    throw validationError('initialTime must be a positive integer');
  }

  if (!Number.isInteger(record.increment) || record.increment < 0) {
    throw validationError('increment must be a non-negative integer');
  }

  if (!isNonEmptyString(record.initialFen)) {
    throw validationError('initialFen must be a non-empty string');
  }

  if (!isNonEmptyString(record.finalFen)) {
    throw validationError('finalFen must be a non-empty string');
  }

  if (typeof record.pgn !== 'string') {
    throw validationError('pgn must be a string');
  }

  const createdAt = normalizeTimestamp(record.createdAt, 'createdAt');
  const completedAt = normalizeTimestamp(record.completedAt, 'completedAt');

  if (Date.parse(completedAt) < Date.parse(createdAt)) {
    throw validationError('completedAt must not precede createdAt');
  }

  if (!VALID_RESULTS.has(record.result)) {
    throw validationError('result is not supported');
  }

  if (!VALID_TERMINATION_REASONS.has(record.terminationReason)) {
    throw validationError('terminationReason is not supported');
  }

  if (
    (record.result === '1-0'
      && (record.winnerColor !== 'w' || record.winnerId !== record.whiteId))
    || (record.result === '0-1'
      && (record.winnerColor !== 'b' || record.winnerId !== record.blackId))
    || (record.result === '1/2-1/2'
      && (record.winnerColor !== null || record.winnerId !== null))
  ) {
    throw validationError('result and winner are inconsistent');
  }

  if (
    (DRAW_TERMINATION_REASONS.has(record.terminationReason)
      && record.result !== '1/2-1/2')
    || (DECISIVE_TERMINATION_REASONS.has(record.terminationReason)
      && record.result === '1/2-1/2')
  ) {
    throw validationError('terminationReason and result are inconsistent');
  }

  return { createdAt, completedAt };
}

function safeErrorCode(error) {
  if (
    error
    && (typeof error.code === 'string' || typeof error.code === 'number')
    && /^[A-Za-z0-9_-]{1,64}$/.test(String(error.code))
  ) {
    return error.code;
  }

  return undefined;
}

function persistenceError(error, status) {
  return new MatchPersistenceError('Failed to persist completed match', {
    cause: error,
    code: safeErrorCode(error),
    status,
  });
}

function classifyPersistenceError(error) {
  // Inspect causes too: fetch/PostgREST wrap transport failures differently.
  for (let current = error, depth = 0; current && depth < 5; current = current.cause, depth++) {
    const code = String(safeErrorCode(current) ?? '');
    const status = current.status ?? (/^\d{3}$/.test(code) ? Number(code) : undefined);
    if (/^(22|23|28|42)[A-Z0-9]{3}$/.test(code) || code.startsWith('MATCH_')) return 'permanent';
    if ([400, 401, 403, 404, 405, 406, 409, 422].includes(status)) return 'permanent';
  }
  for (let current = error, depth = 0; current && depth < 5; current = current.cause, depth++) {
    const code = String(safeErrorCode(current) ?? '');
    const status = current.status ?? (/^\d{3}$/.test(code) ? Number(code) : undefined);
    if (
      /^(08|53)[A-Z0-9]{3}$/.test(code)
      || /^(40001|40P01|55P03|57014|57P0[123]|PGRST00[0-3])$/.test(code)
      || /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|UND_ERR_SOCKET)$/.test(code)
      || [408, 425, 429].includes(status)
      || (status >= 500 && status <= 599)
      || ['AbortError', 'TimeoutError'].includes(current.name)
      || /\b(fetch failed|failed to fetch|network error|network request failed|socket hang up|connection (?:reset|refused|terminated|closed|failed)|connection pool|timed? ?out|timeout)\b/i.test(current.message || '')
    ) return 'transient';
  }
  return 'permanent';
}

function lastPersistenceErrorCode(error) {
  for (let current = error, depth = 0; current && depth < 5; current = current.cause, depth++) {
    const code = safeErrorCode(current);
    if (code !== undefined) return code;
    if (Number.isInteger(current.status) && current.status >= 100 && current.status <= 599) {
      return `HTTP_${current.status}`;
    }
  }
  return 'UNKNOWN';
}

function persistRoomCompletedMatch(room, record, adapter, {
  wait = delay,
  logError = (entry) => console.error(JSON.stringify(entry)),
} = {}) {
  // Single flight also guards repeated callers while a write is in progress.
  if (room.persistencePromise) return room.persistencePromise;
  if (room.persisted) return Promise.resolve(true);

  room.persistencePromise = (async () => {
    const retryDelays = [1000, 4000]; // Three attempts total, including the initial write.
    for (let attempts = 1; attempts <= 3; attempts++) {
      try {
        const saved = await adapter.persistCompletedMatch(record);
        if (saved?.id !== record.id) {
          throw new MatchPersistenceError('Completed match acknowledgement has the wrong id', {
            code: 'MATCH_INVALID_ACK',
          });
        }
        room.persisted = true;
        return true;
      } catch (error) {
        const errorClass = classifyPersistenceError(error);
        if (errorClass === 'transient' && attempts < 3) {
          await wait(retryDelays[attempts - 1]);
          continue;
        }
        room.persisted = false;
        logError({
          code: 'MATCH_PERSIST_FAILED',
          matchId: record.id,
          attempts,
          errorClass,
          lastErrorCode: lastPersistenceErrorCode(error),
        });
        return false;
      }
    }
  })();
  return room.persistencePromise;
}

function createMatchPersistenceFromEnv({
  env = process.env,
  createClientImpl = createClient,
} = {}) {
  const supabaseUrl = env && env.SUPABASE_URL;
  const serviceKey = env && env.SUPABASE_SERVICE_KEY;

  if (!isNonEmptyString(supabaseUrl)) {
    throw new MatchPersistenceError('Missing required server env: SUPABASE_URL');
  }

  if (!isNonEmptyString(serviceKey)) {
    throw new MatchPersistenceError('Missing required server env: SUPABASE_SERVICE_KEY');
  }

  const client = createClientImpl(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    async persistCompletedMatch(record) {
      const { createdAt, completedAt } = validateCompletedMatch(record);
      const row = {
        id: record.id,
        source_room_id: record.sourceRoomId,
        white_id: record.whiteId,
        black_id: record.blackId,
        winner_id: record.winnerId,
        winner_color: record.winnerColor,
        status: 'completed',
        result: record.result,
        termination_reason: record.terminationReason,
        time_control: record.timeControl,
        initial_time: record.initialTime,
        increment: record.increment,
        fen: record.finalFen,
        initial_fen: record.initialFen,
        final_fen: record.finalFen,
        pgn: record.pgn,
        created_at: createdAt,
        completed_at: completedAt,
      };

      let response;

      try {
        response = await client
          .from('matches')
          .insert(row)
          .select('id')
          .single();
      } catch (error) {
        throw persistenceError(error);
      }

      if (response && response.error) {
        if (response.error.code === '23505') {
          // A lost INSERT acknowledgement can be followed by a duplicate on retry.
          // Confirm this exact completed match; unrelated unique conflicts still fail.
          let existing;
          try {
            existing = await client.from('matches')
              .select('id, source_room_id, status')
              .eq('id', record.id)
              .maybeSingle();
          } catch (error) {
            throw persistenceError(error);
          }
          if (existing?.error) throw persistenceError(existing.error, existing.status);
          if (existing?.data?.id === record.id
            && existing.data.source_room_id === record.sourceRoomId
            && existing.data.status === 'completed') {
            return { id: record.id };
          }
        }
        throw persistenceError(response.error, response.status);
      }

      if (!response || !response.data || !response.data.id) {
        throw new MatchPersistenceError('Completed match persistence returned no id');
      }

      return { id: response.data.id };
    },
  };
}

module.exports = {
  createMatchPersistenceFromEnv,
  MatchPersistenceError,
  classifyPersistenceError,
  persistRoomCompletedMatch,
};
