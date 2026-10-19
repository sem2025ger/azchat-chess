import { Chess, DEFAULT_POSITION, validateFen, type Square } from 'chess.js';

export type AnalysisInputErrorCode = 'invalidFen' | 'illegalPosition' | 'invalidPgn' | 'tooLarge';
export class AnalysisInputError extends Error {
  code: AnalysisInputErrorCode;
  constructor(code: AnalysisInputErrorCode) { super(code); this.code = code; }
}

// Validate a standard-chess position before it ever reaches the worker.
export function validateAnalysisFen(input: string): string {
  const fen = input.trim();
  const fields = fen.split(/\s+/);
  if (fen.length > 200 || fields.length !== 6 || !/^\d+$/.test(fields[4]) ||
      !/^[1-9]\d*$/.test(fields[5]) || !Number.isSafeInteger(Number(fields[4])) ||
      !Number.isSafeInteger(Number(fields[5])) || !validateFen(fen).ok) {
    throw new AnalysisInputError('invalidFen');
  }
  const game = new Chess(fen);
  const [, turn, rights, ep] = fen.split(/\s+/);
  const pieces = game.board().flat().filter(piece => piece !== null);
  for (const color of ['w', 'b'] as const) {
    const own = pieces.filter(piece => piece.color === color);
    const count = (type: string) => own.filter(piece => piece.type === type).length;
    const promotions = Math.max(0, count('q') - 1) + Math.max(0, count('r') - 2) + Math.max(0, count('b') - 2) + Math.max(0, count('n') - 2);
    if (own.length > 16 || count('p') > 8 || promotions > 8 - count('p')) throw new AnalysisInputError('illegalPosition');
  }
  const previous = turn === 'w' ? 'b' : 'w';
  const king = game.board().flat().find(piece => piece?.type === 'k' && piece.color === previous);
  if (!king || game.isAttacked(king.square, game.turn())) throw new AnalysisInputError('illegalPosition');
  for (const [right, kingSquare, rookSquare, color] of [
    ['K', 'e1', 'h1', 'w'], ['Q', 'e1', 'a1', 'w'], ['k', 'e8', 'h8', 'b'], ['q', 'e8', 'a8', 'b'],
  ] as const) {
    if (rights.includes(right) && (game.get(kingSquare)?.type !== 'k' || game.get(kingSquare)?.color !== color ||
        game.get(rookSquare)?.type !== 'r' || game.get(rookSquare)?.color !== color)) {
      throw new AnalysisInputError('illegalPosition');
    }
  }
  if (ep !== '-') {
    const file = ep[0];
    const pawn = game.get(`${file}${turn === 'w' ? '5' : '4'}` as Square);
    if (game.get(ep as Square) || !pawn || pawn.type !== 'p' || pawn.color !== previous ||
        game.get(`${file}${turn === 'w' ? '7' : '2'}` as Square)) {
      throw new AnalysisInputError('illegalPosition');
    }
  }
  return game.fen({ forceEnpassantSquare: true });
}

export function analysisFromMoves(moves: string[], initialFen = DEFAULT_POSITION) {
  if (moves.length > 2048) throw new AnalysisInputError('tooLarge');
  const game = new Chess(validateAnalysisFen(initialFen));
  const positionHistory = [game.fen()];
  const moveHistory: string[] = [];
  for (const san of moves) {
    const move = game.move(san);
    moveHistory.push(move.san);
    positionHistory.push(game.fen());
  }
  return { game, positionHistory, moveHistory, viewMoveIndex: -1 };
}
export type AnalysisLoad = ReturnType<typeof analysisFromMoves>;

export function analysisFromFen(fen: string): AnalysisLoad { return analysisFromMoves([], fen); }

export function analysisFromPgn(pgn: string, initialFen = DEFAULT_POSITION): AnalysisLoad {
  if (pgn.length > 250_000) throw new AnalysisInputError('tooLarge');
  if (!pgn.trim()) throw new AnalysisInputError('invalidPgn');
  try {
    const parsed = new Chess(validateAnalysisFen(initialFen));
    const source = initialFen !== DEFAULT_POSITION && !/^\s*\[FEN\s/m.test(pgn)
      ? `[SetUp "1"]\n[FEN "${validateAnalysisFen(initialFen)}"]\n${pgn}` : pgn;
    parsed.loadPgn(source);
    const moves = parsed.history({ verbose: true });
    // A server record can be marked completed without any recorded move.
    // Do not silently replace the current analysis with an empty chessboard.
    if (moves.length === 0) throw new AnalysisInputError('invalidPgn');
    // PGN SetUp/FEN headers take precedence; otherwise use the match's initial position.
    const rootFen = moves[0]?.before || parsed.getHeaders().FEN || initialFen;
    return analysisFromMoves(moves.map(move => move.san), rootFen);
  } catch (error) {
    if (error instanceof AnalysisInputError && error.code === 'tooLarge') throw error;
    throw new AnalysisInputError('invalidPgn');
  }
}

// Black-to-move FENs must keep their original move number and history indices.
export function analysisMovePairs(moves: string[], initialFen: string) {
  const fields = initialFen.split(' ');
  let number = Number(fields[5]) || 1;
  let color = fields[1] === 'b' ? 'b' : 'w';
  const rows: { n: number; w: string; b: string; wIndex: number; bIndex: number; wTime: string; bTime: string }[] = [];
  moves.forEach((san, index) => {
    if (color === 'w' || rows.length === 0) {
      rows.push({ n: number, w: '', b: '', wIndex: 0, bIndex: 0, wTime: '--', bTime: '--' });
    }
    const row = rows[rows.length - 1];
    if (color === 'w') { row.w = san; row.wIndex = index + 1; color = 'b'; }
    else { row.b = san; row.bIndex = index + 1; color = 'w'; number++; }
  });
  return rows;
}

export interface PositionDraft {
  squares: string[];
  turn: string;
  castling: string;
  ep: string;
  half: string;
  full: string;
}
export function positionDraft(fen: string): PositionDraft {
  const [placement, turn, castling, ep, half, full] = fen.split(' ');
  const squares = [...placement.replaceAll('/', '')].flatMap(char => /[1-8]/.test(char) ? Array(Number(char)).fill('') as string[] : [char]);
  return { squares, turn, castling, ep, half, full };
}
export function positionDraftFen(draft: PositionDraft): string {
  const ranks = [];
  for (let rank = 0; rank < 8; rank++) {
    let row = '', empty = 0;
    for (const piece of draft.squares.slice(rank * 8, rank * 8 + 8)) {
      if (!piece) empty++;
      else { if (empty) row += empty; empty = 0; row += piece; }
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return `${ranks.join('/')} ${draft.turn} ${draft.castling || '-'} ${draft.ep || '-'} ${draft.half} ${draft.full}`;
}
export function placeDraftPiece(draft: PositionDraft, index: number, piece: string): PositionDraft {
  const squares = [...draft.squares];
  if (piece === 'K' || piece === 'k') {
    const old = squares.indexOf(piece);
    if (old !== -1) squares[old] = '';
  }
  squares[index] = piece;
  return { ...draft, squares, castling: '-', ep: '-', half: '0' };
}
