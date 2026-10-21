import { Chess, type Square } from 'chess.js';
import type { EngineResult } from './StockfishEngine.ts';

export interface PositionEvaluation { evaluation: number; mate?: number; depth: number }
export interface PositionPlan {
  id: string;
  moves: { san: string; from: Square; to: Square; color: 'w' | 'b'; piece: string; captured?: string }[];
  evaluation: number;
  mate?: number;
  depth: number;
}

export function positionMap(fen: string, result?: EngineResult | null) {
  const game = new Chess(fen);
  const pieces = game.board().flat().filter(piece => piece !== null);
  const files = [...'abcdefgh'];
  const side = (color: 'w' | 'b') => {
    const own = pieces.filter(piece => piece.color === color);
    const pawns = own.filter(piece => piece.type === 'p');
    const pawnFiles = files.filter(file => pawns.some(pawn => pawn.square[0] === file));
    return {
      material: own.reduce((sum, piece) => sum + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[piece.type]), 0),
      pawns: pawns.length,
      isolated: pawns.filter(pawn => !pawns.some(other => Math.abs(other.square.charCodeAt(0) - pawn.square.charCodeAt(0)) === 1)).map(pawn => pawn.square),
      doubled: pawnFiles.filter(file => pawns.filter(pawn => pawn.square[0] === file).length > 1),
      semiOpen: files.filter(file => !pawnFiles.includes(file) && pieces.some(piece => piece.type === 'p' && piece.color !== color && piece.square[0] === file)),
      bishops: own.filter(piece => piece.type === 'b').length,
    };
  };
  const openFiles = files.filter(file => !pieces.some(piece => piece.type === 'p' && piece.square[0] === file));
  const plans: PositionPlan[] = [];
  // Never present an old search as a plan for the current board.
  if (result?.analyzedFen === fen) {
    const lines = result.lines?.length ? result.lines : result.bestMove ? [{
      multipv: 1, evaluation: result.evaluation, mate: result.mate, depth: result.depth,
      pv: [result.bestMove, ...(result.continuation || [])],
    }] : [];
    const seen = new Set<string>();
    for (const line of lines.slice(0, 5)) {
      if (!line.pv.length || seen.has(line.pv[0])) continue;
      try {
        const replay = new Chess(fen);
        const moves = line.pv.map(uci => {
          if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid engine move');
          const move = replay.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
          return { san: move.san, from: move.from, to: move.to, color: move.color, piece: move.piece, captured: move.captured };
        });
        seen.add(line.pv[0]);
        plans.push({ id: `${fen}:${line.pv[0]}`, moves, evaluation: line.evaluation, mate: line.mate, depth: line.depth });
      } catch { /* Reject invalid lines in full rather than invent a continuation. */ }
    }
  }
  return { turn: game.turn(), ended: game.isGameOver(), white: side('w'), black: side('b'), openFiles, plans };
}

export function annotatedPgn(initialFen: string, moves: string[], evaluations: Record<string, PositionEvaluation>) {
  const game = new Chess(initialFen);
  for (const san of moves) {
    game.move(san);
    const result = evaluations[game.fen()];
    if (result) game.setComment(`[%eval ${result.mate != null ? `#${result.mate}` : result.evaluation.toFixed(2)}] [%depth ${result.depth}]`);
  }
  return game.pgn();
}
