import test from 'node:test';
import assert from 'node:assert/strict';
import {playerOutcome} from '../src/components/schachTreff/playerOutcome.ts';

test('player card result is from the card owner perspective',()=>{
 for(const [color,whiteWin,blackWin] of [['w','win','loss'],['b','loss','win']]){
  assert.equal(playerOutcome('1-0',color),whiteWin);
  assert.equal(playerOutcome('0-1',color),blackWin);
  for(const draw of ['1/2-1/2','½-½'])assert.equal(playerOutcome(draw,color),'draw');
  for(const raw of ['*','unknown',''])assert.equal(playerOutcome(raw,color),null);
 }
 for(const color of [undefined,null,'x'])for(const score of ['1-0','0-1','1/2-1/2','½-½'])assert.equal(playerOutcome(score,color),null);
});
