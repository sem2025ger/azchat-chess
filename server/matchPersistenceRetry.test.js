'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMatchPersistenceFromEnv,
  classifyPersistenceError,
  persistRoomCompletedMatch,
} = require('./matchPersistence');

const MATCH_ID = '33333333-3333-4333-8333-333333333333';
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function makeRecord(overrides = {}) {
  return {
    id: MATCH_ID,
    sourceRoomId: 'room-retry-test',
    whiteId: '11111111-1111-4111-8111-111111111111',
    blackId: '22222222-2222-4222-8222-222222222222',
    winnerId: null,
    winnerColor: null,
    result: '1/2-1/2',
    terminationReason: 'draw_agreement',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: FEN,
    finalFen: FEN,
    pgn: 'PRIVATE_PGN_MUST_NOT_BE_LOGGED',
    createdAt: '2026-10-19T10:00:00.000Z',
    completedAt: '2026-10-19T10:05:00.000Z',
    ...overrides,
  };
}

// Local fake store models a committed write whose acknowledgement was lost.
// No test connects to Supabase or writes to a live database.
function makeHarness(steps = [], { existing, lookupError } = {}) {
  const rows = new Map(existing ? [[existing.id, existing]] : []);
  const inserts = [];
  const waits = [];
  const logs = [];
  let lookups = 0;
  const adapter = createMatchPersistenceFromEnv({
    env: { SUPABASE_URL: 'https://retry-test.invalid', SUPABASE_SERVICE_KEY: 'fake-key' },
    createClientImpl: () => ({
      from(table) {
        assert.equal(table, 'matches');
        let row;
        let requestedId;
        const builder = {
          insert(value) { row = { ...value }; return builder; },
          select() { return builder; },
          eq(column, value) {
            assert.equal(column, 'id');
            requestedId = value;
            return builder;
          },
          async single() {
            inserts.push(row);
            const step = steps.shift();
            if (step?.commit) rows.set(row.id, row);
            if (step?.error) return { data: null, error: step.error, status: step.status };
            if (rows.has(row.id)) {
              return { data: null, error: { code: '23505' }, status: 409 };
            }
            rows.set(row.id, row);
            return { data: { id: row.id }, error: null, status: 201 };
          },
          async maybeSingle() {
            lookups++;
            if (lookupError) return { data: null, error: lookupError, status: 503 };
            return { data: rows.get(requestedId) ?? null, error: null, status: 200 };
          },
        };
        return builder;
      },
    }),
  });
  return {
    adapter, rows, inserts, waits, logs,
    get lookups() { return lookups; },
    options: {
      wait: async (ms) => { waits.push(ms); },
      logError: (entry) => { logs.push(entry); },
    },
  };
}

test('MA-a: first successful INSERT marks persisted only after acknowledgement', async () => {
  const h = makeHarness();
  const room = { persisted: false };
  const pending = persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options);
  assert.equal(room.persisted, false);
  assert.equal(await pending, true);
  assert.equal(room.persisted, true);
  assert.equal(h.inserts.length, 1);
  assert.equal(h.rows.size, 1);
  assert.deepEqual(h.waits, []);
  assert.deepEqual(h.logs, []);
});

test('MA-b: two transient failures retry one immutable match ID and produce one row', async () => {
  const h = makeHarness([
    { error: { code: 'ECONNRESET' } },
    { error: { message: 'upstream unavailable' }, status: 503 },
  ]);
  const room = { persisted: false };
  assert.equal(await persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options), true);
  assert.equal(room.persisted, true);
  assert.equal(h.inserts.length, 3);
  assert.deepEqual(h.inserts.map((row) => row.id), [MATCH_ID, MATCH_ID, MATCH_ID]);
  assert.deepEqual(h.inserts[0], h.inserts[2]);
  assert.equal(h.rows.size, 1);
  assert.deepEqual(h.waits, [1000, 4000]);
  assert.deepEqual(h.logs, []);
});

test('MA-c: exhausted transient failures leave persisted=false and emit one safe terminal log', async () => {
  const h = makeHarness(Array.from({ length: 3 }, () => ({
    error: { code: '53300', message: 'PRIVATE_TOKEN PRIVATE_PGN_MUST_NOT_BE_LOGGED' },
  })));
  const room = { persisted: false };
  const pending = persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options);
  assert.equal(await pending, false);
  assert.equal(room.persisted, false);
  assert.equal(h.inserts.length, 3);
  assert.equal(h.rows.size, 0);
  assert.deepEqual(h.logs, [{
    code: 'MATCH_PERSIST_FAILED', matchId: MATCH_ID,
    attempts: 3, errorClass: 'transient', lastErrorCode: '53300',
  }]);
  assert.equal(JSON.stringify(h.logs).includes('PRIVATE_'), false);
  assert.equal(persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options), pending);
  assert.equal(h.inserts.length, 3, 'a repeated caller does not restart the retry budget');
});

