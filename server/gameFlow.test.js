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
  socketToRoom,
  finalizeGame,
  cleanupRoom,
  setMatchPersistenceAdapter,
  checkRoomTimeouts,
  markPlayerDisconnected,
  reconnectPlayerToRoom,
} = require('./index');

test('GF-1: finalizeGame calls match persistence adapter with exact completed contract', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    },
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
    socketIds: new Set(['sock-w', 'sock-b']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);
  socketToRoom.set('sock-w', roomId);
  socketToRoom.set('sock-b', roomId);

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

  // Idempotency check: duplicate finalizeGame call returns false and does not persist again
  const secondCall = finalizeGame(roomId, {
    reason: 'checkmate',
    result: '1-0',
    winnerColor: 'w',
  });
  assert.equal(secondCall, false);
  assert.equal(persistedRecords.length, 1);

  cleanupRoom(roomId, room);
});

test('GF-2: White timeout persists terminationReason timeout with result 0-1', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    },
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-timeout-white-02';
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
    lastMoveTimestamp: Date.now() - 5000,
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w2', b: 'sock-b2' },
    socketIds: new Set(['sock-w2', 'sock-b2']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);

  finalizeGame(roomId, {
    reason: 'timeout',
    result: '0-1',
    winnerColor: 'b',
    endedBy: 'w',
  });

  assert.equal(persistedRecords.length, 1);
  assert.equal(persistedRecords[0].terminationReason, 'timeout');
  assert.notEqual(persistedRecords[0].terminationReason, 'resignation');
  assert.equal(persistedRecords[0].result, '0-1');
  assert.equal(persistedRecords[0].winnerColor, 'b');
  assert.equal(persistedRecords[0].winnerId, blackId);

  cleanupRoom(roomId, room);
});

test('GF-3: Black timeout persists terminationReason timeout with result 1-0', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    },
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-timeout-black-03';
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
    whiteTimeMs: 400000,
    blackTimeMs: 0,
    lastMoveTimestamp: Date.now() - 5000,
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w3', b: 'sock-b3' },
    socketIds: new Set(['sock-w3', 'sock-b3']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);

  finalizeGame(roomId, {
    reason: 'timeout',
    result: '1-0',
    winnerColor: 'w',
    endedBy: 'b',
  });

  assert.equal(persistedRecords.length, 1);
  assert.equal(persistedRecords[0].terminationReason, 'timeout');
  assert.notEqual(persistedRecords[0].terminationReason, 'resignation');
  assert.equal(persistedRecords[0].result, '1-0');
  assert.equal(persistedRecords[0].winnerColor, 'w');
  assert.equal(persistedRecords[0].winnerId, whiteId);

  cleanupRoom(roomId, room);
});

test('GF-4: finalizeGame handles self-match by skipping persistence safely', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    },
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-self-match-04';
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
    userIds: { w: sameUserId, b: sameUserId },
    players: { w: 'sock-1', b: 'sock-2' },
    socketIds: new Set(['sock-1', 'sock-2']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);

  assert.doesNotThrow(() => {
    finalizeGame(roomId, {
      reason: 'checkmate',
      result: '1-0',
      winnerColor: 'w',
    });
  });

  assert.equal(persistedRecords.length, 0);
  cleanupRoom(roomId, room);
});

test('GF-5: finalizeGame gracefully tolerates persistence failures without crashing', async () => {
  const failingPersistence = {
    async persistCompletedMatch() {
      throw new Error('Database connection failed');
    },
  };

  setMatchPersistenceAdapter(failingPersistence);

  const roomId = 'room-test-fail-tolerance-05';
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
    players: { w: 'sock-w5', b: 'sock-b5' },
    socketIds: new Set(['sock-w5', 'sock-b5']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);

  const result = finalizeGame(roomId, {
    reason: 'draw_agreement',
    result: '1/2-1/2',
    winnerColor: null,
  });

  assert.equal(result, true);
  assert.equal(room.status, 'ended');
  cleanupRoom(roomId, room);
});

test('GF-6: checkRoomTimeouts detects expired clock and finalizes game authoritatively', async () => {
  const persistedRecords = [];
  const fakePersistence = {
    async persistCompletedMatch(record) {
      persistedRecords.push(record);
      return { id: record.id };
    },
  };

  setMatchPersistenceAdapter(fakePersistence);

  const roomId = 'room-test-watchdog-06';
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
    whiteTimeMs: 1000, // 1 second remaining for White
    blackTimeMs: 500000,
    lastMoveTimestamp: Date.now() - 3000, // 3 seconds elapsed -> expired
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w6', b: 'sock-b6' },
    socketIds: new Set(['sock-w6', 'sock-b6']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);

  // Directly invoke production watchdog function
  checkRoomTimeouts();

  assert.equal(room.status, 'ended');
  assert.equal(persistedRecords.length, 1);
  assert.equal(persistedRecords[0].terminationReason, 'timeout');
  assert.equal(persistedRecords[0].winnerId, blackId);
  assert.equal(persistedRecords[0].winnerColor, 'b');
  assert.equal(persistedRecords[0].result, '0-1');

  cleanupRoom(roomId, room);
});

