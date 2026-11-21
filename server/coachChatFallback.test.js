'use strict';
// A plan request must always end in a useful answer: lesson failures are logged with their
// real reason and replaced by one ordinary answer, never shown as "coach unavailable".
const test=require('node:test');
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const {generateAnswer}=require('./aiCoachOpenAI');
const {groundedChat,CHAT_DEADLINE_MS}=require('./aiCoachChat');
const {PositionIndex}=require('./positionIndex');

const fen='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const planQuery={message:'Оцени позицию и предложи план игры за белых.',fen,side:'any',language:'ru'};
const engine={analyze:async()=>({engine:'stockfish-19-lite',budget:{movetimeMs:900},lines:[
 {sanPv:['d3','Nf6','Nc3','h6','h3'],scoreKind:'cp',scoreWhite:12,depth:16,wdlWhite:[300,400,300]},
 {sanPv:['c3','Nf6','d3','d6','O-O'],scoreKind:'cp',scoreWhite:10,depth:16,wdlWhite:[290,410,300]}
]})};
const flags={openaiApiKey:'synthetic-key-123',engine,positionFactsEnabled:true,strategyKnowledgeEnabled:true,planDemoEnabled:true};
const SECRET_QUESTION_TEXT='Оцени позицию';
const reply=(value,extra={})=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}],...extra});
const lesson={intro:'Позиция равная. Белые готовят d4 после h3, который отнимает поле g4 у коня f6.',lineId:'L1',
 conclusion:'В конце линии белые развиты и сохраняют гибкий центр; чёрные отвечают d6.',alternatives:[]};
const plain={answer:'Сильнейший ход по варианту 1 — d3: белые укрепляют e4 и готовят Nc3.'};

// Routes each provider call by the requested schema so a test controls lesson and answer separately.
function provider({plan,answer=()=>reply(plain)}){
 const calls=[];
 const fetchImpl=async(_url,opts)=>{const body=JSON.parse(opts.body);const mode=body.text.format.name==='chessaz_plan_lesson'?'plan':'answer';calls.push({mode,body});return mode==='plan'?plan(opts):answer(opts);};
 return {fetchImpl,calls};
}
function capture(){const lines=[];return {log:line=>lines.push(line),lines,events:()=>lines.map(line=>JSON.parse(line))};}
const timeoutError=()=>Object.assign(new Error('The operation was aborted due to timeout'),{name:'TimeoutError'});

test('every lesson failure is logged with its reason and replaced by one normal answer',async()=>{
 const cases=[
  ['timeout',async()=>{throw timeoutError();}],
  ['incomplete:max_output_tokens',async()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage:{output_tokens:4800},output:[]})],
  ['plan_validation:main_intro_length',async()=>reply({...lesson,intro:'Очень длинное вступление без единой точки '.repeat(30)})],
  ['plan_validation:alternative_line',async()=>reply({...lesson,alternatives:[{lineId:'L9',intro:'Другая линия объяснена.',conclusion:'Итог другой линии.'}]})],
  ['http_500',async()=>new Response('{}',{status:500})],
  ['response_too_large',async()=>new Response('x'.repeat(262145))]
 ];
 for(const [reason,plan] of cases){
  const {fetchImpl,calls}=provider({plan}),sink=capture();
  const out=await groundedChat(null,planQuery,{...flags,fetchImpl,log:sink.log});
  assert.equal(out.answer,plain.answer,reason);
  assert.equal(out.planFallback,true,reason);
  assert.equal(out.planDemonstration,undefined,reason);
  assert.deepEqual(calls.map(c=>c.mode),['plan','answer'],reason+': exactly one fallback call');
  const [event]=sink.events();
  assert.equal(event.event,'coach_chat_provider_failed');
  assert.equal(event.mode,'plan');
  assert.equal(event.reason,reason);
  assert.ok(Number.isFinite(event.elapsedMs));
  if(reason.startsWith('incomplete'))assert.equal(event.outputTokens,4800);
 }
});

test('a successful lesson is returned without a fallback call',async()=>{
 const {fetchImpl,calls}=provider({plan:async()=>reply(lesson)}),sink=capture();
 const out=await groundedChat(null,planQuery,{...flags,fetchImpl,log:sink.log});
 assert.equal(out.planDemonstration.lineId,'L1');
 assert.equal(out.planFallback,undefined);
 assert.deepEqual(calls.map(c=>c.mode),['plan']);
 assert.deepEqual(sink.lines,[]);
});

test('if the fallback also fails, Chessy returns only verified engine lines and logs both failures',async()=>{
 const {fetchImpl,calls}=provider({plan:async()=>{throw timeoutError();},answer:async()=>new Response('{}',{status:502})}),sink=capture();
 const result=await groundedChat(null,planQuery,{...flags,fetchImpl,log:sink.log});
 assert.deepEqual([result.generated,result.provider,result.providerStatus,result.engineVerified],[false,null,'unavailable',true]);
 assert.equal(result.position,fen);
 assert.deepEqual(result.engineLines.map(line=>line.moves[0]),['d3','c3']);
 assert.equal(result.planDemonstration,undefined);
 assert.equal(result.lineLessons,undefined);
 assert.match(result.answer,/ИИ.*Stockfish/);
 assert.deepEqual(calls.map(c=>c.mode),['plan','answer']);
 assert.deepEqual(sink.events().map(e=>[e.mode,e.reason]),[['plan','timeout'],['answer','http_502']]);
});