test('MA-d: permission or validation errors are permanent and are never retried', async () => {
  for (const validationFailure of [false, true]) {
    const h = makeHarness([{ error: { code: '42501', message: 'permission denied' }, status: 403 }]);
    const room = { persisted: false };
    const record = makeRecord(validationFailure ? { initialTime: -1 } : {});
    assert.equal(await persistRoomCompletedMatch(room, record, h.adapter, h.options), false);
    assert.equal(room.persisted, false);
    assert.equal(h.inserts.length, validationFailure ? 0 : 1);
    assert.deepEqual(h.waits, []);
    assert.deepEqual(h.logs, [{
      code: 'MATCH_PERSIST_FAILED', matchId: MATCH_ID, attempts: 1,
      errorClass: 'permanent', lastErrorCode: validationFailure ? 'MATCH_VALIDATION_ERROR' : '42501',
    }]);
  }
});

test('MA-e: lost acknowledgement followed by duplicate is confirmed as success without a second row', async () => {
  const h = makeHarness([{ commit: true, error: { code: 'ETIMEDOUT' } }]);
  const room = { persisted: false };
  assert.equal(await persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options), true);
  assert.equal(room.persisted, true);
  assert.equal(h.inserts.length, 2);
  assert.equal(h.rows.size, 1);
  assert.equal(h.lookups, 1);
  assert.deepEqual(h.inserts[0], h.inserts[1]);
  assert.deepEqual(h.waits, [1000]);
  assert.deepEqual(h.logs, []);
});

test('MA: unrelated duplicate or incomplete existing match is not a successful save', async () => {
  for (const existing of [undefined,
    { id: MATCH_ID, source_room_id: 'different-room', status: 'completed' },
    { id: MATCH_ID, source_room_id: 'room-retry-test', status: 'active' }]) {
    const h = makeHarness([{ error: { code: '23505' }, status: 409 }], { existing });
    const room = { persisted: false };
    assert.equal(await persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options), false);
    assert.equal(room.persisted, false);
    assert.equal(h.inserts.length, 1);
    assert.deepEqual(h.waits, []);
    assert.equal(h.logs.length, 1);
    assert.equal(h.logs[0].lastErrorCode, '23505');
  }
});

test('MA: duplicate lookup failures remain transient instead of acknowledging an unconfirmed save', async () => {
  const h = makeHarness([{ commit: true, error: { code: 'ETIMEDOUT' } }], {
    lookupError: { code: 'PGRST002' },
  });
  const room = { persisted: false };
  assert.equal(await persistRoomCompletedMatch(room, makeRecord(), h.adapter, h.options), false);
  assert.equal(room.persisted, false);
  assert.equal(h.rows.size, 1);
  assert.equal(h.inserts.length, 3);
  assert.equal(h.logs.length, 1);
  assert.equal(h.logs[0].errorClass, 'transient');
});

test('MA: concurrent callers share the pending write and a wrong acknowledgement remains a failure', async () => {
  let finish;
  let calls = 0;
  const logs = [];
  const room = { persisted: false };
  const adapter = { persistCompletedMatch() {
    calls++;
    return new Promise((resolve) => { finish = resolve; });
  } };
  const pending = persistRoomCompletedMatch(room, makeRecord(), adapter, { logError: (e) => logs.push(e) });
  assert.equal(persistRoomCompletedMatch(room, makeRecord(), adapter), pending);
  assert.equal(calls, 1);
  assert.equal(room.persisted, false);
  finish({ id: 'different-id' });
  assert.equal(await pending, false);
  assert.equal(room.persisted, false);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].lastErrorCode, 'MATCH_INVALID_ACK');
});

test('MA: retry classification covers transport, HTTP, pool, data, permission and unknown failures', () => {
  for (const error of [
    { code: '08006' }, { code: '53300' }, { code: '57P01' }, { code: '40001' },
    { code: 'PGRST000' }, { code: 'PGRST003' }, { code: 'ECONNRESET' },
    { status: 408 }, { status: 429 }, { status: 500 }, { status: 503 },
    { code: 429 }, { code: '503' },
    new TypeError('fetch failed'), { name: 'TimeoutError' },
    { cause: { code: 'UND_ERR_SOCKET' } },
  ]) assert.equal(classifyPersistenceError(error), 'transient', JSON.stringify(error));
  for (const error of [
    { code: '23503' }, { code: '23514' }, { code: '23505' }, { code: '22P02' },
    { code: '42501' }, { code: '28P01' }, { status: 400 }, { status: 401 },
    { status: 403 }, { code: 'MATCH_VALIDATION_ERROR', message: 'timeout' },
    { code: 403, message: 'timeout' },
    { code: '42501', status: 503 }, new Error('unknown failure'),
  ]) assert.equal(classifyPersistenceError(error), 'permanent', JSON.stringify(error));
});
