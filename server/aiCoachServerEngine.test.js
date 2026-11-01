'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess}=require('chess.js');
const {groundedChat}=require('./aiCoachChat');
const {installAiCoach,engineFromEnv,engineMovetimeFromEnv}=require('./aiCoach');

const fen='rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const clientLines=[{moves:['d6','d4']},{moves:['e6','d4']}];
const query={message:'Какой план у белых?',fen,side:'white',language:'ru',candidateLines:clientLines};
const index={status:'ready',search:async()=>({total:0,games:[],nextMoves:[]})};
const serverAnalysis={fen,engine:'stockfish-19-lite',nnue:'nn-61e7af4bb97d.nnue',budget:{movetimeMs:900,multiPv:3,hashMb:16},lines:[
 {multipv:1,depth:15,scoreKind:'cp',scoreWhite:43,bound:null,wdlWhite:[95,902,3],uciPv:['b8c6','d2d4'],sanPv:['Nc6','d4']},
 {multipv:2,depth:15,scoreKind:'cp',scoreWhite:44,bound:null,wdlWhite:[96,901,3],uciPv:['g7g6','c2c3'],sanPv:['g6','c3']}
]};
const fakeEngine=(impl)=>{const calls=[];return {calls,analyze:async(value,options)=>{calls.push({value,options});return impl(value);}};};
function capture(answer='Чёрные развивают коня.'){
 const seen={};
 return {seen,fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);seen.instructions=body.instructions;seen.input=JSON.parse(body.input);
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer})}]}]});}};
}

test('flag off: client-line provenance preserved and learner side is not inferred',async()=>{
 const start={...query,fen:new Chess().fen(),message:'Plan?',candidateLines:undefined};
 const {seen,fetchImpl}=capture();
 const response=await groundedChat(index,start,{openaiApiKey:'k',fetchImpl});
 assert.match(seen.instructions,/archiveFilterSide is only a database filter/);
 assert.equal(seen.input.archiveFilterSide,'white');
 assert.equal(seen.input.requestedSide,undefined);
 assert.equal(response.engineVerified,false);
 assert.ok(!('engineLines'in response)&&!('engineError'in response));
 assert.equal(seen.input.evidence.candidateOrigin,'untrusted_client_legality_checked');
});

test('flag on: model receives server lines with White-perspective scores; client lines are not evidence',async()=>{
 const engine=fakeEngine(async()=>serverAnalysis),{seen,fetchImpl}=capture();
 const response=await groundedChat(index,query,{openaiApiKey:'k',fetchImpl,engine});
 assert.equal(engine.calls.length,1);assert.equal(engine.calls[0].value,fen);
 const ev=seen.input.evidence;
 assert.equal(ev.candidateOrigin,'server_stockfish_19');
 assert.deepEqual(ev.engine,{name:'stockfish-19-lite',budgetMs:900,perspective:'white'});
 assert.deepEqual(ev.candidateLines,[
  {id:'L1',moves:['Nc6','d4'],scoreKind:'cp',scoreWhite:43,depth:15,wdlWhite:[95,902,3]},
  {id:'L2',moves:['g6','c3'],scoreKind:'cp',scoreWhite:44,depth:15,wdlWhite:[96,901,3]}]);
 assert.ok(!JSON.stringify(ev).includes('"d6"'),'client lines never reach the model as evidence');
 for(const rule of ['Never invent a variation','Never claim a repetition','White\'s point of view','only from these exact lines'])assert.ok(seen.instructions.includes(rule),rule);
 for(const legacy of ['illustrative','received from the browser','cannot independently authenticate'])assert.ok(!seen.instructions.includes(legacy),legacy);
 assert.equal(response.engineVerified,true);
 assert.deepEqual(response.candidateLines,clientLines,'UI-rendered client lines are echoed unchanged');
 assert.deepEqual(response.engineLines.map(l=>l.id),['L1','L2']);
});

