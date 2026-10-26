'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const express=require('express'),{createServer}=require('node:http');
const {installSpieler}=require('./spieler');
const actor='11111111-1111-4111-8111-111111111111';
const card={fide_id:13404431,name:'Huseynov, Sabir',surname:'Huseynov',federation:'AZE',title:'FM',fide_rating:2379,club:'Bochumer SV 02'};
async function fixture(t,options){const app=express();installSpieler(app,options);const s=createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(async()=>{s.closeAllConnections();await new Promise(r=>s.close(r));});return 'http://127.0.0.1:'+s.address().port+'/api/spieler';}
test('Spieler defaults disabled before identity, database or provider access',async t=>{
 let touched=false;const base=await fixture(t,{client:{rpc(){touched=true;throw Error();}},verifyToken:async()=>{touched=true;}});
 for(const path of ['/search?q=Huseynov','/13404431','/13404431/games?source=lichess&nickname=nick'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await fetch(base+'/13404431/claim',{method:'POST'})).status,404);assert.equal(touched,false);
});
test('surname search/card acceptance, validation and hidden player games fail closed',async t=>{
 const calls=[];const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:args.p_id==='1'?[]:[card]})};}};
 let remote=false;const base=await fixture(t,{enabled:true,client,games:{games:async()=>{remote=true;return {games:[]};}}});
 const found=await (await fetch(base+'/search?q=Huseynov')).json();assert.equal(found.players[0].title,'FM');assert.equal(found.players[0].club,'Bochumer SV 02');assert.equal(found.players[0].fide_rating,2379);
 assert.equal((await fetch(base+'/search?q=a')).status,400);
 assert.equal((await fetch(base+'/1/games?source=lichess&nickname=nick')).status,404);assert.equal(remote,false);
 assert.equal((await fetch(base+'/13404431/games?source=lichess&nickname=https://evil')).status,400);
 assert.equal((await fetch(base+'/13404431/games?source=twic')).status,200);assert.equal(remote,true);
 assert.equal(calls[0].args.p_surname,'Huseynov');
});
test('claim/hide require verified server identity and reject forged ownership/status',async t=>{
 const calls=[];const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:{status:'pending'}})};}};
 const base=await fixture(t,{enabled:true,client,verifyToken:async token=>token==='test-only'?{id:actor}:null});
 assert.equal((await fetch(base+'/13404431/claim',{method:'POST'})).status,401);
 assert.equal((await fetch(base+'/13404431/claim',{method:'POST',headers:{Authorization:'Bearer expired'}})).status,401);
 const headers={Authorization:'Bearer test-only','Content-Type':'application/json'};
 assert.equal((await fetch(base+'/13404431/claim',{method:'POST',headers,body:JSON.stringify({user_id:'other',status:'verified'})})).status,400);
 for(const action of ['claim','hide']){const r=await fetch(base+'/13404431/'+action,{method:'POST',headers,body:'{}'});assert.equal(r.status,200);assert.equal((await r.json()).status,'pending');assert.equal(calls.at(-1).args.p_actor,actor);}
 assert.equal(calls.length,2);
});
test('server limiter bounds anonymous requests and backend diagnostics remain private',async t=>{
 let time=0;const base=await fixture(t,{enabled:true,now:()=>time,client:{rpc:()=>({abortSignal:async()=>({error:{message:'private backend diagnostic'}})})}});
 for(let i=0;i<60;i++){const r=await fetch(base+'/search?q=Huseynov');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private backend diagnostic/);}
 assert.equal((await fetch(base+'/search?q=Huseynov')).status,429);time=61000;assert.equal((await fetch(base+'/search?q=Huseynov')).status,503);
});
