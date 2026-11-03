import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { createPositionMapSnapshot, selectPositionMapVariation } from '../src/utils/positionMapNavigation.ts';

test('snapshot uses the actual selected position, not the next ply', () => {
  const history = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
  assert.deepEqual(createPositionMapSnapshot('fen', history, 4).baseMoves, history.slice(0, 4));
  assert.deepEqual(createPositionMapSnapshot('fen', history, -1).baseMoves, history);
});

test('returning from a line keeps original candidate source; switching replaces rather than appends', () => {
  const initial = ['e4','e5','Nf3','Nc6'];
  const source = new Chess();
  for (const san of initial) source.move(san);
  const fen = source.fen();
  const result = { analyzedFen: fen, depth: 18, lines: [
    { multipv: 1, evaluation: 0.3, depth: 18, pv: ['f1b5','a7a6','b5a4','g8f6'] },
    { multipv: 2, evaluation: 0.2, depth: 18, pv: ['f1c4','g8f6','d2d3','f8c5'] },
    { multipv: 3, evaluation: 0.1, depth: 18, pv: ['d2d4','e5d4','f3d4','g8f6'] },
  ] };
  const snapshot = { ...createPositionMapSnapshot(fen, initial, -1), result };
  const first = selectPositionMapVariation(snapshot, result, ['Bb5','a6','Ba4','Nf6'], DEFAULT_POSITION);
  assert.deepEqual(first.analysis.moveHistory, [...initial,'Bb5','a6','Ba4','Nf6']);
  assert.equal(first.snapshot.fen, fen);
  assert.equal(first.snapshot.frozen, true);
  assert.strictEqual(first.snapshot.result, result);
  const second = selectPositionMapVariation(first.snapshot, first.snapshot.result, ['Bc4','Nf6','d3','Bc5'], DEFAULT_POSITION);
  assert.deepEqual(second.analysis.moveHistory, [...initial,'Bc4','Nf6','d3','Bc5']);
  assert.equal(second.snapshot.fen, fen);
});

test('rejects unrelated, truncated and stale moves', () => {
  const fen = DEFAULT_POSITION;
  const result = { analyzedFen: fen, depth: 18, lines: [
    { multipv: 1, evaluation: 0, depth: 18, pv: ['e2e4','e7e5'] },
  ] };
  const snapshot = { ...createPositionMapSnapshot(fen, [], -1), result };
  assert.throws(() => selectPositionMapVariation(snapshot, result, ['d4'], fen));
  assert.throws(() => selectPositionMapVariation(snapshot, result, ['e4'], fen));
  assert.throws(() => selectPositionMapVariation(snapshot, { ...result, analyzedFen: 'stale' }, ['e4','e5'], fen));
});
