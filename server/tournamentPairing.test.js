'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {computeStandings,pairSwiss}=require('./tournamentPairing');
const players=n=>Array.from({length:n},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),rating:1200+i*7}));
const flatten=p=>p.pairs.flatMap(x=>[x.whiteId,x.blackId]).concat(p.byeId?[p.byeId]:[]);
test('Swiss pairs are deterministic, exactly once, no self pair at all supported sizes',()=>{
 for(const n of [2,3,4,5,7,8,16,32,64]){
   const p=players(n), a=pairSwiss(p,[],1), b=pairSwiss(p,[],1);
   assert.deepEqual(a,b);
   const ids=flatten(a);assert.equal(ids.length,n);assert.equal(new Set(ids).size,n);
   assert.equal(a.byeId!==null,n%2!==0);
   assert.equal(a.rematches,0);
 }
});
test('Swiss avoids rematches when alternatives exist and rotates byes',()=>{
 const p=players(5),one=pairSwiss(p,[],1);
 const games=one.pairs.map(x=>({...x,result:'1-0'}));
 games.push({whiteId:one.byeId,blackId:null,result:'bye'});
 const two=pairSwiss(p,games,2);
 assert.notEqual(one.byeId,two.byeId);
 assert.equal(two.rematches,0);
 const seen=new Set(games.filter(x=>x.blackId).map(x=>[x.whiteId,x.blackId].sort().join(':')));
 for(const pair of two.pairs)assert.ok(!seen.has([pair.whiteId,pair.blackId].sort().join(':')));
});
test('draw scores and Sonneborn/Buchholz reflect only trusted completed games',()=>{
 const p=players(4),g=[
 {whiteId:p[0].id,blackId:p[1].id,result:'1-0'},
 {whiteId:p[2].id,blackId:p[3].id,result:'1/2-1/2'},
 {whiteId:p[0].id,blackId:p[2].id,result:'1/2-1/2'},
 ];
 const ranked=computeStandings(p,g),byId=new Map(ranked.map(x=>[x.id,x]));
 assert.equal(byId.get(p[0].id).points,1.5);
 assert.equal(byId.get(p[2].id).points,1);
 assert.equal(byId.get(p[1].id).points,0);
 assert.equal(byId.get(p[0].id).wins,1);
 assert.ok(byId.get(p[0].id).buchholz>=0);
});
test('reject fabricated results, duplicated users and invalid round',()=>{
 const p=players(2);
 assert.throws(()=>pairSwiss(p,[],0),/invalid_round/);
 assert.throws(()=>computeStandings([p[0],p[0]]),/invalid_player/);
 assert.throws(()=>computeStandings(p,[{whiteId:p[0].id,blackId:p[0].id,result:'1-0'}]),/invalid_game/);
 assert.throws(()=>computeStandings(p,[{whiteId:p[0].id,blackId:p[1].id,result:'forged'}]),/invalid_result/);
});
