import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {coachVariationFen} from '../src/utils/coachVariation.ts';

test('coach replay visits every legal SAN without mutating root position',()=>{
 const root=new Chess().fen(),moves=['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6'];
 const target=new Chess();
 assert.equal(coachVariationFen(root,moves,0),root);
 for(let i=0;i<moves.length;i++){
  target.move(moves[i]);
  assert.equal(coachVariationFen(root,moves,i+1),target.fen());
 }
 assert.equal(coachVariationFen(root,moves,0),root);
});
test('coach replay accepts a non-start FEN and black-to-move, rejects bad lines',()=>{
 const board=new Chess();board.move('e4');const root=board.fen();board.move('c5');
 assert.equal(coachVariationFen(root,['c5'],1),board.fen());
 for(const line of [['e4'],['c5','c5'],Array(11).fill('c5'),[]])assert.equal(coachVariationFen(root,line,1),null);
 for(const ply of [-1,1.5,2])assert.equal(coachVariationFen(root,['c5'],ply),null);
});

test('coach replay traverses the Italian continuation after the original ten-ply boundary',()=>{
 const root='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
 const moves='Nc3 Nf6 d3 h6 Bb3 a5 Nxe5 Nxe5 d4 Bd6 dxe5 Bxe5'.split(' '),board=new Chess(root);
 for(let n=0;n<moves.length;n++){
  board.move(moves[n],{strict:true});
  assert.equal(coachVariationFen(root,moves,n+1),board.fen());
 }
 const cycle=Array.from({length:5},()=>['Nf3','Nf6','Ng1','Ng8']).flat();
 assert.ok(coachVariationFen(new Chess().fen(),cycle.slice(0,16),16));
 assert.equal(coachVariationFen(new Chess().fen(),cycle.slice(0,17),17),null,'17 legal plies exceed the replay cap');
});
