'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createServer}=require('node:http');const {installVorbereitung}=require('./vorbereitung');
const headers={Authorization:'Bearer valid'};
async function fixture(t,options={}){const app=express();const router=installVorbereitung(app,{verifyToken:async token=>token==='valid'?{id:'actor'}:null,...options});assert.equal(router.get('trust proxy'),1);assert.equal(app.get('trust proxy'),false);const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});return 'http://127.0.0.1:'+server.address().port+'/api/vorbereitung/';}
test('Vorbereitung flag/login before provider, input validation, no-store and private errors',async t=>{
 let calls=0;const provider={preparation:async()=>{calls++;return {nickname:'target',games:[],rejected:0};}};
 const off=await fixture(t,{provider});assert.equal((await fetch(off+'target',{headers})).status,404);assert.equal(calls,0);
 const on=await fixture(t,{enabled:true,provider});for(const auth of [undefined,'Bearer expired'])assert.equal((await fetch(on+'target',{headers:auth?{Authorization:auth}:undefined})).status,401);assert.equal(calls,0);
 for(const path of ['x','target?variation='+('x'.repeat(151)),'target?color=foreign','target?url=https://evil','target?variation=x&variation=y'])assert.equal((await fetch(on+path,{headers})).status,400);
 const good=await fetch(on+'target?variation=B90&color=black&speed=blitz',{headers});assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'no-store');assert.deepEqual((await good.json()).games,[]);assert.equal(calls,1);
});
test('Vorbereitung HTTP 429 exposes Retry-After without retrying or leaking upstream errors',async t=>{
 let calls=0;const base=await fixture(t,{enabled:true,provider:{preparation:async()=>{calls++;throw Object.assign(Error('private diagnostics'),{code:'lichess_rate_limit',retryAfter:60});}}});
 const r=await fetch(base+'target',{headers});assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');assert.deepEqual(await r.json(),{code:'lichess_rate_limit',retryAfter:60});assert.equal(calls,1);
});
test('named Vorbereitung HTTP requires login, validates FIDE/full name and keeps nickname secondary',async t=>{
 const calls=[];const provider={namedPreparation:async query=>{calls.push(query);if(!query.fideId&&query.name==='Surname')throw Object.assign(Error(),{code:'invalid_query'});return {games:[],fideId:query.fideId,candidates:[]};},preparation:async()=>({nickname:'player_name',games:[]})};
 const base=await fixture(t,{enabled:true,provider});assert.equal((await fetch(base+'player?fideId=13404431')).status,401);assert.equal(calls.length,0);
 for(const query of ['fideId=0','fideId=1&fideId=2','name=x&name=y','url=https://evil','name='+('x'.repeat(151))])assert.equal((await fetch(base+'player?'+query,{headers})).status,400);
 assert.equal((await fetch(base+'player?name=Surname',{headers})).status,400);
 const byFide=await fetch(base+'player?fideId=13404431',{headers});assert.equal(byFide.status,200);assert.equal(byFide.headers.get('cache-control'),'no-store');assert.equal((await byFide.json()).fideId,'13404431');
 const byName=await fetch(base+'player?name=Huseynov%2C%20Sabir',{headers});assert.equal(byName.status,200);assert.deepEqual(calls.at(-1),{fideId:null,name:'Huseynov, Sabir'});
 assert.equal((await fetch(base+'player_name',{headers})).status,200);
});
test('Vorbereitung account limit survives token/IP rotation; coarse IP limit runs before verification',async t=>{
 let calls=0;const base=await fixture(t,{enabled:true,provider:{preparation:async()=>({games:[]})},verifyToken:async()=>({id:'same-account'})});
 for(let i=0;i<12;i++)assert.equal((await fetch(base+'target',{headers})).status,200);
 assert.equal((await fetch(base+'target',{headers:{Authorization:'Bearer rotated','X-Forwarded-For':'198.51.100.1'}})).status,429);
 const invalid=await fixture(t,{enabled:true,verifyToken:async()=>{calls++;return null;}});
 for(let i=0;i<121;i++)assert.equal((await fetch(invalid+'target',{headers:{Authorization:'Bearer bad-'+i,'X-Forwarded-For':'198.51.100.2'}})).status,i<120?401:429);
 assert.equal(calls,120);assert.equal((await fetch(invalid+'target',{headers:{...headers,'X-Forwarded-For':'203.0.113.4, 198.51.100.2'}})).status,429);assert.equal(calls,120);
});
