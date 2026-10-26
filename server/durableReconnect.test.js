'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Chess } = require('chess.js');
const { createDurableGames, snapshot } = require('./durableGames');
const { DurableError } = require('./durableStore');

function options(store, extra = {}) {
  return { enabled: false, store, rooms: new Map(), socketToRoom: new Map(), io: {},
    getMatchPersistence: () => ({}), naturalGameOver: () => null, log: () => {}, ...extra };
}
function client(id = 'white', userId = randomUUID()) {
  const events = [];
  return { id, events, data: { userId, limiter: { allow: () => true } },
    emit: (name, data) => events.push({ name, data }), join() {}, leave() {} };
}

test('review: confirmed absent schema returns legacy game_not_active without reading a missing room', async () => {
  let reads = 0;
  const manager = createDurableGames(options({
    scan: async () => { throw new DurableError('PGRST202'); }, isUninstalled: async () => true,
    read: async () => { reads++; throw new DurableError('PGRST202'); },
  }));
  await manager.recover(); const socket = client();
  await manager.reconnect(socket, randomUUID());
  assert.equal(socket.events[0].data.reason, 'game_not_active');
  assert.equal(reads, 0);
});

test('review: flag-off unknown storage uses a bounded hint; enabled or known durable recovery stays unlimited', async () => {
  for (const [enabled, known] of [[false, false], [true, false], [false, true]]) {
    const roomId = randomUUID(), rooms = new Map();
    if (known) rooms.set(roomId, { durable: true, blocked: true });
    const manager = createDurableGames(options({ read: async () => { throw new DurableError(); } }, { enabled, rooms }));
    const socket = client(); await manager.reconnect(socket, roomId);
    const reply = socket.events[0].data;
    assert.equal(reply.reason, enabled || known ? 'recovery_pending' : 'storage_unavailable');
    assert.equal(reply.retryLimitMs, enabled || known ? undefined : 30000);
  }
});

function terminalFixture() {
  const at = Date.now(), ownerId = randomUUID(), roomId = randomUUID();
  const white = client('white'), black = client('black'), sockets = new Map([[white.id, white], [black.id, black]]);
  const room = { roomId, game: new Chess(), durable: true, status: 'active',
    userIds: { w: white.data.userId, b: black.data.userId }, players: { w: white.id, b: black.id },
    socketIds: new Set(sockets.keys()), initialFen: new Chess().fen(), startedAt: new Date(at - 1000).toISOString(),
    timeControl: '10+0', initialTime: 600, increment: 0, whiteTimeMs: 600000, blackTimeMs: 600000,
    lastMoveTimestamp: at, drawOfferBy: null,
    disconnects: { w: { disconnectedAt: null, deadline: null }, b: { disconnectedAt: null, deadline: null } } };
  room.durableRow = { room_id: roomId, match_id: randomUUID(), owner_id: ownerId, revision: 0,
    fence: 1, lease_until: new Date(at + 15000).toISOString(), state: snapshot(room), result_saved: false };
  const rooms = new Map([[roomId, room]]), socketToRoom = new Map([...sockets.keys()].map(id => [id, roomId]));
  const io = { sockets: { sockets, adapter: { rooms: new Map([[roomId, new Set(sockets.keys())]]) } },
    to: target => ({ emit: (name, data) => {
      for (const socket of target === roomId ? sockets.values() : [sockets.get(target)].filter(Boolean)) socket.emit(name, data);
    } }) };
  return { at, ownerId, roomId, room, white, black, rooms, socketToRoom, io };
}

test('authorized reconnect supplies participant display lookup identities without admitting outsiders', async () => {
  const f = terminalFixture();
  const manager = createDurableGames(options({ ownerId:f.ownerId }, { ...f, now:() => f.at }));
  await manager.reconnect(f.white, f.roomId);
  const reply = f.white.events.find(event => event.name === 'reconnect_success');
  assert.deepEqual(reply.data.playerIds, f.room.userIds);
  assert.notEqual(reply.data.playerIds, f.room.userIds, 'Metadata must be a copy of authoritative identity data');
  assert.equal(f.room.game.history().length, 0);
  const stranger = client('stranger');
  await manager.reconnect(stranger, f.roomId);
  assert.equal(stranger.events.some(event => event.name === 'reconnect_success'), false);
  assert.equal(stranger.events.find(event => event.name === 'reconnect_failed').data.reason, 'not_a_player');
});

