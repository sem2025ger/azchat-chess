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

// ---- Engine-based comparison and shareable links ----
import { MultiverseEvaluator, findMultiverseCriticalMove, formatMultiverseDelta, formatMultiverseScore, multiversePositionsToScore, multiverseScoreDelta, multiverseScoreValue, multiverseTerminalScore, summarizeMultiverseBranches } from '../src/utils/multiverseEvaluation.ts';
import { MULTIVERSE_SHARE_MAX_LENGTH, decodeMultiverseShare, encodeMultiverseShare, multiverseShareUrl } from '../src/utils/multiverseShare.ts';

test('evaluation formatting is white-perspective, flips for black and handles mate and terminal scores', () => {
  assert.equal(formatMultiverseScore({ evaluation: 0.35, depth: 12 }), '+0.35');
  assert.equal(formatMultiverseScore({ evaluation: 0.35, depth: 12 }, true), '-0.35');
  assert.equal(formatMultiverseScore({ evaluation: -1.2, depth: 12 }), '-1.20');
  assert.equal(formatMultiverseScore({ evaluation: 0, depth: 12 }), '0.00');
  assert.equal(formatMultiverseScore({ evaluation: 100, mate: 3, depth: 12 }), '#3');
  assert.equal(formatMultiverseScore({ evaluation: -100, mate: -2, depth: 12 }), '#-2');
  assert.equal(formatMultiverseScore({ evaluation: -100, mate: -2, depth: 12 }, true), '#2');
  assert.equal(formatMultiverseScore(undefined), '…');
  assert.equal(formatMultiverseScore(multiverseTerminalScore('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), '0-1');
  assert.equal(formatMultiverseScore(multiverseTerminalScore('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), '½-½');
  assert.equal(multiverseTerminalScore(new Chess().fen()), null);
  // Mate always outranks centipawns, and a shorter mate ranks higher.
  assert.ok(multiverseScoreValue({ evaluation: 100, mate: 1, depth: 1 }) > multiverseScoreValue({ evaluation: 100, mate: 5, depth: 1 }));
  assert.ok(multiverseScoreValue({ evaluation: 100, mate: 9, depth: 1 }) > multiverseScoreValue({ evaluation: 50, depth: 1 }));
  assert.equal(formatMultiverseDelta(multiverseScoreDelta({ evaluation: 0.2, depth: 1 }, { evaluation: -0.8, depth: 1 })), '-1.00');
  assert.equal(formatMultiverseDelta(0), '±0.00');
});

test('critical move is the largest loss by the mover, from either side', () => {
  const start = new Chess().fen();
  let branch = createMultiverseBranch(start, 'Line', 'line');
  for (const uci of ['e2e4', 'e7e5', 'g1f3', 'b8c6']) branch = appendMultiverseMove(branch, uci);
  const [p0, p1, p2, p3, p4] = branch.positions;
  const scores = { [p0]: { evaluation: 0.2, depth: 1 }, [p1]: { evaluation: 0.3, depth: 1 }, [p2]: { evaluation: 2.1, depth: 1 }, [p3]: { evaluation: 2.0, depth: 1 }, [p4]: { evaluation: 0.5, depth: 1 } };
  const critical = findMultiverseCriticalMove(branch, scores);
  assert.deepEqual({ ply: critical.ply, san: critical.san, mover: critical.mover, moveNumber: critical.moveNumber }, { ply: 2, san: 'e5', mover: 'b', moveNumber: 1 });
  assert.ok(Math.abs(critical.loss - 1.8) < 1e-9);
  // Below the threshold nothing is flagged; a missing score leaves the branch pending.
  assert.equal(findMultiverseCriticalMove(branch, { [p0]: { evaluation: 0, depth: 1 }, [p1]: { evaluation: 0.5, depth: 1 } }), null);
  const summary = summarizeMultiverseBranches([branch], { [p0]: scores[p0], [p4]: scores[p4] });
  assert.equal(summary[0].pendingPositions, 3);
  assert.ok(Math.abs(summary[0].deltaFromRoot - 0.3) < 1e-9);
  assert.deepEqual(multiversePositionsToScore([branch], { [p0]: scores[p0] }), [p1, p2, p3, p4]);
});

test('evaluator scores queued positions sequentially and ignores stale or foreign bestmoves', () => {
  const originalWorker = globalThis.Worker;
  const workers = [];
  class WorkerStub { constructor() { workers.push(this); this.commands = []; } postMessage(c) { this.commands.push(c); } terminate() { this.terminated = true; } emit(line) { this.onmessage({ data: line }); } }
  globalThis.Worker = WorkerStub;
  try {
    const scored = {};
    let failed = false;
    const evaluator = new MultiverseEvaluator(10, (fen, score) => { scored[fen] = score; }, () => { failed = true; });
    const start = new Chess().fen();
    const afterE4 = multiverseUciMove(start, 'e2e4');
    const mated = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    evaluator.enqueue([start, afterE4, mated, start]);
    assert.equal(scored[mated].terminal, 'checkmate');
    const worker = workers[0];
    worker.emit('uciok'); worker.emit('readyok');
    assert.ok(worker.commands.some(c => c === `position fen ${start}`));
    assert.ok(evaluator.isBusy());
    worker.emit('info depth 10 multipv 1 score cp 35 pv e2e4 e7e5');
    worker.emit('bestmove e2e4');
    assert.equal(scored[start].evaluation, 0.35);
    assert.equal(scored[afterE4], undefined);
    // Second position: black to move, engine reports from the mover's view; stored as white-perspective mate.
    assert.ok(worker.commands.some(c => c === `position fen ${afterE4}`));
    worker.emit('info depth 10 multipv 1 score mate -4 pv e7e5');
    worker.emit('bestmove e7e5');
    assert.equal(scored[afterE4].mate, 4);
    assert.equal(evaluator.isBusy(), false);
    assert.equal(Object.keys(scored).length, 3);
    assert.equal(failed, false);
    evaluator.destroy();
    assert.equal(worker.terminated, true);
  } finally {
    if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker;
  }
});

test('share links round-trip a variation and reject tampered, oversized or illegal payloads', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  let branch = createMultiverseBranch(fen, 'Nc3 idea', 'orig');
  for (const uci of ['b1c3', 'g8f6', 'f1c4', 'f8c5', 'e1g1']) branch = appendMultiverseMove(branch, uci);
  const url = multiverseShareUrl('https://chessaz.de', '/game', branch);
  assert.match(url, /^https:\/\/chessaz\.de\/game\?mv=[A-Za-z0-9_-]+$/);
  const encoded = new URL(url).searchParams.get('mv');
  const restored = decodeMultiverseShare(encoded, 'shared');
  assert.equal(restored.rootFen, branch.rootFen);
  assert.deepEqual(restored.moves, branch.moves);
  assert.deepEqual(restored.positions, branch.positions);
  assert.equal(restored.label, 'Nc3 idea');
  assert.equal(restored.id, 'shared');
  assert.throws(() => decodeMultiverseShare('', 'x'));
  assert.throws(() => decodeMultiverseShare('not base64!!', 'x'));
  assert.throws(() => decodeMultiverseShare('a'.repeat(MULTIVERSE_SHARE_MAX_LENGTH + 1), 'x'));
  const tamper = payload => Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.throws(() => decodeMultiverseShare(tamper({ v: 2, fen, moves: [], label: 'x' }), 'x'));
  assert.throws(() => decodeMultiverseShare(tamper({ v: 1, fen, moves: ['Qh5'], label: 'x' }), 'x'));
  assert.throws(() => decodeMultiverseShare(tamper({ v: 1, fen: 'garbage', moves: [], label: 'x' }), 'x'));
  assert.throws(() => decodeMultiverseShare(tamper({ v: 1, fen, moves: Array(301).fill('Nc3'), label: 'x' }), 'x'));
  assert.throws(() => decodeMultiverseShare(tamper([1, 2]), 'x'));
  assert.equal(decodeMultiverseShare(tamper({ v: 1, fen, moves: [], label: '   ' }), 'x').label, 'Shared variation');
  assert.equal(encodeMultiverseShare(branch), encoded);
});
