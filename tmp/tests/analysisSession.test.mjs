import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { ANALYSIS_SESSION_KEY, emptyAnalysisSession, loadAnalysisSession, saveAnalysisSession } from '../src/utils/analysisSession.ts';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('navigation and reload restore moves, the full position history and the reviewed position', () => {
  const saved = storage();
  const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'];
  saveAnalysisSession(moves, 4, saved);
  const restored = loadAnalysisSession(saved);
  const expected = new Chess();
  const positions = [expected.fen()];
  moves.forEach(move => { expected.move(move); positions.push(expected.fen()); });
  assert.equal(restored.game.fen(), expected.fen());
  assert.deepEqual(restored.positionHistory, positions);
  assert.deepEqual(restored.moveHistory, moves);
  assert.equal(restored.viewMoveIndex, 4);
  assert.equal(restored.game.history().length, moves.length);
});

test('a restored analysis can continue from its latest position', () => {
  const saved = storage();
  saveAnalysisSession(['e4', 'e5'], -1, saved);
  const restored = loadAnalysisSession(saved);
  assert.equal(restored.viewMoveIndex, -1);
  assert.equal(restored.game.move('Nf3').san, 'Nf3');
});

test('new analysis persists a deliberate reset instead of restoring old moves', () => {
  const saved = storage();
  saveAnalysisSession(['e4', 'e5'], 1, saved);
  saveAnalysisSession([], -1, saved);
  const restored = loadAnalysisSession(saved);
  assert.deepEqual(restored.moveHistory, []);
  assert.deepEqual(restored.positionHistory, [new Chess().fen()]);
  assert.equal(restored.viewMoveIndex, -1);
});

test('malformed, unsupported and illegal saved analyses fall back safely', () => {
  saveAnalysisSession(['d4', 'd5'], -1, storage());
  for (const raw of ['{broken', 'null', '{}', JSON.stringify({version: 9, moves: []}), JSON.stringify({version: 1, moves: ['e4', 'e4']}), JSON.stringify({version: 1, moves: [15]})]) {
    const saved = storage();
    saved.setItem(ANALYSIS_SESSION_KEY, raw);
    assert.equal(loadAnalysisSession(saved).game.fen(), new Chess().fen());
  }
});

test('an invalid history index returns to the current position', () => {
  const saved = storage();
  saveAnalysisSession(['e4'], 900, saved);
  assert.equal(loadAnalysisSession(saved).viewMoveIndex, -1);
});

test('blocked storage still preserves analysis across route unmounts in memory', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  saveAnalysisSession(['d4', 'd5'], 1, blocked);
  const restored = loadAnalysisSession(blocked);
  assert.deepEqual(restored.moveHistory, ['d4', 'd5']);
  assert.equal(restored.viewMoveIndex, 1);
  assert.equal(emptyAnalysisSession().moveHistory.length, 0);
});
