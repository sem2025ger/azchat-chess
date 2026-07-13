'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE_PATH = require.resolve('./matchPersistence');
const FAKE_URL = 'https://unit-test.invalid';
const FAKE_SERVICE_KEY = 'FAKE_SERVICE_KEY_FOR_UNIT_TESTS';
const WHITE_ID = '11111111-1111-4111-8111-111111111111';
const BLACK_ID = '22222222-2222-4222-8222-222222222222';
const MATCH_ID = '33333333-3333-4333-8333-333333333333';
const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FINAL_FEN = 'rnb1kbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const PGN = '1. e4 e5 2. Nf3';

function loadModule() {
  return require('./matchPersistence');
}

function makeRecord(overrides = {}) {
  return {
    id: MATCH_ID,
    sourceRoomId: 'room-unit-test-001',
    whiteId: WHITE_ID,
    blackId: BLACK_ID,
    winnerId: WHITE_ID,
    winnerColor: 'w',
    result: '1-0',
    terminationReason: 'checkmate',
    timeControl: '5+3',
    initialTime: 300,
    increment: 3,
    initialFen: INITIAL_FEN,
    finalFen: FINAL_FEN,
    pgn: PGN,
    createdAt: '2026-07-14T10:00:00.000Z',
    completedAt: '2026-07-14T10:05:00.000Z',
    ...overrides,
  };
}

function expectedRow(record) {
  return {
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
    created_at: new Date(record.createdAt).toISOString(),
    completed_at: new Date(record.completedAt).toISOString(),
  };
}

function makeFakeCreateClient(response = { data: { id: MATCH_ID }, error: null }) {
  const state = {
    createClientCalls: [],
    queryCalls: [],
  };

  const builder = {
    insert(row) {
      state.queryCalls.push({ method: 'insert', args: [row] });
      return builder;
    },
    select(columns) {
      state.queryCalls.push({ method: 'select', args: [columns] });
      return builder;
    },
    async single() {
      state.queryCalls.push({ method: 'single', args: [] });
      return response;
    },
  };

  function createClientImpl(...args) {
    state.createClientCalls.push(args);
    return {
      from(table) {
        state.queryCalls.push({ method: 'from', args: [table] });
        return builder;
      },
    };
  }

  return { createClientImpl, state };
}

function makeAdapter(fake) {
  const { createMatchPersistenceFromEnv } = loadModule();
  return createMatchPersistenceFromEnv({
    env: {
      SUPABASE_URL: FAKE_URL,
      SUPABASE_SERVICE_KEY: FAKE_SERVICE_KEY,
    },
    createClientImpl: fake.createClientImpl,
  });
}

test('T1: importing with no credentials has no side effects and does not throw', () => {
  delete require.cache[MODULE_PATH];
  assert.doesNotThrow(() => require('./matchPersistence'));
});

test('T2: factory throws the exact missing SUPABASE_URL error', () => {
  const { createMatchPersistenceFromEnv, MatchPersistenceError } = loadModule();
  const fake = makeFakeCreateClient();

  assert.throws(
    () => createMatchPersistenceFromEnv({ env: {}, createClientImpl: fake.createClientImpl }),
    (error) => {
      assert.ok(error instanceof MatchPersistenceError);
      assert.equal(error.message, 'Missing required server env: SUPABASE_URL');
      return true;
    }
  );
  assert.equal(fake.state.createClientCalls.length, 0);
});

test('T3: factory requires SUPABASE_SERVICE_KEY even when an anon key exists', () => {
  const { createMatchPersistenceFromEnv, MatchPersistenceError } = loadModule();
  const fake = makeFakeCreateClient();

  assert.throws(
    () => createMatchPersistenceFromEnv({
      env: {
        SUPABASE_URL: FAKE_URL,
        SUPABASE_ANON_KEY: 'FAKE_ANON_KEY_FOR_UNIT_TESTS',
      },
      createClientImpl: fake.createClientImpl,
    }),
    (error) => {
      assert.ok(error instanceof MatchPersistenceError);
      assert.equal(error.message, 'Missing required server env: SUPABASE_SERVICE_KEY');
      return true;
    }
  );
  assert.equal(fake.state.createClientCalls.length, 0);
});

