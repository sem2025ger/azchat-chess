'use strict';

const { createClient } = require('@supabase/supabase-js');

const VALID_RESULTS = new Set(['1-0', '0-1', '1/2-1/2']);
const VALID_TERMINATION_REASONS = new Set([
  'checkmate',
  'stalemate',
  'draw',
  'resignation',
  'draw_agreement',
  'opponent_disconnected',
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
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

class MatchPersistenceError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'MatchPersistenceError';

    if (code !== undefined) {
      this.code = code;
    }
  }
}

function validationError(message) {
  return new MatchPersistenceError(`Invalid completed match: ${message}`);
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

function persistenceError(error) {
  return new MatchPersistenceError('Failed to persist completed match', {
    cause: error,
    code: safeErrorCode(error),
  });
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
        throw persistenceError(response.error);
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
};
