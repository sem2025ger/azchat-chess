import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { loadMultiverseBranches, saveMultiverseBranches } from '../src/utils/multiverseStorage.ts';
import { createMultiverseBranch, appendMultiverseMove, replayMultiverseBranch, multiverseUciMove, multiverseBranchPgn } from '../src/utils/multiverse.ts';

test('independent alternative branches retain original root and do not mutate each other', () => {
  const source = new Chess();
  for (const san of ['d4','d5','Nf3','Nf6','c4','e6']) source.move(san);
  const fen = source.fen();
  const a = createMultiverseBranch(fen, 'Original', 'a');
  const b = createMultiverseBranch(fen, 'Alternative', 'b');
  const afterA = appendMultiverseMove(a, 'b1c3');
  const afterB = appendMultiverseMove(b, 'g2g3');
  assert.equal(a.moves.length, 0);
  assert.equal(b.moves.length, 0);
  assert.notEqual(afterA.positions.at(-1), afterB.positions.at(-1));
  assert.equal(replayMultiverseBranch(afterA).fen(), afterA.positions.at(-1));
  assert.equal(source.fen(), fen);
});

test('black to move, promotion and engine move validation', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 17';
  const branch = createMultiverseBranch(fen, 'Black', 'black');
  const next = appendMultiverseMove(branch, 'e8f7');
  assert.equal(replayMultiverseBranch(next).turn(), 'w');
  assert.equal(multiverseUciMove(fen, 'e8f7'), next.positions[1]);
  assert.throws(() => appendMultiverseMove(branch, 'e8e2'));
  assert.throws(() => multiverseUciMove(fen, 'bad'));
  assert.throws(() => createMultiverseBranch('invalid', 'bad', 'bad'));
  assert.throws(() => replayMultiverseBranch({ ...next, positions: [fen, fen] }));
});

test('saved variations survive reload and corrupted entries are ignored', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const branch = appendMultiverseMove(createMultiverseBranch(new Chess().fen(), 'Test', 'id'), 'e2e4');
  saveMultiverseBranches([branch], storage);
  assert.deepEqual(loadMultiverseBranches(storage), [branch]);
  memory.set('chessaz.multiverse.branches.v1', JSON.stringify([{...branch, positions:[branch.rootFen,branch.rootFen]}]));
  assert.deepEqual(loadMultiverseBranches(storage), []);
});

test('portable PGN retains setup FEN and can be imported', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 17';
  const branch = appendMultiverseMove(createMultiverseBranch(fen, 'Black starts', 'pgn'), 'e8f7');
  const pgn = multiverseBranchPgn(branch);
  assert.match(pgn, /\[FEN "/);
  const imported = new Chess();
  imported.loadPgn(pgn);
  assert.equal(imported.fen(), replayMultiverseBranch(branch).fen());
});
