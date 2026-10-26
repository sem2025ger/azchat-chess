'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fake-test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'fake-anon-key';
const { io: connect } = require('socket.io-client');
const { server, io, activeRooms, cleanupRoom, setTokenVerifier } = require('./index');

function next(socket, name, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Missing ' + name)), timeoutMs);
    socket.once(name, value => { clearTimeout(timer); resolve(value); });
  });
}
async function client(port, id) {
  const socket = connect('http://127.0.0.1:' + port, {
    transports: ['websocket'], reconnection: false, auth: { accessToken: id }
  });
  await next(socket, 'connect');
  return socket;
}

test('online lobby: private invitations and time-aware matchmaking', async () => {
  setTokenVerifier(async token => token ? { id: token, email: 'test@example.invalid' } : null);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const sockets = [];
  try {
    const [a,b,c,d] = await Promise.all(['a','b','c','d'].map(async id => {
      const socket = await client(port, id); sockets.push(socket); return socket;
    }));
    const aPresence = next(a,'lobby_presence');
    a.emit('lobby_presence_enter');
    assert.deepEqual((await aPresence).userIds, []);
    const bPresence = next(a, 'lobby_presence');
    // A forged ready flag on entry must not expose the account.
    b.emit('lobby_presence_enter', { ready: true });
    const notReady = await bPresence;
    assert.deepEqual(notReady.userIds, [], 'new visitor is hidden until explicit opt-in');
    assert.deepEqual(notReady.readyUserIds, [], 'new visitor cannot be challenged');
    const unavailableRoom = next(a, 'private_room_created');
    a.emit('create_private_room', { timeControl: '3+2' });
    const unavailableId = (await unavailableRoom).roomId;
    const denied = next(a, 'invitation_failed');
    a.emit('invite_lobby_player', { roomId: unavailableId, targetUserId: 'b' });
    assert.equal((await denied).reason, 'player_unavailable');
    a.emit('cancel_matchmaking');
    const readyAgain = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Target did not become ready')), 4000);
      const onPresence = event => {
        if (!event.readyUserIds?.includes('b')) return;
        clearTimeout(timer);
        a.off('lobby_presence', onPresence);
        resolve(event);
      };
      a.on('lobby_presence', onPresence);
    });
    b.emit('lobby_ready_set', { ready: true });
    assert.deepEqual((await readyAgain).readyUserIds, ['b']);
    const hiddenAgain = next(a, 'lobby_presence');
    b.emit('lobby_ready_set', { ready: false });
    assert.deepEqual((await hiddenAgain).readyUserIds, [], 'turning readiness off hides the player');
    const shownAgain = next(a, 'lobby_presence');
    b.emit('lobby_ready_set', { ready: true });
    assert.deepEqual((await shownAgain).readyUserIds, ['b'], 'player reappears on explicit opt-in');

    const created = next(a,'private_room_created');
    a.emit('create_private_room', { timeControl: '3+2' });
    const room = await created;
    assert.equal(room.timeControl,'3+2');

    const incoming = next(b,'lobby_game_invitation');
    a.emit('invite_lobby_player', { roomId: room.roomId, targetUserId: 'b' });
    const invitation = await incoming;
    assert.equal(invitation.fromUserId,'a');
    assert.equal(invitation.timeControl,'3+2');
    const forbidden = next(c,'join_failed');
    c.emit('join_private_room', { roomId: room.roomId });
    assert.equal((await forbidden).reason,'invitation_not_for_you');

    const aMatch = next(a,'match_found');
    const bMatch = next(b,'match_found');
    b.emit('join_private_room', { roomId: room.roomId });
    const [am,bm] = await Promise.all([aMatch,bMatch]);
    assert.equal(am.roomId,bm.roomId);
    assert.notEqual(am.color,bm.color);
    assert.equal(activeRooms.get(room.roomId).timeControl,'3+2');
    assert.equal(activeRooms.get(room.roomId).increment,2);
    assert.equal(activeRooms.get(room.roomId).initialTime,180);
    cleanupRoom(room.roomId, activeRooms.get(room.roomId));

    const cMatch = next(c,'match_found');
    const dMatch = next(d,'match_found');
    c.emit('join_queue',{ timeControl:'1+1' });
    d.emit('join_queue',{ timeControl:'3+2' });
    // Distinct time controls must not pair.
    await new Promise(resolve => setTimeout(resolve,100));
    assert.equal(activeRooms.size,0);
    d.emit('cancel_matchmaking');
    d.emit('join_queue',{ timeControl:'1+1' });
    const [cm,dm] = await Promise.all([cMatch,dMatch]);
    assert.equal(cm.roomId,dm.roomId);
    assert.equal(activeRooms.get(cm.roomId).timeControl,'1+1');
    assert.equal(activeRooms.get(cm.roomId).initialTime,60);
    assert.equal(activeRooms.get(cm.roomId).increment,1);
    cleanupRoom(cm.roomId,activeRooms.get(cm.roomId));
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const [id,room] of activeRooms) cleanupRoom(id,room);
    await new Promise(resolve => io.close(resolve));
  }
});
