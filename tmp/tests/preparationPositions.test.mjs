import test from 'node:test';import assert from 'node:assert/strict';import {Chess,DEFAULT_POSITION} from 'chess.js';
import {preparationMoves,preparationPositionKey,indexPreparationGames,searchPreparationPosition} from '../src/utils/preparationPositions.ts';
import {validateAnalysisFen} from '../src/utils/analysisWorkspace.ts';import {openSpielerAnalysis} from '../src/services/spieler.ts';import {loadAnalysisSession} from '../src/utils/analysisSession.ts';
const pgn=moves=>'[White "Target"]\n[Black "Guest"]\n[Result "1-0"]\n\n'+moves+' 1-0';
const game=(id,moves,color='white')=>({id,pgn:pgn(moves),color,result:'1-0',speed:'classical',timeControl:'5400+30',opening:'King’s Indian',eco:'E60',white:'Target',black:'Guest',date:'2026.09.01'});
test('German notation and SAN reach the same legal position; transpositions match positions rather than strings',()=>{
 assert.equal(preparationMoves('1.e4 c5 2.Sf3 d6 3.d4').fen,preparationMoves('1.e4 c5 2.Nf3 d6 3.d4').fen);
 const a='1. Nf3 d5 2. g3 Nf6 3. Bg2',b='1. g3 Nf6 2. Nf3 d5 3. Bg2';
 const fen=preparationMoves('1.Sf3 d5 2.g3 Sf6').fen;const indexed=indexPreparationGames([game('a',a),game('b',b),game('c','1. e4 e5 2. Nf3 Nc6')]);
 const found=searchPreparationPosition(indexed.index,fen);assert.equal(found.hits.length,2);assert.deepEqual(found.nextMoves.map(m=>[m.san,m.games,m.percent]),[['Bg2',2,100]]);
 const next=new Chess(fen);next.move(found.nextMoves[0].san);assert.equal(searchPreparationPosition(indexed.index,next.fen()).hits.length,2);
 assert.equal(searchPreparationPosition(indexed.index,fen,{color:'black'}).hits.length,0);assert.throws(()=>preparationMoves('1.e4 e5 2.Ke4'));
});
test('exact FEN setup: valid position, counter-independent identity, castling matters and illegal positions rejected',()=>{
 const fen=preparationMoves('1.d4 d5 2.c4 e6').fen;assert.equal(preparationPositionKey(fen),preparationPositionKey(fen.replace(/\d+ \d+$/,'7 19')));
 assert.notEqual(preparationPositionKey(DEFAULT_POSITION),preparationPositionKey(DEFAULT_POSITION.replace('KQkq','-')));
 assert.ok(validateAnalysisFen('8/8/8/8/8/8/4K3/7k w - - 0 1'));
 for(const invalid of ['8/8/8/8/8/8/8/8 w - - 0 1','8/8/8/8/8/8/4K3/4k3 w - - 0 1','4k3/8/8/8/8/8/8/P3K3 w - - 0 1','not fen'])assert.throws(()=>preparationPositionKey(invalid));
 const indexed=indexPreparationGames([game('a','1. d4 d5 2. c4 e6 3. Nc3')]);assert.equal(searchPreparationPosition(indexed.index,fen).hits.length,1);
});
test('analysis handoff opens at matched ply and retains full game, including root position',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};const source=pgn('1. e4 c5 2. Nf3 d6 3. d4');
 openSpielerAnalysis(source,storage,4);const restored=loadAnalysisSession(storage);assert.equal(restored.viewMoveIndex,4);assert.deepEqual(restored.moveHistory,['e4','c5','Nf3','d6','d4']);assert.equal(restored.positionHistory[4],preparationMoves('1.e4 c5 2.Sf3 d6').fen);
 openSpielerAnalysis(source,storage,0);assert.equal(loadAnalysisSession(storage).viewMoveIndex,0);assert.throws(()=>openSpielerAnalysis(source,storage,99));
});
