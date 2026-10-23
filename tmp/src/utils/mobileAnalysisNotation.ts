/** Presentation-only helpers: don't alter SAN, engine scores or chess history. */
export type AnalysisSide = 'w' | 'b';
export interface MovePairForCopy { n: number; w: string; b?: string }

/** Stockfish display tokens include separate "17." / "17..." labels.
 *  Those labels are not moves and must never flip the piece colour. */
export function colorizeAnalysisMoves(tokens: readonly string[], startingSide: AnalysisSide) {
  let side: AnalysisSide = startingSide;
  return tokens.map(move => {
    if (/^\d+\.(?:\.\.)?$/.test(move)) return { move, side: null };
    const current = side;
    side = side === 'w' ? 'b' : 'w';
    return { move, side: current };
  });
}

/** Entire *played* game, not Stockfish principal variations. No engine scores,
 *  comments, FEN or extra metadata. Preserve numbering for arbitrary initial FENs. */
export function formatPlayedMoves(moves: readonly MovePairForCopy[]): string {
  return moves.map(row => {
    if (!row.w && !row.b) return '';
    if (!row.w) return `${row.n}... ${row.b}`;
    return `${row.n}. ${row.w}${row.b ? ` ${row.b}` : ''}`;
  }).filter(Boolean).join(' ');
}