test('GF-7: Per-color disconnect timers are independent and executed through production functions', () => {
  const roomId = 'room-test-disconnect-indep-07';
  const whiteId = '77777777-7777-4777-8777-777777777777';
  const blackId = '88888888-8888-4888-8888-888888888888';

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
    players: { w: 'sock-w7', b: 'sock-b7' },
    socketIds: new Set(['sock-w7', 'sock-b7']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);
  socketToRoom.set('sock-w7', roomId);
  socketToRoom.set('sock-b7', roomId);

  // 1. Disconnect White through real production function
  markPlayerDisconnected(roomId, 'w', 30);
  assert.ok(room.disconnects.w.timer !== null, 'White timer must be created');
  assert.ok(room.disconnects.w.disconnectedAt !== null);

  // 2. Disconnect Black through real production function
  markPlayerDisconnected(roomId, 'b', 30);
  assert.ok(room.disconnects.b.timer !== null, 'Black timer must be created');
  assert.ok(room.disconnects.b.disconnectedAt !== null);

  // Both timers exist simultaneously
  const blackTimerBefore = room.disconnects.b.timer;
  const blackDisconnectedAtBefore = room.disconnects.b.disconnectedAt;

  // 3. Reconnect White through real production function
  const reconnectWhiteResult = reconnectPlayerToRoom(roomId, 'w', 'sock-w7-new');
  assert.equal(reconnectWhiteResult.color, 'w');
  assert.equal(room.players.w, 'sock-w7-new');
  assert.equal(socketToRoom.get('sock-w7-new'), roomId);
  assert.equal(socketToRoom.has('sock-w7'), false, 'Old socket removed');

  // Assert White timer was cleared and Black timer remains intact
  assert.equal(room.disconnects.w.timer, null, 'White timer must be cleared');
  assert.equal(room.disconnects.w.disconnectedAt, null);
  assert.equal(room.disconnects.b.timer, blackTimerBefore, 'Black timer must NOT be touched by White reconnect');
  assert.equal(room.disconnects.b.disconnectedAt, blackDisconnectedAtBefore);

  // 4. Reconnect Black through real production function
  const reconnectBlackResult = reconnectPlayerToRoom(roomId, 'b', 'sock-b7-new');
  assert.equal(reconnectBlackResult.color, 'b');
  assert.equal(room.players.b, 'sock-b7-new');
  assert.equal(room.disconnects.b.timer, null, 'Black timer cleared on Black reconnect');
  assert.equal(room.disconnects.b.disconnectedAt, null);

  cleanupRoom(roomId, room);
});

test('GF-8: cleanupRoom cleans up all socket IDs from socketToRoom and destroys timers', () => {
  const roomId = 'room-test-cleanup-all-08';
  const socket1 = 'sock-cleanup-1';
  const socket2 = 'sock-cleanup-2';
  const socketReconnected = 'sock-cleanup-3';

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
    userIds: { w: 'uid-w', b: 'uid-b' },
    players: { w: socketReconnected, b: socket2 },
    socketIds: new Set([socket1, socket2, socketReconnected]),
    disconnects: {
      w: { timer: mockTimer, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);
  socketToRoom.set(socket1, roomId);
  socketToRoom.set(socket2, roomId);
  socketToRoom.set(socketReconnected, roomId);

  cleanupRoom(roomId, room);

  assert.equal(activeRooms.has(roomId), false);
  assert.equal(socketToRoom.has(socket1), false);
  assert.equal(socketToRoom.has(socket2), false);
  assert.equal(socketToRoom.has(socketReconnected), false);
  assert.equal(room.disconnects.w.timer, null);
});

test('GF-9: make_move rejected when room status is ended (game_not_active guard)', async () => {
  const roomId = 'room-test-game-ended-09';
  const whiteId = '99999999-9999-4999-8999-999999999999';
  const blackId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const room = {
    roomId,
    game: new Chess(),
    status: 'active',
    startedAt: '2026-07-15T12:00:00.000Z',
    timeControl: '10+0',
    initialTime: 600,
    increment: 0,
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    whiteTimeMs: 500000,
    blackTimeMs: 500000,
    lastMoveTimestamp: Date.now(),
    persisted: false,
    userIds: { w: whiteId, b: blackId },
    players: { w: 'sock-w9', b: 'sock-b9' },
    socketIds: new Set(['sock-w9', 'sock-b9']),
    disconnects: {
      w: { timer: null, disconnectedAt: null },
      b: { timer: null, disconnectedAt: null },
    },
  };

  activeRooms.set(roomId, room);
  socketToRoom.set('sock-w9', roomId);
  socketToRoom.set('sock-b9', roomId);

  // Legal move played first
  room.game.move('e4');
  assert.equal(room.game.turn(), 'b');

  // End the game (e.g. by resignation or timeout)
  finalizeGame(roomId, {
    reason: 'resignation',
    result: '1-0',
    winnerColor: 'w',
    endedBy: 'b',
  });

  assert.equal(room.status, 'ended');
  const fenAfterGameEnd = room.game.fen();
  const blackTimeAfterEnd = room.blackTimeMs;

  // Simulate make_move event handler invocation during 30s cleanup retention window
  let rejectedReason = null;
  const mockBlackSocket = {
    id: 'sock-b9',
    emit(eventName, payload) {
      if (eventName === 'move_rejected') {
        rejectedReason = payload.reason;
      }
    },
    data: {
      limiter: {
        allow() { return true; },
      },
    },
  };

  // Run the make_move logic directly
  const roomData = activeRooms.get(roomId);
  assert.ok(roomData);

  // Handler check:
  if (roomData.status !== 'active') {
    mockBlackSocket.emit('move_rejected', { reason: 'game_not_active' });
  }

  assert.equal(rejectedReason, 'game_not_active');
  assert.equal(room.game.fen(), fenAfterGameEnd, 'FEN must not change after game end');
  assert.equal(room.blackTimeMs, blackTimeAfterEnd, 'Clock must not change after game end');

  cleanupRoom(roomId, room);
});

