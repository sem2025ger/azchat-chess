import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { analysisFromMoves, playAnalysisMoveAtView } from '../src/utils/analysisWorkspace.ts';

test('analysis branches immediately from the start after undoing first white move', () => {
  const original = analysisFromMoves(['e4', 'e5']);
  const changed = playAnalysisMoveAtView(original.moveHistory, original.positionHistory, 0, 'g1', 'f3');
  assert.ok(changed);
  assert.deepEqual(changed.analysis.moveHistory, ['Nf3']);
  assert.equal(changed.analysis.positionHistory.length, 2);
  assert.equal(changed.analysis.viewMoveIndex, -1);
  assert.equal(changed.analysis.game.turn(), 'b');
});

test('analysis replaces future plies from selected middle position for black too', () => {
  const original = analysisFromMoves(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  const newBlackReply = playAnalysisMoveAtView(original.moveHistory, original.positionHistory, 1, 'c7', 'c5');
  assert.ok(newBlackReply);
  assert.deepEqual(newBlackReply.analysis.moveHistory, ['e4', 'c5']);
  assert.deepEqual(newBlackReply.analysis.positionHistory.slice(0, 2), original.positionHistory.slice(0, 2));
  assert.equal(newBlackReply.analysis.positionHistory.length, 3);
  assert.equal(newBlackReply.analysis.game.turn(), 'w');
});

test('last-position move appends without changing the existing prefix', () => {
  const original = analysisFromMoves(['e4', 'e5']);
  const changed = playAnalysisMoveAtView(original.moveHistory, original.positionHistory, -1, 'g1', 'f3');
  assert.ok(changed);
  assert.deepEqual(changed.analysis.moveHistory, ['e4', 'e5', 'Nf3']);
});

test('illegal move, invalid index and corrupt FEN cannot modify an analysis', () => {
  const original = analysisFromMoves(['e4', 'e5']);
  assert.equal(playAnalysisMoveAtView(original.moveHistory, original.positionHistory, 0, 'e7', 'e5'), null);
  assert.equal(playAnalysisMoveAtView(original.moveHistory, original.positionHistory, 8, 'g1', 'f3'), null);
  assert.equal(playAnalysisMoveAtView(original.moveHistory, ['invalid', ...original.positionHistory.slice(1)], 0, 'g1', 'f3'), null);
  assert.deepEqual(original.moveHistory, ['e4', 'e5']);
});

test('promotion is validated by chess.js and retains FEN/PGN-compatible state', () => {
  const fen = '8/P7/8/8/8/8/7p/4K2k w - - 0 1';
  const initial = new Chess(fen);
  const changed = playAnalysisMoveAtView([], [initial.fen()], -1, 'a7', 'a8', 'q');
  assert.ok(changed);
  assert.deepEqual(changed.analysis.moveHistory, ['a8=Q+']);
  assert.equal(changed.analysis.positionHistory[1], changed.analysis.game.fen());
});

test('desktop Stockfish PV notation and slightly smaller score typography', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /analysis-engine-moves \{gap:2px 3px!important;font-size:\.79rem!important/);
  assert.match(css, /analysis-engine-moves \{\s*font-size:0\.84rem!important/);
  assert.match(css, /analysis-engine-score \{\s*font-family: Inter,[\s\S]*?font-size: 0\.8125rem !important/);
});
