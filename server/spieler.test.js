'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const express=require('express'),{createServer}=require('node:http');
const {installSpieler}=require('./spieler');
const actor='11111111-1111-4111-8111-111111111111';
const card={...require('./test-support/spielerFixture.cjs').acceptance(),club:null};
const headers={Authorization:'Bearer test-only'};
async function fixture(t,options){const app=express();const router=installSpieler(app,{verifyToken:async token=>token==='test-only'?{id:actor}:null,...options});assert.equal(router.get('trust proxy'),1);assert.equal(app.get('trust proxy'),false);const s=createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(async()=>{s.closeAllConnections();await new Promise(r=>s.close(r));});return 'http://127.0.0.1:'+s.address().port+'/api/spieler';}
test('Spieler defaults disabled before identity, database or provider access',async t=>{
 let touched=false;const base=await fixture(t,{client:{rpc(){touched=true;throw Error();}},verifyToken:async()=>{touched=true;}});
 for(const path of ['/search?q=Huseynov','/13404431','/13404431/games?source=lichess&nickname=nick'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await fetch(base+'/13404431/claim',{method:'POST'})).status,404);assert.equal(touched,false);
});
test('surname search/card acceptance, validation and hidden player games fail closed',async t=>{
 const calls=[];const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:args.p_id==='1'?[]:[card]})};}};
 let remote=false;const base=await fixture(t,{enabled:true,client,games:{games:async()=>{remote=true;return {games:[]};}}});
 const found=await (await fetch(base+'/search?q=Huseynov',{headers})).json();assert.equal(found.players[0].title,'FM');assert.equal(found.players[0].club,null);assert.equal(found.players[0].fide_rating,card.fide_rating);assert.equal(found.players[0].source_date,card.source_date);
 assert.equal((await fetch(base+'/search?q=a',{headers})).status,400);
 assert.equal((await fetch(base+'/1/games?source=lichess&nickname=nick',{headers})).status,404);assert.equal(remote,false);
 assert.equal((await fetch(base+'/13404431/games?source=lichess&nickname=https://evil',{headers})).status,400);
 assert.equal((await fetch(base+'/13404431/games?source=twic',{headers})).status,200);assert.equal(remote,true);
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
  const declared=await fetch(base+'/13404431/claim',{method:'POST',headers,body:JSON.stringify({club:'  My voluntary club  '})});
  assert.equal(declared.status,200);assert.equal(calls.at(-1).args.p_club,'My voluntary club');
  assert.equal((await fetch(base+'/13404431/hide',{method:'POST',headers,body:JSON.stringify({club:'Other'})})).status,400);
});
test('server limiter bounds authenticated requests and backend diagnostics remain private',async t=>{
 let time=0;const base=await fixture(t,{enabled:true,now:()=>time,client:{rpc:()=>({abortSignal:async()=>({error:{message:'private backend diagnostic'}})})}});
 for(let i=0;i<60;i++){const r=await fetch(base+'/search?q=Huseynov',{headers});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private backend diagnostic/);}
 assert.equal((await fetch(base+'/search?q=Huseynov',{headers})).status,429);time=61000;assert.equal((await fetch(base+'/search?q=Huseynov',{headers})).status,503);
});

test('all directory reads require a valid Bearer identity before storage/provider access',async t=>{
 let touched=false;const base=await fixture(t,{enabled:true,client:{rpc(){touched=true;throw Error();}},games:{games(){touched=true;throw Error();}},verifyToken:async token=>{if(token==='throwing')throw Error('private verifier');return null;}});
 for(const path of ['/search?q=Huseynov','/13404431','/13404431/games?source=lichess&nickname=nick']){
  for(const auth of [undefined,'Bearer expired','Bearer throwing','Basic invalid','Bearer invalid token']){
   const r=await fetch(base+path,{headers:auth?{Authorization:auth}:undefined});assert.equal(r.status,401);assert.deepEqual(await r.json(),{code:'authentication_required'});
  }
 }
 assert.equal(touched,false);
});
test('one Render hop: two real client IPs have independent anonymous budgets; forged leftmost IP cannot reset one',async t=>{
 const base=await fixture(t,{enabled:true,client:{}});
 const get=xff=>fetch(base+'/search?q=Huseynov',{headers:{'X-Forwarded-For':xff}});
 for(let i=0;i<60;i++)assert.equal((await get('198.51.100.1')).status,401);
 assert.equal((await get('198.51.100.1')).status,429);
 assert.equal((await get('203.0.113.123, 198.51.100.1')).status,429,'ignore a forged additional hop');
 assert.equal((await get('198.51.100.2')).status,401,'second user behind same transport proxy is independent');
});
test('verified account budgets are independent on one IP and survive token/IP rotation',async t=>{
 const base=await fixture(t,{enabled:true,client:{rpc:()=>({abortSignal:async()=>({data:[card]})})},verifyToken:async token=>({id:token==='other-account'?'second-user':actor})});
 const get=(token,ip)=>fetch(base+'/search?q=Huseynov',{headers:{Authorization:'Bearer '+token,'X-Forwarded-For':ip}});
 for(let i=0;i<60;i++)assert.equal((await get('first-token','198.51.100.1')).status,200);
 assert.equal((await get('refreshed-token','198.51.100.2')).status,429);
 assert.equal((await get('other-account','198.51.100.1')).status,200);
});
test('an unverified hide immediately makes search, card and games unavailable',async t=>{
 let hidden=false,providerCalls=0;const client={rpc(name){return {abortSignal:async()=>{
  if(name==='spieler_request'){hidden=true;return {data:{status:'hidden_pending_review'}};}
  return {data:hidden?[]:[card]};
 }}}};
 const base=await fixture(t,{enabled:true,client,games:{games:async()=>{providerCalls++;return {games:[]};}}});
 assert.equal((await fetch(base+'/13404431',{headers})).status,200);
 const hide=await fetch(base+'/13404431/hide',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
 assert.equal(hide.status,200);assert.equal((await hide.json()).status,'hidden_pending_review');
 assert.deepEqual((await (await fetch(base+'/search?q=Huseynov',{headers})).json()).players,[]);
 assert.equal((await fetch(base+'/13404431',{headers})).status,404);
 assert.equal((await fetch(base+'/13404431/games?source=lichess&nickname=nick',{headers})).status,404);assert.equal(providerCalls,0);
});
