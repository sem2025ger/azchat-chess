import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {serverEngineLines,formatEngineScore} from '../src/utils/engineLines.ts';

const start=new Chess().fen();
const sicilian='rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';

test('server engine lines are re-validated from the exact FEN',()=>{
 const lines=serverEngineLines([
  {id:'L1',moves:['Nc6','d4'],scoreKind:'cp',scoreWhite:43,depth:15,wdlWhite:[95,902,3]},
  {id:'L2',moves:['g6','c3'],scoreKind:'cp',scoreWhite:44,depth:15,wdlWhite:[96,901,3]}
 ],sicilian);
 assert.deepEqual(lines,[{moves:['Nc6','d4'],score:{kind:'cp',white:43}},{moves:['g6','c3'],score:{kind:'cp',white:44}}]);
});

test('malformed, foreign-position or oversized engine lines are rejected as a whole',()=>{
 const ok={moves:['e4'],scoreKind:'cp',scoreWhite:20};
 for(const value of [
  undefined,null,[],{},'L1',
  [ok,ok,ok,ok],
  [{...ok,moves:[]}],
  [{...ok,moves:Array(11).fill('Nf3')}],
  [{...ok,moves:['Nc6']}],                 // Black move from a White-to-move position
  [{...ok,moves:['e4','e4']}],
  [{...ok,moves:[42]}],
  [{...ok,scoreKind:'wdl'}],
  [{...ok,scoreWhite:'20'}],
  [{...ok,scoreWhite:0.5}],
  [{...ok,scoreWhite:Infinity}],
  [{...ok,scoreKind:'mate',scoreWhite:0}],
  [ok,{...ok,moves:['e5']}]                // one bad line rejects all
 ])assert.equal(serverEngineLines(value,start),null,JSON.stringify(value));
});

test('evaluations are formatted from White\'s point of view',()=>{
 assert.equal(formatEngineScore({kind:'cp',white:43}),'+0.43');
 assert.equal(formatEngineScore({kind:'cp',white:-125}),'−1.25');
 assert.equal(formatEngineScore({kind:'cp',white:0}),'0.00');
 assert.equal(formatEngineScore({kind:'mate',white:1}),'#1');
 assert.equal(formatEngineScore({kind:'mate',white:-3}),'#−3');
});
