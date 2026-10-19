import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Chess } from 'chess.js';
import { attachLiveRecovery, decodeLiveSnapshot } from '../src/utils/liveGameRecovery.ts';

test('live resync restores full history, both colours, draw state and terminal status', () => {
  const game = new Chess();
  for (const move of ['e4','a6','e5','d5','exd6']) game.move(move);
  for (const color of ['w','b']) {
    const data = decodeLiveSnapshot({ fen: game.fen(), history: game.history(), initialFen: new Chess().fen(), color, drawOfferBy: 'b', status: 'ended' });
    assert.ok(data); assert.equal(data.color, color); assert.equal(data.ended, true);
    assert.equal(data.drawOfferBy, 'b'); assert.equal(data.positions.length, 6);
    assert.deepEqual(data.game.history(), game.history());
  }
  assert.equal(decodeLiveSnapshot({ fen: game.fen(), history: [] }), null);
});

test('connection and page mount request server state; disconnection never uploads local state', () => {
  const socket = new EventEmitter(); socket.connected = true;
  const requests = []; let waiting = 0;
  socket.on('reconnect_game', data => requests.push(data));
  const dispose = attachLiveRecovery(socket, 'room-from-url', () => waiting++);
  assert.deepEqual(requests, [{ roomId: 'room-from-url' }]);
  socket.connected = false; socket.emit('disconnect');
  socket.connected = true; socket.emit('connect');
  assert.equal(waiting, 2); assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], { roomId: 'room-from-url' });
  dispose(); socket.emit('connect'); assert.equal(requests.length, 2);
  assert.equal(socket.listenerCount('reconnect_failed'), 0);
});

test('temporary recovery failure retries and disposing cancels the pending retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const socket = new EventEmitter(); socket.connected = true;
  let requests = 0; socket.on('reconnect_game', () => requests++);
  const dispose = attachLiveRecovery(socket, 'r', () => {});
  socket.emit('reconnect_failed', { reason: 'recovery_pending' });
  t.mock.timers.tick(2000); assert.equal(requests, 2);
  socket.emit('reconnect_failed', { reason: 'not_a_player' });
  t.mock.timers.tick(2000); assert.equal(requests, 2);
  socket.emit('move_rejected', { reason: 'storage_unavailable' });
  dispose(); t.mock.timers.tick(2000); assert.equal(requests, 2);
});