test('T4: factory passes exact credentials and auth options to createClientImpl', () => {
  const fake = makeFakeCreateClient();

  makeAdapter(fake);

  assert.deepEqual(fake.state.createClientCalls, [[
    FAKE_URL,
    FAKE_SERVICE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  ]]);
});

test('T5: a valid white win produces the exact matches insert row', async () => {
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord();

  await adapter.persistCompletedMatch(record);

  assert.deepEqual(fake.state.queryCalls[1], {
    method: 'insert',
    args: [expectedRow(record)],
  });
});

test('T6: a valid black win produces the exact matches insert row', async () => {
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord({
    winnerId: BLACK_ID,
    winnerColor: 'b',
    result: '0-1',
    terminationReason: 'resignation',
  });

  await adapter.persistCompletedMatch(record);

  assert.deepEqual(fake.state.queryCalls[1], {
    method: 'insert',
    args: [expectedRow(record)],
  });
});

test('T7: a valid draw produces null winner_id and null winner_color', async () => {
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord({
    winnerId: null,
    winnerColor: null,
    result: '1/2-1/2',
    terminationReason: 'stalemate',
  });

  await adapter.persistCompletedMatch(record);

  const insertedRow = fake.state.queryCalls[1].args[0];
  assert.equal(insertedRow.winner_id, null);
  assert.equal(insertedRow.winner_color, null);
  assert.deepEqual(insertedRow, expectedRow(record));
});

test('T8: invalid result and winner consistency is rejected before client.from', async () => {
  const { MatchPersistenceError } = loadModule();
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord({ winnerId: BLACK_ID, winnerColor: 'b' });

  await assert.rejects(
    adapter.persistCompletedMatch(record),
    (error) => error instanceof MatchPersistenceError
  );
  assert.deepEqual(fake.state.queryCalls, []);
});

test('T9: invalid termination and result consistency is rejected before client.from', async () => {
  const { MatchPersistenceError } = loadModule();
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord({ terminationReason: 'draw' });

  await assert.rejects(
    adapter.persistCompletedMatch(record),
    (error) => error instanceof MatchPersistenceError
  );
  assert.deepEqual(fake.state.queryCalls, []);
});

test('T10: completedAt before createdAt is rejected before client.from', async () => {
  const { MatchPersistenceError } = loadModule();
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord({ completedAt: '2026-07-14T09:59:59.000Z' });

  await assert.rejects(
    adapter.persistCompletedMatch(record),
    (error) => error instanceof MatchPersistenceError
  );
  assert.deepEqual(fake.state.queryCalls, []);
});

test('T11: Supabase errors become sanitized MatchPersistenceError instances', async () => {
  const { MatchPersistenceError } = loadModule();
  const databaseError = {
    code: '23505',
    message: `duplicate ${FAKE_SERVICE_KEY} ${FAKE_URL} ${PGN}`,
    details: `sensitive ${PGN}`,
  };
  const fake = makeFakeCreateClient({ data: null, error: databaseError });
  const adapter = makeAdapter(fake);

  await assert.rejects(
    adapter.persistCompletedMatch(makeRecord()),
    (error) => {
      assert.ok(error instanceof MatchPersistenceError);
      assert.equal(error.name, 'MatchPersistenceError');
      assert.equal(error.message, 'Failed to persist completed match');
      assert.equal(error.code, '23505');
      assert.equal(error.cause, databaseError);
      assert.equal(String(error).includes(FAKE_SERVICE_KEY), false);
      assert.equal(String(error).includes(FAKE_URL), false);
      assert.equal(String(error).includes(PGN), false);
      return true;
    }
  );
});

test('T12: successful writes return exactly id and use the required query shape', async () => {
  const fake = makeFakeCreateClient();
  const adapter = makeAdapter(fake);
  const record = makeRecord();

  const result = await adapter.persistCompletedMatch(record);

  assert.deepEqual(result, { id: MATCH_ID });
  assert.deepEqual(fake.state.queryCalls, [
    { method: 'from', args: ['matches'] },
    { method: 'insert', args: [expectedRow(record)] },
    { method: 'select', args: ['id'] },
    { method: 'single', args: [] },
  ]);
});
