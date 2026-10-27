'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const express=require('express'),{createServer}=require('node:http');
const {installSpieltag,userClientFactory}=require('./spieltag');
const {createClient}=require('@supabase/supabase-js');
const actor='11111111-1111-4111-8111-111111111111',team='22222222-2222-4222-8222-222222222222';
const match='33333333-3333-4333-8333-333333333333';
const headers={Authorization:'Bearer test-only','Content-Type':'application/json'};
const schedule={round_label:'Runde 1',opponent_name:'Gastmannschaft',starts_at:'2026-11-08T10:00:00Z',venue:'Bochum',notes:''};
function database(result={data:[]}){
 const calls=[];return {calls,from(table){const call={table};calls.push(call);const q={};for(const method of ['select','insert','update','delete','eq','order','limit'])q[method]=(...args)=>{(call[method]??=[]).push(args);return q;};q.abortSignal=async()=>result;return q;}};
}
async function fixture(t,options={}){
 const app=express(),router=installSpieltag(app,{verifyToken:async token=>token==='test-only'?{id:actor}:null,...options});
 assert.equal(router.get('trust proxy'),1);assert.equal(app.get('trust proxy'),false);
 const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 return 'http://127.0.0.1:'+server.address().port+'/api/spieltag';
}
test('Spieltag defaults off before verification or storage; all enabled endpoints require valid Bearer',async t=>{
 let touched=0;const disabled=await fixture(t,{verifyToken:async()=>{touched++;},clientForToken:()=>{touched++;}});
 assert.equal((await fetch(disabled+'/teams',{headers})).status,404);assert.equal(touched,0);
 const enabled=await fixture(t,{enabled:true,clientForToken:()=>{touched++;}});
 for(const [path,method]of [['/teams','GET'],['/clubs','GET'],['/teams/'+team+'/matches','GET'],['/matches/'+match+'/boards','GET'],['/teams/'+team+'/matches','POST'],['/matches/'+match,'PATCH'],['/matches/'+match+'/boards/1','POST']]){
  for(const auth of [undefined,'Bearer invalid'])assert.equal((await fetch(enabled+path,{method,headers:auth?{Authorization:auth}:undefined})).status,401);
 }
 assert.equal(touched,0);
});
test('Spieltag uses request-scoped user JWT client, never service-role fallback, and no server sessions',async()=>{
 assert.equal(userClientFactory({SUPABASE_URL:'https://qa.example',SUPABASE_SERVICE_KEY:'must-not-use'}),null);
 const calls=[],factory=userClientFactory({SUPABASE_URL:'https://qa.example',SUPABASE_ANON_KEY:'public-test-key'},(...args)=>{calls.push(args);return {marker:calls.length};});
 assert.notEqual(factory('token-a'),factory('token-b'));
 assert.equal(await calls[0][2].accessToken(),'token-a');assert.equal(await calls[1][2].accessToken(),'token-b');
 assert.equal(calls[0][1],'public-test-key');assert.equal(calls[0][2].auth.persistSession,false);
 // Real supabase-js wire request must carry the user JWT, not the key.
 let wire;
 const clientFactory=userClientFactory({SUPABASE_URL:'https://qa.example',SUPABASE_ANON_KEY:'public-test-key'},(url,key,options)=>createClient(url,key,{...options,global:{fetch:async(url,options)=>{wire={url,options};return new Response('[]',{headers:{'content-type':'application/json'}});}}}));
 const client=clientFactory('verified-user-token');
 await client.from('spieltag_teams').select('id');
 assert.equal(new Headers(wire.options.headers).get('authorization'),'Bearer verified-user-token');
 assert.equal(new Headers(wire.options.headers).get('apikey'),'public-test-key');
});
test('Spieltag binds database writes to verified actor and route identifiers, rejecting forged fields',async t=>{
 const db=database({data:[{id:match}]}),tokens=[];const base=await fixture(t,{enabled:true,clientForToken:token=>{tokens.push(token);return db;}});
 const post=(path,data,method='POST')=>fetch(base+path,{method,headers,body:JSON.stringify(data)});
 const good=await post('/teams/'+team+'/matches',schedule);assert.equal(good.status,201);assert.equal(good.headers.get('cache-control'),'no-store');
 assert.equal(db.calls[0].insert[0][0].created_by,actor);assert.equal(db.calls[0].insert[0][0].team_id,team);assert.deepEqual(tokens,['test-only']);
 for(const data of [{...schedule,created_by:'forged'},{...schedule,team_id:team},{...schedule,starts_at:'not-a-date'},{...schedule,notes:'x'.repeat(1001)},{...schedule,opponent_club_id:'bad'}])assert.equal((await post('/teams/'+team+'/matches',data)).status,400);
 const board={home_name:'Own player',opponent_name:'Opponent',opponent_fide_id:'13404431',result:'1/2-1/2'};
 assert.equal((await post('/matches/'+match+'/boards/1',board)).status,201);
 assert.equal((await post('/matches/'+match+'/boards/1',{...board,result:'2-0'})).status,400);
 assert.equal((await post('/matches/'+match+'/boards/33',board)).status,400);
 assert.equal((await post('/matches/'+match+'/boards/1',{...board,match_id:match})).status,400);
 assert.equal((await post('/matches/'+match,schedule,'PATCH')).status,200);
 assert.equal(db.calls.at(-1).update[0][0].updated_by,actor);
});
test('Spieltag preserves RLS denial, empty foreign updates and private storage diagnostics',async t=>{
 for(const [result,status,code]of [[{error:{code:'42501',message:'private sql'}},403,'not_allowed'],[{data:[]},404,'not_found'],[{error:{code:'23503'}},400,'invalid_input'],[{error:{code:'23505'}},409,'already_exists'],[{error:{code:'XX000',message:'private sql'}},503,'temporarily_unavailable']]){
  const base=await fixture(t,{enabled:true,clientForToken:()=>database(result)});
  const r=await fetch(base+'/matches/'+match,{method:'PATCH',headers,body:JSON.stringify(schedule)});
  assert.equal(r.status,status);assert.deepEqual(await r.json(),{code});
 }
});
test('Vorbereitung board nickname attachment is separately gated and strictly allowlisted, RLS errors preserved',async t=>{
 const db=database({data:[{match_id:match,board_number:1,opponent_lichess_username:'target'}]});
 const disabled=await fixture(t,{enabled:true,clientForToken:()=>db});
 const send=(base,value)=>fetch(base+'/matches/'+match+'/boards/1/lichess',{method:'PATCH',headers,body:JSON.stringify(value)});
 assert.equal((await send(disabled,{username:'target'})).status,404);assert.equal(db.calls.length,0);
 const enabled=await fixture(t,{enabled:true,preparationEnabled:true,clientForToken:()=>db});
 assert.equal((await send(enabled,{username:'TARGET'})).status,200);assert.equal(db.calls[0].update[0][0].opponent_lichess_username,'target');
 for(const value of [{username:'https://evil'},{username:'target',verified:true},{username:'target',user_id:actor},{}])assert.equal((await send(enabled,value)).status,400);
 assert.equal((await send(enabled,{username:null})).status,200);assert.equal(db.calls.at(-1).update[0][0].opponent_lichess_username,null);
 const denied=await fixture(t,{enabled:true,preparationEnabled:true,clientForToken:()=>database({error:{code:'42501'}})});
 assert.equal((await send(denied,{username:'target'})).status,403);
});
test('Spieltag bounds invalid-token verification before auth and account budgets across token/IP rotation',async t=>{
 let calls=0;const base=await fixture(t,{enabled:true,verifyToken:async()=>{calls++;return null;},clientForToken:()=>database()});
 for(let i=0;i<121;i++)assert.equal((await fetch(base+'/teams',{headers:{Authorization:'Bearer rotated-'+i,'X-Forwarded-For':'198.51.100.7'}})).status,i<120?401:429);
 assert.equal(calls,120);assert.equal((await fetch(base+'/teams',{headers:{...headers,'X-Forwarded-For':'203.0.113.2, 198.51.100.7'}})).status,429);assert.equal(calls,120);
 const valid=await fixture(t,{enabled:true,verifyToken:async()=>({id:actor}),clientForToken:()=>database()});
 for(let i=0;i<60;i++)assert.equal((await fetch(valid+'/teams',{headers})).status,200);
 assert.equal((await fetch(valid+'/teams',{headers:{...headers,Authorization:'Bearer new-token','X-Forwarded-For':'198.51.100.8'}})).status,429);
});