test('completed-game restoration supplies the same identities only after participant validation', async () => {
  const f = terminalFixture();
  const row = { ...f.room.durableRow, result_saved:true,
    state:{ status:'ended', userIds:f.room.userIds, outcome:{ reason:'draw', result:'1/2-1/2' } } };
  const manager = createDurableGames(options({
    read:async () => row,
    completedMatch:async () => ({ source_room_id:f.roomId, white_id:f.room.userIds.w, black_id:f.room.userIds.b,
      status:'completed', initial_fen:f.room.initialFen, pgn:'' }),
  }, { ...f, rooms:new Map() }));
  await manager.reconnect(f.white, f.roomId);
  const reply = f.white.events.find(event => event.name === 'reconnect_success');
  assert.equal(reply.data.status, 'ended');
  assert.deepEqual(reply.data.playerIds, f.room.userIds);
  const stranger = client('stranger');
  await manager.reconnect(stranger, f.roomId);
  assert.equal(stranger.events.some(event => event.name === 'reconnect_success'), false);
});

test('review: lost terminal acknowledgement recovers game_over for BOTH players once per connection', async () => {
  const f = terminalFixture(); let saved, release;
  const manager = createDurableGames(options({ ownerId: f.ownerId,
    scan: async () => saved ? [saved] : [], read: async () => saved,
    write: async (operation, row, state) => {
      if (operation === 'commit') { saved = { ...row, state, revision: 1 }; throw new DurableError(); }
      return new Promise(resolve => { release = () => resolve({ ...saved, result_saved: true, revision: 2 }); });
    },
  }, { ...f, enabled: true, now: () => f.at }));
  await manager.recover();
  await manager.action(f.white, 'resign_game', { roomId: f.roomId });
  assert.equal(saved.state.status, 'ended'); assert.equal(f.room.blocked, true);
  await manager.recover(); await new Promise(setImmediate);
  try {
    for (const socket of [f.white, f.black]) assert.equal(socket.events.filter(e => e.name === 'game_over').length, 1);
    release(); await new Promise(setImmediate);
    await manager.recover();
    await manager.reconnect(f.white, f.roomId); await manager.reconnect(f.white, f.roomId);
    for (const socket of [f.white, f.black]) assert.equal(socket.events.filter(e => e.name === 'game_over').length, 1);
  } finally { release(); await new Promise(setImmediate); }
});

test('review: expiry during recovery emits one terminal event even when the same socket resynchronizes', async () => {
  const f = terminalFixture(); let saved = { ...f.room.durableRow, state: { ...snapshot(f.room), whiteTimeMs: 0 } }, release;
  f.room.blocked = true;
  const manager = createDurableGames(options({ ownerId: f.ownerId, scan: async () => [saved], read: async () => saved,
    write: async (operation, row, state) => {
      if (operation === 'commit') return (saved = { ...row, state, revision: 1 });
      return new Promise(resolve => { release = () => resolve({ ...saved, result_saved: true }); });
    },
  }, { ...f, now: () => f.at }));
  await manager.recover(); await new Promise(setImmediate);
  try {
    release(); await new Promise(setImmediate);
    await manager.reconnect(f.white, f.roomId);
    for (const socket of [f.white, f.black]) {
      const notices = socket.events.filter(e => e.name === 'game_over');
      assert.equal(notices.length, 1); assert.equal(notices[0].data.reason, 'timeout');
    }
  } finally { release(); await new Promise(setImmediate); }
});

test('review: a compacted terminal row also ends both stale in-memory clients', async () => {
  const f = terminalFixture(); f.room.blocked = true;
  const row = { ...f.room.durableRow, result_saved: true,
    state: { status: 'ended', userIds: f.room.userIds, outcome: { reason: 'resignation', result: '0-1', winnerColor: 'b', endedBy: 'w' } } };
  const manager = createDurableGames(options({ scan: async () => [], read: async () => row }, f));
  await manager.recover();
  for (const socket of [f.white, f.black]) assert.equal(socket.events.filter(e => e.name === 'game_over').length, 1);
});
