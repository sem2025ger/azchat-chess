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
