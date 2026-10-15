'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Ensure test environment before loading server
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake-test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'fake-anon-key';

const ioClient = require(path.resolve(__dirname, '../tmp/node_modules/socket.io-client'));
const {
  server,
  activeRooms,
  socketToRoom,
  setTokenVerifier,
  setMatchPersistenceAdapter,
  finalizeGame,
  cleanupRoom,
} = require('./index');

function connectClient(port, userId) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { accessToken: userId },
      reconnection: false,
    });

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${eventName}" on socket ${socket.id}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

test('INT-1 to INT-10: Socket.IO Integration Harness with 2 Authenticated Clients', async (t) => {
  // Set up mock token verifier that parses accessToken as the user ID
  setTokenVerifier(async (token) => {
    if (!token || typeof token !== 'string') return null;
    return { id: token, email: `${token}@test.local` };
  });

  const persistedMatches = [];
  setMatchPersistenceAdapter({
    async persistCompletedMatch(record) {
      persistedMatches.push(record);
      return { id: record.id };
    },
  });

  // Start HTTP server on an ephemeral port
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  const user1Id = '11111111-1111-4111-8111-111111111111';
  const user2Id = '22222222-2222-4222-8222-222222222222';

  let client1 = null;
  let client2 = null;
  let roomId = null;
  let whiteSocket = null;
  let blackSocket = null;

  try {
    // 1. Two different users connect with valid credentials
    client1 = await connectClient(port, user1Id);
    client2 = await connectClient(port, user2Id);
    assert.ok(client1.connected);
    assert.ok(client2.connected);

    // 2. Both join queue and game starts
    const matchFoundPromise1 = waitForEvent(client1, 'match_found');
    const matchFoundPromise2 = waitForEvent(client2, 'match_found');
    const gameStartPromise1 = waitForEvent(client1, 'game_start');
    const gameStartPromise2 = waitForEvent(client2, 'game_start');

    client1.emit('join_queue');
    client2.emit('join_queue');

    const [matchData1, matchData2] = await Promise.all([matchFoundPromise1, matchFoundPromise2]);
    await Promise.all([gameStartPromise1, gameStartPromise2]);

    assert.equal(matchData1.roomId, matchData2.roomId);
    assert.notEqual(matchData1.color, matchData2.color);

    roomId = matchData1.roomId;
    whiteSocket = matchData1.color === 'w' ? client1 : client2;
    blackSocket = matchData1.color === 'b' ? client1 : client2;

    const room = activeRooms.get(roomId);
    assert.ok(room);
    assert.equal(room.status, 'active');

    // 3. Legal move accepted
    const updatePromise = waitForEvent(blackSocket, 'update_board');
    whiteSocket.emit('make_move', { roomId, move: { from: 'e2', to: 'e4' } });
    const updateData = await updatePromise;

    assert.ok(updateData.fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR'));
    assert.equal(room.game.turn(), 'b');

    // 4. Illegal move rejected without mutating clocks or state
    const preMoveBlackTime = room.blackTimeMs;
    const preMoveTimestamp = room.lastMoveTimestamp;

    const rejectPromise = waitForEvent(blackSocket, 'move_rejected');
    // Illegal move: pawn cannot move to e2
    blackSocket.emit('make_move', { roomId, move: { from: 'e7', to: 'e2' } });
    const rejectData = await rejectPromise;

    assert.equal(rejectData.reason, 'illegal_move');
    // Verify stored clock state was not corrupted
    assert.equal(room.blackTimeMs, preMoveBlackTime);
    assert.equal(room.lastMoveTimestamp, preMoveTimestamp);
    assert.equal(room.game.turn(), 'b');

    // 5. Both players disconnect independently -> independent grace timers
    client1.disconnect();
    client2.disconnect();

    // Give server event loop a brief moment to process disconnects
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(room.disconnects.w.disconnectedAt !== null);
    assert.ok(room.disconnects.w.timer !== null);
    assert.ok(room.disconnects.b.disconnectedAt !== null);
    assert.ok(room.disconnects.b.timer !== null);

    // 6 & 7. White reconnects with new socket -> clears only White's timer; Black's timer remains active
    const whiteUserId = room.userIds.w;
    const reconnectedWhiteClient = await connectClient(port, whiteUserId);

    const reconnectSuccessPromise = waitForEvent(reconnectedWhiteClient, 'reconnect_success');
    reconnectedWhiteClient.emit('reconnect_game', { roomId });
    const reconnectData = await reconnectSuccessPromise;

    assert.equal(reconnectData.color, 'w');
    assert.equal(reconnectData.roomId, roomId);

    // Check that White timer was cleared and Black timer remains intact
    assert.equal(room.disconnects.w.timer, null);
    assert.equal(room.disconnects.w.disconnectedAt, null);
    assert.ok(room.disconnects.b.timer !== null);
    assert.ok(room.disconnects.b.disconnectedAt !== null);

    // 8. Timeout ends game once with terminationReason: 'timeout'
    const gameOverPromise = waitForEvent(reconnectedWhiteClient, 'game_over');
    finalizeGame(roomId, {
      reason: 'timeout',
      result: '1-0',
      winnerColor: 'w',
      endedBy: 'b',
    });
    const gameOverData = await gameOverPromise;

    assert.equal(gameOverData.reason, 'timeout');
    assert.equal(gameOverData.result, '1-0');
    assert.equal(room.status, 'ended');
    assert.equal(persistedMatches.length, 1);
    assert.equal(persistedMatches[0].terminationReason, 'timeout');
    assert.equal(persistedMatches[0].winnerColor, 'w');

    // 9 & 10. Duplicate finalize attempt is ignored and returns false
    const duplicateFinalize = finalizeGame(roomId, {
      reason: 'resignation',
      result: '0-1',
      winnerColor: 'b',
    });
    assert.equal(duplicateFinalize, false);
    assert.equal(persistedMatches.length, 1);

    // Clean up reconnected client
    reconnectedWhiteClient.disconnect();
  } finally {
    if (client1?.connected) client1.disconnect();
    if (client2?.connected) client2.disconnect();
    if (roomId) {
      const r = activeRooms.get(roomId);
      if (r) cleanupRoom(roomId, r);
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
