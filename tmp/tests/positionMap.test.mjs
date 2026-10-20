import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { positionMap, annotatedPgn } from '../src/utils/positionMap.ts';

test('position map derives pawn files and material from the actual board', () => {
  const initial = positionMap(DEFAULT_POSITION);
  assert.deepEqual(initial.openFiles, []);
  assert.equal(initial.white.material, 39);
  assert.equal(initial.black.pawns, 8);
  assert.deepEqual(initial.plans, []);
  const custom = positionMap('4k3/2p5/8/8/2P5/2P5/8/4K3 w - - 0 1');
  assert.deepEqual(custom.white.doubled, ['c']);
  assert.deepEqual(custom.white.isolated.sort(), ['c3', 'c4']);
  assert.deepEqual(custom.openFiles, ['a', 'b', 'd', 'e', 'f', 'g', 'h']);
});

test('plans replay legal engine moves and reject stale positions and invalid lines', () => {
  const result = { analyzedFen: DEFAULT_POSITION, evaluation: 0.2, bestMove: 'e2e4', depth: 18, lines: [
    { multipv: 1, pv: ['e2e4', 'e7e5', 'g1f3'], evaluation: 0.2, depth: 18 },
    { multipv: 2, pv: ['e2e5', 'e7e5'], evaluation: 1, depth: 18 },
    { multipv: 3, pv: ['e2e4', 'e7e5'], evaluation: 0.5, depth: 18 },
  ] };
  const map = positionMap(DEFAULT_POSITION, result);
  assert.equal(map.plans.length, 1);
  assert.deepEqual(map.plans[0].moves.map(move => [move.color, move.san]), [['w','e4'], ['b','e5'], ['w','Nf3']]);
  const next = new Chess(); next.move('e4');
  assert.deepEqual(positionMap(next.fen(), result).plans, []);
  const black = positionMap(next.fen(), { ...result, analyzedFen: next.fen(), lines: [{ multipv: 1, pv: ['e7e5', 'g1f3'], evaluation: -0.4, depth: 20 }] });
  assert.equal(black.turn, 'b');
  assert.equal(black.plans[0].evaluation, -0.4);
  assert.equal(black.plans[0].moves[1].color, 'w');
});

test('PGN annotates only genuinely analyzed positions and remains replayable', () => {
  const game = new Chess(); game.move('e4');
  const pgn = annotatedPgn(DEFAULT_POSITION, ['e4','e5'], { [game.fen()]: { evaluation: 0.35, depth: 18 } });
  assert.match(pgn, /\[%eval 0.35\]/);
  assert.equal((pgn.match(/\[%eval/g) || []).length, 1);
  const replay = new Chess(); replay.loadPgn(pgn);
  assert.deepEqual(replay.history(), ['e4','e5']);
});
