import { Chess } from 'chess.js';
import type { EngineResult } from './StockfishEngine.ts';
import { annotatedPgn, type PositionEvaluation } from './positionMap.ts';

/** Plain-text export of actual ChessAZ analysis data, without account identifiers,
 *  hidden engine guesses or an invented evaluation for unanalysed positions. */
export function formatFullAnalysisReport({
  initialFen, moves, currentFen, evaluations, currentResult, title = '',
}: {
  initialFen: string;
  moves: string[];
  currentFen: string;
  evaluations: Record<string, PositionEvaluation>;
  currentResult: EngineResult | null;
  title?: string;
}): string {
  const pgn = annotatedPgn(initialFen, moves, evaluations);
  const report: string[] = ['ChessAZ — Full analysis'];
  if (title.trim()) report.push('Game: ' + title.trim().slice(0, 200));
  report.push('Initial FEN: ' + initialFen, 'Selected FEN: ' + currentFen,
    '', 'PGN with available position evaluations:', pgn || '(no moves yet)',
    '', 'Positions with recorded engine evaluations:');

  const replay = new Chess(initialFen);
  let found = 0;
  for (let i = 0; i < moves.length; i++) {
    const move = replay.move(moves[i]);
    const result = evaluations[replay.fen()];
    if (!result) continue;
    const label = Math.floor(i / 2) + 1 + (move.color === 'w' ? '. ' : '... ');
    report.push(label + move.san + ' | FEN ' + replay.fen() +
      ' | ' + formatScore(result) + ' | depth ' + result.depth);
    found++;
  }
  if (!found) report.push('(no recorded evaluations)');

  report.push('', 'Stockfish 18 — selected position:');
  // Stockfish can still be calculating, or contain a result from a previous move.
  // Never mislabel those results as the selected position's analysis.
  if (!currentResult || currentResult.analyzedFen !== currentFen) {
    report.push('(no completed evaluation for this position)');
    return report.join('\n');
  }
  report.push('Score: ' + formatScore(currentResult), 'Depth: ' + currentResult.depth);
  const pv = currentResult.lines?.length
    ? currentResult.lines
    : currentResult.bestMove
      ? [{ multipv: 1, evaluation: currentResult.evaluation, mate: currentResult.mate,
          depth: currentResult.depth, pv: [currentResult.bestMove, ...(currentResult.continuation || [])] }]
      : [];
  let validCount = 0;
  for (const line of pv) {
    if (!line.pv.length) continue;
    try {
      const board = new Chess(currentFen);
      const notation: string[] = [];
      for (const uci of line.pv) {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw Error('Invalid UCI');
        const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        notation.push(move.san);
      }
      report.push('Line ' + line.multipv + ' | ' + formatScore(line) + ' | depth ' + line.depth,
        '  SAN: ' + notation.join(' '), '  UCI: ' + line.pv.join(' '));
      validCount++;
    } catch {
      // Do not export a partially replayed or corrupted principal variation.
    }
  }
  if (!validCount) report.push('(no valid engine continuation available)');
  return report.join('\n');
}

function formatScore(value: { evaluation: number; mate?: number | null }): string {
  if (value.mate != null) return '#' + (value.mate > 0 ? '+' : '') + value.mate;
  return (value.evaluation > 0 ? '+' : '') + value.evaluation.toFixed(2);
}
