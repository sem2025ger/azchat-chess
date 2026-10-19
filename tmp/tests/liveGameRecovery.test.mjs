import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { attachLiveRecovery, decodeLiveSnapshot } from '../src/utils/liveGameRecovery.ts';

function screenHandler(name, globals) {
  const source = ts.createSourceFile('GameScreen.tsx', readFileSync(new URL('../src/screens/GameScreen.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) handler = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(handler, name);
  const module = { exports: null };
  const code = ts.transpileModule('module.exports = ' + handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, ...globals });
  return module.exports;
}

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

test('unknown recovery expires within 30 seconds including an in-flight retry and invokes session expiry once', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const socket = new EventEmitter(); socket.connected = true;
  let requests = 0, expired = 0;
  let message, redirect;
  const expireScreen = screenHandler('onSessionExpired', {
    setSyncedRoom: () => {}, setDisconnectNotice: () => {}, setGameOverMessage: value => { message = value; },
    navigateRef: { current: path => { redirect = path; } },
    timeoutManagerRef: { current: { clear() {}, set: (_, fn, ms) => setTimeout(fn, ms) } },
  });
  socket.on('reconnect_game', () => requests++);
  const dispose = attachLiveRecovery(socket, 'r', () => {}, () => { expired++; expireScreen(); });
  t.mock.timers.tick(8000); // First storage request consumed part of the total budget.
  socket.emit('reconnect_failed', { roomId: 'r', reason: 'storage_unavailable', retryLimitMs: 30000 });
  for (let i = 0; i < 10; i++) {
    t.mock.timers.tick(2000);
    socket.emit('reconnect_failed', { roomId: 'r', reason: 'storage_unavailable', retryLimitMs: 30000 });
  }
  t.mock.timers.tick(2000); // Deadline also fires when a request has no response.
  assert.equal(expired, 1);
  assert.equal(message, 'Session expired or game is no longer active.');
  const stoppedAt = requests;
  socket.emit('reconnect_failed', { roomId: 'r', reason: 'storage_unavailable', retryLimitMs: 30000 });
  t.mock.timers.tick(60000);
  assert.equal(expired, 1); assert.equal(requests, stoppedAt);
  assert.equal(redirect, '/play');
  dispose();
});

test('a confirmed durable recovery removes the unknown-state deadline', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const socket = new EventEmitter(); socket.connected = true;
  let expired = 0;
  const dispose = attachLiveRecovery(socket, 'r', () => {}, () => expired++);
  socket.emit('reconnect_failed', { roomId: 'r', reason: 'storage_unavailable', retryLimitMs: 30000 });
  t.mock.timers.tick(2000);
  socket.emit('reconnect_failed', { roomId: 'r', reason: 'recovery_pending' });
  t.mock.timers.tick(60000); assert.equal(expired, 0);
  dispose();
});

test('the actual GameScreen board-update handler applies an ended snapshot without game_over', () => {
  // Execute the production handler with state-setter spies. No DOM dependency
  // or duplicate implementation of the handler is needed for this regression.
  const game = new Chess(), outcome = { reason: 'resignation', endedBy: 'w' };
  const ended = [];
  const noop = () => {};
  const onUpdate = screenHandler('onUpdate', { decodeLiveSnapshot, roomId: 'r', isCurrentRoomEvent: () => true,
    locallyPlayedFenRef: { current: null }, lastConfirmedFenRef: { current: null }, soundThemeRef: { current: 'default' },
    playChessSound: noop, setMoveRejectMessage: noop, setGame: noop, setPositionHistory: noop,
    setViewMoveIndex: noop, setTimeLeft: noop, setMoveHistory: noop, onGameOver: data => ended.push(data) });
  onUpdate({ roomId: 'r', fen: game.fen(), history: [], status: 'ended', outcome });
  assert.deepEqual(ended, [outcome]);
});

test('terminal events cancel unknown-state retry and expiry timers', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  for (const [name, data] of [['game_over', {}], ['update_board', { status: 'ended' }]]) {
    const socket = new EventEmitter(); socket.connected = true;
    let requests = 0, expired = 0;
    socket.on('reconnect_game', () => requests++);
    const dispose = attachLiveRecovery(socket, 'r', () => {}, () => expired++);
    socket.emit('reconnect_failed', { roomId: 'r', reason: 'storage_unavailable', retryLimitMs: 30000 });
    socket.emit(name, { roomId: 'r', ...data });
    t.mock.timers.tick(60000);
    assert.equal(expired, 0); assert.equal(requests, 1);
    dispose(); assert.equal(socket.listenerCount('game_over'), 0); assert.equal(socket.listenerCount('update_board'), 0);
  }
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
