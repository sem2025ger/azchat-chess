'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {registerClubChallenges}=require('./clubChallenges');
const ids={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',c:'33333333-3333-4333-8333-333333333333',club:'44444444-4444-4444-8444-444444444444',offer:'55555555-5555-4555-8555-555555555555'};
function fixture({offline=false,startFails=false,limited=false}={}) {
 const listeners={},updates=[],calls=[]; let accepted=false,starts=0;
 const creator={connected:true,data:{userId:ids.a},emit(){}},socket={connected:true,data:{userId:ids.b,limiter:{allow:()=>!limited}},on:(name,fn)=>{listeners[name]=fn;},emit(){}};
 const query=(data,error=null)=>({abortSignal(){return Promise.resolve({data,error});}});
 const client={rpc(name,args){calls.push(args);if(args.p_action==='accept'){if(accepted)return query({ok:false,code:'already_taken'});accepted=true;}return query({ok:true,challenge:{id:ids.offer,club_id:ids.club,created_by:ids.a,time_control:'3+2'}});},from(table){let values;return {select(){return this;},update(v){values=v;return this;},eq(){return this;},abortSignal(){if(values)updates.push(values);return Promise.resolve({data:table==='chess_club_members'?[{user_id:ids.a},{user_id:ids.b}]:null,error:null});}};}};
 const io={sockets:{sockets:new Map([['b',socket],...offline?[]:[['a',creator]]])}};
 registerClubChallenges(socket,{client,io,allowedTimeControls:new Set(['3+2','5+0','10+0']),async startGame(){starts++;if(startFails)throw Object.assign(new Error(),{reason:'player_unavailable'});return ids.club;}});
 const send=(event,payload)=>new Promise(resolve=>listeners['club_challenge_'+event](payload,resolve));
 return {send,updates,calls,starts:()=>starts};
}
test('concurrent accepts have exactly one game start; identity comes from authenticated socket',async()=>{
 const f=fixture();const replies=await Promise.all([f.send('accept',{challengeId:ids.offer,userId:ids.c}),f.send('accept',{challengeId:ids.offer,userId:ids.c})]);
 assert.equal(replies.filter(x=>x.ok).length,1);assert.equal(f.starts(),1);assert.ok(f.calls.every(x=>x.p_actor===ids.b));assert.ok(f.updates.some(x=>x.room_id===ids.club));
});
test('offline creator and failed existing-game start expire the accepted offer',async()=>{
 for(const config of [{offline:true},{startFails:true}]){const f=fixture(config);const r=await f.send('accept',{challengeId:ids.offer});assert.equal(r.ok,false);assert.equal(r.reason,config.offline?'creator_offline':'player_unavailable');assert.deepEqual(f.updates,[{status:'expired'}]);}
});
test('time controls, payloads and existing socket rate limit fail before DB access',async()=>{
 const f=fixture();for(const timeControl of ['1+0','3+0','15+10',null]){const r=await f.send('create',{clubId:ids.club,timeControl});assert.equal(r.reason,'invalid_time_control');}
 assert.equal((await f.send('accept',{challengeId:'not-an-id'})).reason,'not_allowed');assert.equal(f.calls.length,0);
 const limited=fixture({limited:true});assert.equal((await limited.send('create',{clubId:ids.club,timeControl:'3+2'})).reason,'rate_limit_exceeded');assert.equal(limited.calls.length,0);
});
