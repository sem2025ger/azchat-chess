import type { EngineResult } from './StockfishEngine.ts';
import { analysisFromMoves } from './analysisWorkspace.ts';
import { positionMap } from './positionMap.ts';

/**
 * Keep a position-map comparison anchored to its original position.
 * Replaying an engine line must not replace the three candidate lines.
 */
export interface PositionMapSnapshot {
  fen: string;
  baseMoves: string[];
  result: EngineResult | null;
  frozen: boolean;
}

export function createPositionMapSnapshot(
  fen: string,
  moveHistory: string[],
  viewMoveIndex: number,
): PositionMapSnapshot {
  // positionHistory[0] is the initial FEN; positionHistory[n] has n SAN moves.
  const count = viewMoveIndex === -1 ? moveHistory.length : viewMoveIndex;
  return { fen, baseMoves: moveHistory.slice(0, count), result: null, frozen: false };
}

export function selectPositionMapVariation(
  snapshot: PositionMapSnapshot,
  result: EngineResult | null,
  moves: string[],
  initialFen: string,
) {
  if (!result || result.analyzedFen !== snapshot.fen || !moves.length) {
    throw new Error('No matching position-map analysis');
  }

  // Only accept one of the displayed legal engine continuations.
  const matchesPlan = positionMap(snapshot.fen, result).plans.some(plan => {
    const shown = plan.moves.slice(0, 10).map(move => move.san);
    return shown.length === moves.length && shown.every((san, index) => san === moves[index]);
  });
  if (!matchesPlan) throw new Error('Stale or invalid position-map variation');

  const analysis = analysisFromMoves([...snapshot.baseMoves, ...moves], initialFen);
  return {
    analysis,
    snapshot: { ...snapshot, result, frozen: true } satisfies PositionMapSnapshot,
  };
}
