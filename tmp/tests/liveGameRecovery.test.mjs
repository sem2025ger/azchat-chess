import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { analysisFromMoves, playAnalysisMoveAtView } from '../src/utils/analysisWorkspace.ts';
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
    isLocalAnalysis: () => false,
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

// Exercise the production socket guards: a local variation must survive stale
// snapshots, move rejections and recovery expiry without reactivating the game.
test('postgame analysis ignores room events and expiry; live games retain room filtering', () => {
  for (const local of [true, false]) {
    const isCurrentRoomEvent = screenHandler('isCurrentRoomEvent', {roomId:'r', isLocalAnalysis: () => local});
    assert.equal(isCurrentRoomEvent({roomId:'r'}), !local);
    assert.equal(isCurrentRoomEvent({}), !local);
    assert.equal(isCurrentRoomEvent({roomId:'other'}), false);
  }
  for (const name of ['onMoveRejected','onSessionExpired']) {
    // No state setters are supplied: falling through the guard fails this test.
    const handler = screenHandler(name, {isLocalAnalysis: () => true});
    assert.doesNotThrow(() => handler({reason:'game_over'}));
  }
});

test('dismissal unlocks local analysis only after a confirmed terminal event for this room', () => {
  for (const confirmed of [null, 'other', 'r']) {
    const selected = [], phases = [], ref = {current:null};
    const dismiss = screenHandler('dismissResult', {useCallback: callback => callback, isMultiplayer:true, roomId:'r',
      confirmedEndedRoomRef:{current:confirmed}, postGameAnalysisRoomRef:ref,
      setPostGameAnalysisRoom:value => phases.push(value), setActiveTab:value => selected.push(value)});
    dismiss();
    assert.deepEqual(phases, confirmed === 'r' ? ['r'] : []);
    assert.equal(ref.current, confirmed === 'r' ? 'r' : null);
    assert.deepEqual(selected,['analysis']);
  }
});

test('MULTIVERSE training moves go only to the local Stockfish session, never to the socket or the finished game', () => {
  const initial = analysisFromMoves([]), emitted = [], trained = [];
  const fail = () => { throw Error('The finished game must stay unchanged'); };
  const handle = screenHandler('handleGameMove', {useCallback: callback => callback, Chess, playAnalysisMoveAtView,
    ...initial, computerBranch:{moves:[]}, computerSession:{current:{move:uci => { trained.push(uci); return true; }}},
    isMultiplayer:true, isPostGameAnalysis:true, canSendGameAction:false, playerColor:'b', mode:'live', roomId:'r', sound:'Muted / Off',
    socket:{emit:(...args) => emitted.push(args)}, locallyPlayedFenRef:{current:null}, playChessSound:fail, setMapSnapshot:fail,
    setViewMoveIndex:fail, setGame:fail, setMoveHistory:fail, setPositionHistory:fail, setGameOverMessage:fail,
  });
  assert.equal(handle('e2','e4'), true);
  assert.equal(handle('e7','e8','r'), true);
  assert.deepEqual(trained, ['e2e4', 'e7e8r']);
  assert.equal(emitted.length, 0);
});

test('production move handler preserves online validation and uses only local branches after dismissal', () => {
  for (const [local, connected, color, expected] of [[false,true,'w',true], [false,true,'b',false], [false,false,'w',false], [true,false,'b',true]]) {
    const initial = analysisFromMoves([]), emitted = [], states = {};
    const noop = () => {};
    const handle = screenHandler('handleGameMove', {useCallback: callback => callback, Chess, playAnalysisMoveAtView,
      ...initial, computerBranch:null, computerSession:{current:null}, isMultiplayer:true, isPostGameAnalysis:local, canSendGameAction:connected, playerColor:color,
      mode:'live', roomId:'r', sound:'Muted / Off', socket:{emit:(...args) => emitted.push(args)},
      locallyPlayedFenRef:{current:null}, playChessSound:noop, setMapSnapshot:noop, setViewMoveIndex:noop,
      setGame:value => {states.game = value;}, setMoveHistory:value => {states.moves = value;}, setPositionHistory:noop,
      setGameOverMessage:() => {throw Error('The online outcome must remain unchanged');},
    });
    assert.equal(handle('e2','e4'),expected);
    assert.equal(emitted.length,expected && !local ? 1 : 0);
    if (expected) assert.equal(states.game.get('e4').type,'p');
    if (local) assert.deepEqual(Array.from(states.moves),['e4']);
    if (emitted.length) assert.equal(emitted[0][0],'make_move');
  }
});
