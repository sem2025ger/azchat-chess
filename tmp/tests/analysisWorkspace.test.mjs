import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { analysisFromFen, analysisFromPgn, analysisMovePairs, placeDraftPiece, positionDraft, positionDraftFen, validateAnalysisFen } from '../src/utils/analysisWorkspace.ts';
import { loadAnalysisSession, saveAnalysisSession } from '../src/utils/analysisSession.ts';
const BLACK_START = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 17';

test('custom FEN is a navigable root and survives reload after Black makes the first move', () => {
  const session = analysisFromFen(BLACK_START);
  assert.deepEqual(session.positionHistory, [BLACK_START]);
  const move = session.game.move('Kf7');
  const saved = new Map();
  const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  saveAnalysisSession([move.san], 0, storage, BLACK_START);
  const restored = loadAnalysisSession(storage);
  assert.equal(restored.positionHistory[0], BLACK_START);
  assert.equal(restored.game.fen(), session.game.fen());
  assert.equal(restored.viewMoveIndex, 0);
  assert.deepEqual(analysisMovePairs(restored.moveHistory, BLACK_START), [
    { n:17, w:'', b:'Kf7', wIndex:0, bIndex:1, wTime:'--', bTime:'--' },
  ]);
});

test('PGN loads full history, castling, and a FEN-header starting position', () => {
  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *';
  const loaded = analysisFromPgn(pgn);
  const expected = new Chess(); expected.loadPgn(pgn);
  assert.equal(loaded.game.fen(), expected.fen());
  assert.equal(loaded.positionHistory.length, 11);
  assert.equal(loaded.positionHistory[0], DEFAULT_POSITION);
  assert.equal(loaded.moveHistory[8], 'O-O');
  for (const source of [`[SetUp "1"]\n[FEN "${BLACK_START}"]\n17... Kf7 *`, '17... Kf7 *']) {
    const custom = analysisFromPgn(source, BLACK_START);
    assert.equal(custom.positionHistory[0], BLACK_START);
    assert.deepEqual(custom.moveHistory, ['Kf7']);
  }
});

test('invalid and contradictory positions never reach analysis; valid checks and en passant do', () => {
  for (const fen of [
    'bad', '8/8/8/8/8/8/8/8 w - - 0 1',
    '4k3/8/8/8/8/8/8/4K3 w - - 0x 1',
    '4k3/8/8/8/8/8/8/4K3 w - - 0 1x',
    '4k3/8/8/8/8/8/4K3/8 w K - 0 1',
    '8/8/8/8/8/4k3/4K3/8 w - - 0 1',
    '4k3/8/8/8/8/8/8/4K3 b - e3 0 1',
    '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',
  ]) assert.throws(() => validateAnalysisFen(fen));
  assert.doesNotThrow(() => validateAnalysisFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'));
  const game = new Chess(); game.move('e4');
  assert.doesNotThrow(() => validateAnalysisFen(game.fen({ forceEnpassantSquare:true })));
  assert.throws(() => analysisFromPgn('1. e4 e4'));
  assert.throws(() => analysisFromPgn('x'.repeat(250001)));
});

test('editor drafts are isolated, encode empty squares, and move kings rather than duplicate them', () => {
  const draft = positionDraft(DEFAULT_POSITION);
  assert.equal(positionDraftFen(draft), DEFAULT_POSITION);
  const moved = placeDraftPiece(draft, 36, 'K');
  assert.equal(moved.squares.filter(piece => piece === 'K').length, 1);
  assert.equal(draft.squares[60], 'K');
  assert.equal(draft.squares[36], '');
  assert.equal(moved.castling, '-');
  const erased = placeDraftPiece(draft, 52, '');
  assert.equal(erased.squares[52], '');
  assert.equal(draft.squares[52], 'P');
  assert.doesNotThrow(() => validateAnalysisFen(positionDraftFen(erased)));
});

test('normal white-first move rows retain exactly the original history indices', () => {
  const rows = analysisMovePairs(['e4','e5','Nf3'], DEFAULT_POSITION);
  assert.deepEqual(rows.map(row => [row.n,row.w,row.b,row.wIndex,row.bIndex]), [[1,'e4','e5',1,2],[2,'Nf3','',3,0]]);
});

test('custom origins preserve castling, en passant captures and promotion on replay', () => {
  const castled = analysisFromPgn('[SetUp "1"]\n[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n1. O-O *');
  assert.equal(castled.game.get('g1').type, 'k');
  assert.equal(castled.game.get('f1').type, 'r');
  const enPassant = analysisFromPgn('[SetUp "1"]\n[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2"]\n2. exd6 *');
  assert.equal(enPassant.game.get('d5'), undefined);
  assert.equal(enPassant.game.get('d6').color, 'w');
  const promoted = analysisFromPgn('[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n1. a8=Q+ *');
  assert.equal(promoted.game.get('a8').type, 'q');
});
