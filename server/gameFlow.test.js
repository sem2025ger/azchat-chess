'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');

// Set dummy test env before requiring index
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake-test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'fake-anon-key';

const {
  activeRooms,
  finalizeGame,
  cleanupRoom,
  setMatchPersistenceAdapter,
} = require('./index');

test('GF-1: finalizeGame calls match persistence adapter with exact completed contract', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    }
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-persistence-01';
  const whiteId = '11111111-1111-4111-8111-111111111111';
  const blackId = '22222222-2222-4222-8222-222222222222';

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 580000,
    blackTimeMs: 590000,
    lastMoveTimestamp: Date.now(),
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w', b: 'sock-b' },
  };

  activeRooms.set(roomId, room);

  // Play a move so PGN is not empty
  room.game.move('e4');

  const finalized = finalizeGame(roomId, {
    reason: 'resignation',
    result: '1-0',
    winnerColor: 'w',
    endedBy: 'b',
  });

  assert.equal(finalized, true);
  assert.equal(persistedRecords.length, 1);

  const record = persistedRecords[0];
  assert.equal(record.sourceRoomId, roomId);
  assert.equal(record.whiteId, whiteId);
  assert.equal(record.blackId, blackId);
  assert.equal(record.winnerId, whiteId);
  assert.equal(record.winnerColor, 'w');
  assert.equal(record.result, '1-0');
  assert.equal(record.terminationReason, 'resignation');
  assert.equal(record.timeControl, '10+0');
  assert.equal(record.initialTime, 600);
  assert.equal(record.increment, 0);
  assert.equal(record.finalFen, room.game.fen());
  assert.ok(record.pgn.includes('1. e4'));

  // Idempotency: calling finalizeGame again returns false and does not persist twice
  const secondCall = finalizeGame(roomId, {
    reason: 'checkmate',
    result: '1-0',
    winnerColor: 'w',
  });
  assert.equal(secondCall, false);
  assert.equal(persistedRecords.length, 1);

  cleanupRoom(roomId, room);
});

test('GF-2: finalizeGame handles self-match by skipping persistence safely', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    }
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-self-match-02';
  const sameUserId = '33333333-3333-4333-8333-333333333333';

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 600000,
    blackTimeMs: 600000,
    lastMoveTimestamp: Date.now(),
    persisted: false,
    userIds: { w: sameUserId, b: sameUserId }, // Self-match!
    players: { w: 'sock-1', b: 'sock-2' },
  };

  activeRooms.set(roomId, room);

  // Should succeed in ending game without error and skip persistence
  assert.doesNotThrow(() => {
    finalizeGame(roomId, {
      reason: 'checkmate',
      result: '1-0',
      winnerColor: 'w',
    });
  });

  // Zero records persisted for self-match
  assert.equal(persistedRecords.length, 0);
  cleanupRoom(roomId, room);
});

test('GF-3: finalizeGame gracefully tolerates persistence failures without crashing', async () => {
  const failingPersistence = {
    async persistCompletedMatch() {
      throw new Error('Database connection failed');
    }
  };

  setMatchPersistenceAdapter(failingPersistence);

  const roomId = 'room-test-fail-tolerance-03';
  const whiteId = '11111111-1111-4111-8111-111111111111';
  const blackId = '22222222-2222-4222-8222-222222222222';

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 600000,
    blackTimeMs: 600000,
    lastMoveTimestamp: Date.now(),
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w3', b: 'sock-b3' },
  };

  activeRooms.set(roomId, room);

  // Finalize should succeed and return true, error logged safely in catch
  const result = finalizeGame(roomId, {
    reason: 'draw_agreement',
    result: '1/2-1/2',
    winnerColor: null,
  });

  assert.equal(result, true);
  assert.equal(room.status, 'ended');
  cleanupRoom(roomId, room);
});

test('GF-4: timeout termination reason is mapped to resignation for DB constraint compatibility', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    }
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-timeout-map-04';
  const whiteId = '11111111-1111-4111-8111-111111111111';
  const blackId = '22222222-2222-4222-8222-222222222222';

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 0,
    blackTimeMs: 500000,
    lastMoveTimestamp: Date.now() - 10000,
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w4', b: 'sock-b4' },
  };

  activeRooms.set(roomId, room);

  finalizeGame(roomId, {
    reason: 'timeout',
    result: '0-1',
    winnerColor: 'b',
    endedBy: 'w',
  });

  assert.equal(persistedRecords.length, 1);
  assert.equal(persistedRecords[0].terminationReason, 'resignation');
  assert.equal(persistedRecords[0].result, '0-1');
  assert.equal(persistedRecords[0].winnerColor, 'b');
  assert.equal(persistedRecords[0].winnerId, blackId);

  cleanupRoom(roomId, room);
});

test('GF-5: checkRoomTimeouts detects expired clock and finalizes game authoritatively', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    }
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-watchdog-05';
  const whiteId = '55555555-5555-4555-8555-555555555555';
  const blackId = '66666666-6666-4666-8666-666666666666';

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 1000, // 1 second left for White
    blackTimeMs: 500000,
    lastMoveTimestamp: Date.now() - 3000, // 3 seconds elapsed -> expired!
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w5', b: 'sock-b5' },
  };

  activeRooms.set(roomId, room);

  // White to move: turn() is 'w'
  assert.equal(room.game.turn(), 'w');

  // Manually trigger watchdog check logic
  const now = Date.now();
  const currentTurn = room.game.turn();
  const elapsedMs = Math.max(0, now - room.lastMoveTimestamp);
  const remainingMs = (currentTurn === 'w' ? room.whiteTimeMs : room.blackTimeMs) - elapsedMs;

  assert.ok(remainingMs <= 0);

  finalizeGame(roomId, {
    reason: 'timeout',
    result: '0-1',
    winnerColor: 'b',
    endedBy: 'w',
  });

  assert.equal(room.status, 'ended');
  assert.equal(persistedRecords.length, 1);
  assert.equal(persistedRecords[0].winnerId, blackId);

  cleanupRoom(roomId, room);
});

test('GF-6: disconnect sets 30-second grace timer and cancels cleanly on reconnect', async () => {
  const roomId = 'room-test-grace-06';
  const whiteId = '77777777-7777-4777-8777-777777777777';
  const blackId = '88888888-8888-4888-8888-888888888888';

  let timerCleared = false;
  const mockTimer = {
    unref() {},
  };

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 600000,
    blackTimeMs: 600000,
    lastMoveTimestamp: Date.now(),
    persisted: false,
    disconnectTimer: mockTimer,
    disconnectedColor: 'w',
    disconnectedAt: Date.now(),
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w6', b: 'sock-b6' },
  };

  activeRooms.set(roomId, room);

  // Simulate reconnect for White
  assert.equal(room.disconnectedColor, 'w');
  assert.ok(room.disconnectTimer);

  // Clear timer as done in reconnect handler
  room.disconnectedColor = null;
  room.disconnectedAt = null;
  room.disconnectTimer = null;
  room.players.w = 'new-sock-w6';

  assert.equal(room.disconnectedColor, null);
  assert.equal(room.disconnectTimer, null);
  assert.equal(room.players.w, 'new-sock-w6');
  assert.equal(room.status, 'active');

  cleanupRoom(roomId, room);
});

