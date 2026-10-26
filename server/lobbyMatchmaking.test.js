'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'https://fake-test.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'fake-anon-key';
const { io: connect } = require('socket.io-client');
const { server, activeRooms, setTokenVerifier, setMatchPersistenceAdapter, cleanupRoom, lobbyPresence } = require('./index');

function once(socket, name, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out: ' + name)), timeout);
    socket.once(name, data => { clearTimeout(timer); resolve(data); });
  });
}
async function client(port, identity) {
  const socket = connect('http://127.0.0.1:' + port, {
    transports: ['websocket'], auth: { accessToken: identity }, reconnection: false
  });
  await once(socket, 'connect');
  return socket;
}
test('lobby: matching respects chosen clocks and direct challenges restrict recipients', async () => {
  setTokenVerifier(async token => token ? { id: token, email: 'test@example.invalid' } : null);
  setMatchPersistenceAdapter(null);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const sockets = [];
  try {
    const a = await client(port, 'player-a'); sockets.push(a);
    const b = await client(port, 'player-b'); sockets.push(b);
    const c = await client(port, 'player-c'); sockets.push(c);
    const d = await client(port, 'player-d'); sockets.push(d);
    const aMatch = once(a, 'match_found');
    const cMatch = once(c, 'match_found');
    a.emit('join_queue', { timeControl: '3+2' });
    b.emit('join_queue', { timeControl: '10+0' });
    c.emit('join_queue', { timeControl: '3+2' });
    const [am, cm] = await Promise.all([aMatch, cMatch]);
    assert.equal(am.roomId, cm.roomId);
    assert.notEqual(am.color, cm.color);
    const rapid = once(b, 'match_found');
    const rapidSecond = once(d, 'match_found');
    d.emit('join_queue', { timeControl: '10+0' });
    const [bm, dm] = await Promise.all([rapid, rapidSecond]);
    assert.equal(bm.roomId, dm.roomId);
    assert.notEqual(am.roomId, bm.roomId);
    assert.equal(activeRooms.get(am.roomId).timeControl, '3+2');
    assert.equal(activeRooms.get(am.roomId).initialTime, 180);
    assert.equal(activeRooms.get(am.roomId).increment, 2);
    assert.equal(activeRooms.get(bm.roomId).timeControl, '10+0');
    cleanupRoom(am.roomId, activeRooms.get(am.roomId));
    cleanupRoom(bm.roomId, activeRooms.get(bm.roomId));

    const host = await client(port, 'host-player'); sockets.push(host);
    const recipient = await client(port, 'target-player'); sockets.push(recipient);
    const stranger = await client(port, 'stranger-player'); sockets.push(stranger);
    const presence = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No target in presence')), 4000);
      const handler = value => {
        if (!value?.userIds?.includes('target-player')) return;
        clearTimeout(timer);
        host.off('lobby_presence', handler);
        resolve(value);
      };
      host.on('lobby_presence', handler);
    });
    host.emit('lobby_presence_enter');
    recipient.emit('lobby_presence_enter');
    stranger.emit('lobby_presence_enter');
    recipient.emit('lobby_ready_set', { ready: true });
    await presence;
    const created = once(host, 'private_room_created');
    host.emit('create_private_room', { timeControl: '3+2' });
    const { roomId } = await created;
    const invitation = once(recipient, 'lobby_game_invitation');
    host.emit('invite_lobby_player', { roomId, targetUserId: 'target-player' });
    const offer = await invitation;
    assert.equal(offer.fromUserId, 'host-player');
    assert.equal(offer.timeControl, '3+2');
    const rejected = once(stranger, 'join_failed');
    stranger.emit('join_private_room', { roomId });
    assert.equal((await rejected).reason, 'invitation_not_for_you');
    const hostMatch = once(host, 'match_found');
    const targetMatch = once(recipient, 'match_found');
    recipient.emit('join_private_room', { roomId });
    const [hm, tm] = await Promise.all([hostMatch, targetMatch]);
    assert.equal(hm.roomId, roomId);
    assert.equal(tm.roomId, roomId);
    assert.equal(activeRooms.get(roomId).timeControl, '3+2');
    cleanupRoom(roomId, activeRooms.get(roomId));
  } finally {
    for (const socket of sockets) socket.disconnect();
    lobbyPresence.clear();
    for (const [id, room] of activeRooms) cleanupRoom(id, room);
    await new Promise(resolve => server.close(resolve));
  }
});