test('flag on: engine failure falls back to the legacy path and reports a stable code',async()=>{
 for(const code of ['engine_busy','engine_timeout','engine_unavailable']){
  const engine=fakeEngine(async()=>{throw Object.assign(Error(code),{code});}),{seen,fetchImpl}=capture();
  const response=await groundedChat(index,query,{openaiApiKey:'k',fetchImpl,engine});
  assert.equal(seen.input.evidence.candidateOrigin,'untrusted_client_legality_checked');
  assert.deepEqual(seen.input.evidence.candidateLines,clientLines);
  assert.ok(seen.instructions.includes('received from the browser'));
  assert.equal(response.engineVerified,false);assert.equal(response.engineError,code);assert.ok(!('engineLines'in response));
 }
 const empty=fakeEngine(async()=>({...serverAnalysis,lines:[]}));
 assert.equal((await groundedChat(index,query,{openaiApiKey:'k',fetchImpl:capture().fetchImpl,engine:empty})).engineError,'engine_unavailable');
});

test('flag on: explicit archive game requests never start an engine search',async()=>{
 const engine=fakeEngine(async()=>serverAnalysis);
 const response=await groundedChat(index,{...query,message:'Найди 3 партии'},{openaiApiKey:'k',fetchImpl:capture().fetchImpl,engine});
 assert.equal(engine.calls.length,0);assert.equal(response.archiveOnly,true);assert.ok(!('engineError'in response));
});

test('flag on: the request abort signal is passed to the engine',async()=>{
 const engine=fakeEngine(async()=>serverAnalysis),abort=new AbortController();
 await groundedChat(index,query,{openaiApiKey:'k',fetchImpl:capture().fetchImpl,engine,signal:abort.signal});
 assert.equal(engine.calls[0].options.signal,abort.signal);
});

test('environment: server engine is off unless both coach flags are exactly true',()=>{
 assert.equal(engineFromEnv({}),null);
 assert.equal(engineFromEnv({AI_COACH_ENABLED:'true'}),null);
 assert.equal(engineFromEnv({AI_COACH_ENABLED:'false',AI_COACH_SERVER_ENGINE_ENABLED:'true'}),null);
 assert.equal(engineFromEnv({AI_COACH_ENABLED:'true',AI_COACH_SERVER_ENGINE_ENABLED:'1'}),null);
 const engine=engineFromEnv({AI_COACH_ENABLED:'true',AI_COACH_SERVER_ENGINE_ENABLED:'true'});
 assert.equal(typeof engine.analyze,'function');
 assert.equal(engine.status().started,false,'engine starts lazily, not at boot');
 engine.close();
});

test('HTTP chat route forwards the configured engine',async()=>{
 const engine=fakeEngine(async()=>serverAnalysis),{fetchImpl}=capture(),app=express();
 installAiCoach(app,{enabled:true,index,verifyToken:async t=>t==='ok'?{id:'u'}:null,openaiApiKey:'k',fetchImpl,engine});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/ai-coach/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer ok'},body:JSON.stringify(query)});
  assert.equal(res.status,200);const body=await res.json();assert.equal(body.engineVerified,true);assert.equal(engine.calls.length,1);
 }finally{await new Promise(r=>server.close(r));}
});

test('engine movetime comes from a validated setting: default 900, range 300–3000',()=>{
 const warnings=[];const read=(raw)=>engineMovetimeFromEnv(raw===undefined?{}:{AI_COACH_ENGINE_MOVETIME_MS:raw},(e)=>warnings.push(e));
 assert.equal(read(undefined),900);assert.equal(read(''),900);
 for(const [raw,ms] of [['300',300],['900',900],['2000',2000],['3000',3000]])assert.equal(read(raw),ms,raw);
 assert.equal(warnings.length,0);
 for(const raw of ['299','3001','0','-500','1500.5','2e3',' 2000','2000ms','abc','99999'])assert.equal(read(raw),900,raw);
 assert.equal(warnings.length,10);
 assert.deepEqual(warnings[0],{event:'coach_engine_config_invalid',setting:'AI_COACH_ENGINE_MOVETIME_MS',used:900});
 const engine=engineFromEnv({AI_COACH_ENABLED:'true',AI_COACH_SERVER_ENGINE_ENABLED:'true',AI_COACH_ENGINE_MOVETIME_MS:'2000'});
 assert.equal(engine.status().budget.movetimeMs,2000);engine.close();
 const fallback=engineFromEnv({AI_COACH_ENABLED:'true',AI_COACH_SERVER_ENGINE_ENABLED:'true'});
 assert.equal(fallback.status().budget.movetimeMs,900);fallback.close();
 assert.equal(engineFromEnv({AI_COACH_ENGINE_MOVETIME_MS:'2000'}),null,'setting alone never enables the engine');
});
