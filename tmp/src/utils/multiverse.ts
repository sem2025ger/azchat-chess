import { Chess } from 'chess.js';
import { validateAnalysisFen } from './analysisWorkspace.ts';

export interface MultiverseBranch {
  id: string;
  rootFen: string;
  moves: string[];
  positions: string[];
  label: string;
}

/** Independent training branch; never mutates the source analysis or rated game. */
export function createMultiverseBranch(fen: string, label: string, id: string): MultiverseBranch {
  const rootFen = validateAnalysisFen(fen);
  if (!id || id.length > 100 || !label.trim() || label.length > 120) throw new Error('Invalid branch metadata');
  return { id, label: label.trim(), rootFen, moves: [], positions: [rootFen] };
}

export function appendMultiverseMove(branch: MultiverseBranch, uci: string): MultiverseBranch {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid UCI move');
  if (branch.moves.length >= 2048 || branch.positions.length !== branch.moves.length + 1) throw new Error('Invalid branch history');
  const game = new Chess(validateAnalysisFen(branch.positions[branch.positions.length - 1]));
  const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
  if (!move) throw new Error('Illegal move');
  return {
    ...branch,
    moves: [...branch.moves, move.san],
    positions: [...branch.positions, game.fen()],
  };
}

export function replayMultiverseBranch(branch: MultiverseBranch): Chess {
  const game = new Chess(validateAnalysisFen(branch.rootFen));
  if (branch.moves.length > 2048 || branch.positions.length !== branch.moves.length + 1) throw new Error('Invalid branch history');
  for (let i = 0; i < branch.moves.length; i++) {
    game.move(branch.moves[i]);
    if (game.fen() !== branch.positions[i + 1]) throw new Error('Branch history mismatch');
  }
  return game;
}

export function multiverseUciMove(fen: string, uci: string): string {
  const game = new Chess(validateAnalysisFen(fen));
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid engine move');
  const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
  if (!move) throw new Error('Illegal engine move');
  return game.fen();
}

/** Export an independent line as a portable PGN with its original setup FEN. */
export function multiverseBranchPgn(branch: MultiverseBranch): string {
  const game = replayMultiverseBranch(branch);
  const start = new Chess(branch.rootFen);
  const initial = start.fen() !== new Chess().fen();
  game.setHeader('Event', 'ChessAZ MULTIVERSE');
  game.setHeader('Result', '*');
  if (initial) {
    game.setHeader('SetUp', '1');
    game.setHeader('FEN', branch.rootFen);
  }
  return game.pgn();
}

/** Compare saved continuations from the same root without conflating positions. */
export function compareMultiverseBranches(branches: MultiverseBranch[]): { rootFen: string; branches: { id: string; label: string; plies: number; finalFen: string }[] }[] {
  const grouped = new Map<string, { id: string; label: string; plies: number; finalFen: string }[]>();
  for (const branch of branches.slice(-20)) {
    const finalFen = replayMultiverseBranch(branch).fen();
    const rows = grouped.get(branch.rootFen) ?? [];
    rows.push({ id: branch.id, label: branch.label, plies: branch.moves.length, finalFen });
    grouped.set(branch.rootFen, rows);
  }
  return Array.from(grouped, ([rootFen, entries]) => ({ rootFen, branches: entries }));
}
