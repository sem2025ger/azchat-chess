import test from 'node:test';
import assert from 'node:assert/strict';
import {readPositionSearchState,writePositionSearchState,clearPositionSearchState,positionSearchRevision} from '../src/utils/positionSearchState.ts';
test('account and workspace snapshots are isolated, bounded, optional and cleared on logout',()=>{
 const values=new Map();globalThis.sessionStorage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 try{
  writePositionSearchState('one',{fen:'board'});writePositionSearchState('one',{draft:'question'},'chat');writePositionSearchState('one',{moves:'e4'},'preparation');writePositionSearchState('two',{draft:'other'},'chat');
  assert.deepEqual(readPositionSearchState('one'),{fen:'board'});assert.deepEqual(readPositionSearchState('one','chat'),{draft:'question'});assert.deepEqual(readPositionSearchState('two','chat'),{draft:'other'});assert.equal(readPositionSearchState('unknown','chat'),null);
  writePositionSearchState('oversized',{text:'x'.repeat(1024*1024)},'chat');assert.equal(readPositionSearchState('oversized','chat'),null);
  values.set('chessaz:position-search:v1:bad:chat','broken JSON');assert.equal(readPositionSearchState('bad','chat'),null);values.set('unrelated','keep');const oldRevision=positionSearchRevision();clearPositionSearchState();writePositionSearchState('one',{draft:'late effect'},'chat',oldRevision);assert.deepEqual([...values.entries()],[['unrelated','keep']]);
  globalThis.sessionStorage={getItem(){throw Error('storage blocked');},setItem(){throw Error('quota');},get length(){throw Error('storage blocked');}};assert.equal(readPositionSearchState('one','chat'),null);assert.doesNotThrow(()=>writePositionSearchState('one',{},'chat'));assert.doesNotThrow(clearPositionSearchState);
 }finally{delete globalThis.sessionStorage;}
});
