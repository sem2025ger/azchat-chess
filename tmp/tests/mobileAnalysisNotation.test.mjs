import test from 'node:test';
import assert from 'node:assert/strict';
import { colorizeAnalysisMoves, formatPlayedMoves } from '../src/utils/mobileAnalysisNotation.ts';

test('copies all actual played moves with no evaluation, FEN or Stockfish lines', () => {
  assert.equal(formatPlayedMoves([{n:1,w:'e4',b:'e5'}, {n:2,w:'Nf3',b:'Nc6'}, {n:3,w:'Bb5',b:''}]),
    '1. e4 e5 2. Nf3 Nc6 3. Bb5');
  assert.equal(formatPlayedMoves([]), '');
  assert.equal(formatPlayedMoves([{n:17,w:'',b:'Kf7'}, {n:18,w:'Qh5+',b:'Ke7'}]),
    '17... Kf7 18. Qh5+ Ke7');
});

test('PV SAN figurines use actual alternate sides without treating move numbers as moves', () => {
  assert.deepEqual(colorizeAnalysisMoves(['17...', 'Nf6','18.','Qh5+', 'O-O'], 'b'),
    [{move:'17...',side:null},{move:'Nf6',side:'b'},{move:'18.',side:null},
     {move:'Qh5+',side:'w'},{move:'O-O',side:'b'}]);
  assert.deepEqual(colorizeAnalysisMoves(['1.', 'e4','e5','2.','Nf3','Nc6'], 'w').map(x=>x.side),
    [null,'w','b',null,'w','b']);
});