test('a slow optional archive read is aborted and chat continues without archive claims',async()=>{
 let searchSignal;
 const index=new PositionIndex({page:async()=>[],hidden:async signal=>{
  if(signal){searchSignal=signal;await delay(15000,null,{signal});}
  return new Set();
 }},{log(){}});
 await index.start();
 const {fetchImpl,calls}=provider({plan:async()=>reply(lesson)});
 const result=await groundedChat(index,planQuery,{...flags,fetchImpl});
 assert.equal(searchSignal?.reason?.name,'TimeoutError');
 assert.equal(result.archiveAvailable,false);
 assert.equal(result.matched,null);
 assert.equal(JSON.parse(calls[0].body.input).evidence.archiveAvailable,false);
 assert.equal(result.generated,true);
 assert.equal(result.engineVerified,true);
});

test('log lines contain no key, question, instructions or model text',async()=>{
 const leaked='СЕКРЕТНЫЙ ТЕКСТ МОДЕЛИ '.repeat(40);
 const {fetchImpl}=provider({plan:async()=>reply({...lesson,intro:leaked})}),sink=capture();
 await groundedChat(null,planQuery,{...flags,fetchImpl,log:sink.log});
 const all=sink.lines.join('\n');
 for(const secret of [flags.openaiApiKey,SECRET_QUESTION_TEXT,'СЕКРЕТНЫЙ','ChessAZ','Bearer'])assert.ok(!all.includes(secret),secret);
 assert.deepEqual(Object.keys(sink.events()[0]).sort(),['elapsedMs','event','mode','model','reason']);
});

test('a client that disconnects gets no fallback call and no failure log',async()=>{
 const abort=new AbortController();
 const {fetchImpl,calls}=provider({plan:async()=>{abort.abort();throw Object.assign(new Error('aborted'),{name:'AbortError'});}}),sink=capture();
 await assert.rejects(groundedChat(null,planQuery,{...flags,fetchImpl,signal:abort.signal,log:sink.log}));
 assert.deepEqual(calls.map(c=>c.mode),['plan']);
 assert.deepEqual(sink.lines,[]);
});

test('the chat deadline bounds both calls and leaves time for the fallback',async()=>{
 assert.ok(CHAT_DEADLINE_MS<60000,'the server finishes before the browser gives up');
 let clock=0;const now=()=>clock;
 const {fetchImpl,calls}=provider({plan:async()=>{clock+=30000;throw timeoutError();},answer:async()=>{clock+=5000;return reply(plain);}});
 const out=await groundedChat(null,planQuery,{...flags,fetchImpl,now,log:()=>{}});
 assert.equal(out.planFallback,true);
 assert.equal(calls.length,2);
 // Out of time before the fallback: return the verified lines without another request.
 clock=0;const late=provider({plan:async()=>{clock+=CHAT_DEADLINE_MS;throw timeoutError();}}),sink=capture();
 const partial=await groundedChat(null,planQuery,{...flags,fetchImpl:late.fetchImpl,now,log:sink.log});
 assert.equal(partial.providerStatus,'unavailable');
 assert.equal(partial.generated,false);
 assert.deepEqual(late.calls.map(c=>c.mode),['plan']);
 assert.deepEqual(sink.events().map(e=>[e.mode,e.reason]),[['plan','timeout'],['answer','deadline']]);
});

test('a field slightly over the limit is cut at a sentence end; a much longer one is rejected',async()=>{
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:900},candidateLines:[{id:'L1',moves:['d3'],scoreKind:'cp',scoreWhite:12,depth:16}]};
 const sentence='Белые укрепляют центр и готовят d4. ';
 const slightlyLong=sentence.repeat(Math.ceil(740/sentence.length)).trim(); // 700 < length ≤ 805
 assert.ok(slightlyLong.length>700&&slightlyLong.length<=805);
 const value=await generateAnswer(planQuery,evidence,{apiKey:'k',planDemo:true,fetchImpl:async()=>reply({...lesson,intro:slightlyLong})});
 assert.ok(value.planDemonstration.intro.length<=700);
 assert.ok(value.planDemonstration.intro.endsWith('.'));
 assert.ok(slightlyLong.startsWith(value.planDemonstration.intro));
 await assert.rejects(generateAnswer(planQuery,evidence,{apiKey:'k',planDemo:true,fetchImpl:async()=>reply({...lesson,intro:sentence.repeat(30)})}),e=>e.reason==='plan_validation:main_intro_length');
 // An over-long optional alternative is dropped; the main lesson survives.
 const two={...evidence,candidateLines:[...evidence.candidateLines,{id:'L2',moves:['c3'],scoreKind:'cp',scoreWhite:8,depth:16}]};
 const kept=await generateAnswer(planQuery,two,{apiKey:'k',planDemo:true,fetchImpl:async()=>reply({...lesson,alternatives:[{lineId:'L2',intro:sentence.repeat(30),conclusion:'Итог.'}]})});
 assert.deepEqual(kept.lineLessons.map(l=>l.lineId),['L1']);
});

test('a lesson response larger than 32 KiB is accepted up to the response cap',async()=>{
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:900},candidateLines:[{id:'L1',moves:['d3'],scoreKind:'cp',scoreWhite:12,depth:16}]};
 // The Responses API echoes the full instructions (about 19 KB for a lesson) next to the output.
 const value=await generateAnswer(planQuery,evidence,{apiKey:'k',planDemo:true,fetchImpl:async()=>reply(lesson,{instructions:'i'.repeat(40000)})});
 assert.equal(value.planDemonstration.lineId,'L1');
});
