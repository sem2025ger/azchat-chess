'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {isPlanRequest}=require('./coachPlanDemo');
const {generateAnswer}=require('./aiCoachOpenAI');
const {groundedChat}=require('./aiCoachChat');

const fen=new Chess().fen();
const query={message:'Оцени позицию и предложи план игры за белых.',fen,side:'any',language:'ru'};
const verifiedEngine={analyze:async()=>({engine:'stockfish-19-lite',budget:{movetimeMs:900},lines:[
 {sanPv:['e4','e5','Nf3','Nc6'],scoreKind:'cp',scoreWhite:12,depth:16,wdlWhite:[300,400,300]},
 {sanPv:['d4','d5','c4','e6'],scoreKind:'cp',scoreWhite:10,depth:16,wdlWhite:[290,410,300]}
]})};
const lesson={intro:'Позиция равная. План белых — развить фигуры и подготовить борьбу за центр.',lineId:'L1',conclusion:'В показанной позиции белые развили коня, а чёрные отвечают симметрично; решающего преимущества нет.',alternatives:[{lineId:'L2',intro:'Белые занимают центр пешками и предлагают размен на c4.',conclusion:'В центре возникает напряжение между пешками c4 и d5; чёрные поддерживают центр ходом e6.'}]};
const singleLesson={...lesson,alternatives:[]};
const mockReply=value=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('illustrated plan selection recognizes all six localized plan buttons, not unrelated chat',()=>{
 for(const text of [
  'Assess the position and suggest a plan for White.',
  'Bewerte die Stellung und schlage einen Spielplan für Schwarz vor.',
  'Оцени позицию и предложи план игры за белых.',
  'Mövqeni qiymətləndir və ağlar üçün oyun planı təklif et.',
  'Konumu değerlendir ve Beyaz için bir oyun planı öner.',
  'Оціни позицію і запропонуй план гри за чорних.'
 ])assert.equal(isPlanRequest(text),true,text);
 for(const text of ['Show me three games.','What is 2+2?','Find the game Lasker - Capablanca'])assert.equal(isPlanRequest(text),false,text);
});

test('opt-in structured plan keeps its engine line ID and has valid bounded output',async()=>{
 let request=null;
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:900,perspective:'white'},candidateLines:[
  {id:'L1',moves:['e4','e5','Nf3','Nc6'],scoreKind:'cp',scoreWhite:12,depth:16},
  {id:'L2',moves:['d4','d5','c4','e6'],scoreKind:'cp',scoreWhite:10,depth:16}
 ]};
 const value=await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl:async(_url,opts)=>{request=JSON.parse(opts.body);return mockReply(lesson);}});
 assert.equal(request.text.format.name,'chessaz_plan_lesson');
 assert.equal(request.reasoning.effort,'low','lessons default to low effort so they fit the chat deadline');
 assert.match(request.instructions,/every intro at most 650 characters and every conclusion at most 420 characters/);
 assert.equal(request.max_output_tokens,4800);
 assert.deepEqual(request.text.format.schema.properties.lineId.enum,['none','L1','L2']);
 assert.match(request.instructions,/interface renders intro/);
 assert.match(request.instructions,/ACTUAL moves/);
 assert.deepEqual(value,{answer:lesson.intro+'\n'+lesson.conclusion,planDemonstration:{lineId:'L1',intro:lesson.intro,conclusion:lesson.conclusion},lineLessons:[{lineId:'L1',intro:lesson.intro,conclusion:lesson.conclusion},...lesson.alternatives]});
 assert.equal(JSON.parse(request.input).evidence.candidateLines[0].moves.join(' '),'e4 e5 Nf3 Nc6');
 await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,planReasoning:'medium',fetchImpl:async(_url,opts)=>{request=JSON.parse(opts.body);return mockReply(lesson);}});
 assert.equal(request.reasoning.effort,'medium','AI_COACH_PLAN_REASONING=medium is honoured');
});

test('none option is an honest plain-text answer without a fictitious board illustration',async()=>{
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:900},candidateLines:[{id:'L1',moves:['e4'],scoreKind:'cp',scoreWhite:0,depth:16}]};
 const choice={...singleLesson,lineId:'none',conclusion:'Эта короткая линия не подтверждает дальнейший стратегический план.'};
 const value=await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl:async()=>mockReply(choice)});
 assert.equal(value.planDemonstration,undefined);
 assert.equal(value.answer,choice.intro+'\n'+choice.conclusion);
 for(const invalid of [{...lesson,lineId:'L3'},{...lesson,intro:'x'},{...lesson,conclusion:'https://wrong.example'}]){
  await assert.rejects(generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl:async()=>mockReply(invalid)}),/provider_unavailable/);
 }
});

test('server sends a lesson only when independently verified Stockfish lines and flag exist',async()=>{
 const packets=[];
 const fetchImpl=async(_url,opts)=>{
  const body=JSON.parse(opts.body);packets.push(body);
  return mockReply(body.text.format.name==='chessaz_plan_lesson'?lesson:{answer:'Оценка равная. Для белых полезно развить фигуры.'});
 };
 const opts={openaiApiKey:'synthetic',fetchImpl,engine:verifiedEngine,positionFactsEnabled:true,strategyKnowledgeEnabled:true};
 const off=await groundedChat(null,query,opts);
 const on=await groundedChat(null,query,{...opts,planDemoEnabled:true});
 assert.equal(off.planDemonstration,undefined);
 const withoutStrategy=await groundedChat(null,query,{...opts,planDemoEnabled:true,strategyKnowledgeEnabled:false});
 const withoutFacts=await groundedChat(null,query,{...opts,planDemoEnabled:true,positionFactsEnabled:false});
 assert.equal(withoutStrategy.planDemonstration,undefined);
 assert.equal(withoutFacts.planDemonstration,undefined);
 assert.equal(on.engineVerified,true);
 assert.equal(on.planDemonstration.lineId,'L1');
 assert.equal(on.answer,lesson.intro+'\n'+lesson.conclusion);
 assert.equal(on.position,fen);
 assert.equal(on.engineLines[0].moves.join(' '),'e4 e5 Nf3 Nc6');
 assert.equal(JSON.stringify(on).includes('endFacts'),false,'server evidence never leaks in browser result');
 assert.equal(packets[0].text.format.name,'chessaz_coach_answer');
 assert.equal(packets[1].text.format.name,'chessaz_plan_lesson');
 assert.equal(packets[1].instructions.includes('historically_informed_heuristic'),false,'model must not get spurious author claims');
 const noEngine=await groundedChat(null,query,{openaiApiKey:'synthetic',fetchImpl,planDemoEnabled:true});
 assert.equal(noEngine.engineVerified,false);
 assert.equal(noEngine.planDemonstration,undefined);
 const noPlan=await groundedChat(null,{...query,message:'Объясни ход Nf3'},{...opts,planDemoEnabled:true});
 assert.equal(noPlan.planDemonstration,undefined);
});

test('both instruction modes reject invented compensation and an unresolved line cannot be chosen for a plan',async()=>{
 const line={id:'L1',moves:['e4'],scoreKind:'cp',scoreWhite:0,depth:16,endFacts:{unsettled:false}};
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:900},positionFacts:{},candidateLines:[line]};
 for(const planDemo of [false,true])await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo,fetchImpl:async(_url,opts)=>{
  const body=JSON.parse(opts.body);
  assert.ok(!body.instructions.includes('compensation, which may be temporary or lasting'));
  assert.match(body.instructions,/give no plan or material conclusion for that line/);
  assert.match(body.instructions,/lineEndFacts preserves the original endpoint/);
  if(planDemo)assert.match(body.instructions,/do not select its lineId/);
  return mockReply(planDemo?singleLesson:{answer:'Verified QA fixture.'});
 }});
 await generateAnswer(query,{...evidence,candidateLines:[{...line,endFacts:{unsettled:true}}]},{apiKey:'synthetic',planDemo:true,fetchImpl:async(_url,opts)=>{
  assert.equal(JSON.parse(opts.body).text.format.name,'chessaz_coach_answer');
  return mockReply({answer:'Обмен не завершён в показанном варианте.'});
 }});
});

test('lessons are unique and bound to eligible lines in one provider request; alternatives are optional',async()=>{
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:6000},candidateLines:[{id:'L1',moves:['e4']},{id:'L2',moves:['d4']},{id:'L3',moves:['c4'],endFacts:{unsettled:true}}]};
 let calls=0;
 const fetchImpl=async(_url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.match(body.instructions,/causal chain/);assert.match(body.instructions,/recapture is an intermediate step/);assert.deepEqual(body.text.format.schema.properties.alternatives.items.properties.lineId.enum,['L1','L2']);return mockReply(lesson);};
 const result=await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl});
 assert.equal(calls,1);assert.deepEqual(result.lineLessons.map(l=>l.lineId),['L1','L2']);
 assert.notEqual(result.lineLessons[0].conclusion,result.lineLessons[1].conclusion);
 // A complete main lesson without alternatives is a valid lesson, never an error for the player.
 const mainOnly=await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl:async()=>mockReply({...lesson,alternatives:[]})});
 assert.deepEqual(mainOnly.lineLessons.map(l=>l.lineId),['L1']);
 for(const alternatives of [[lesson.alternatives[0],lesson.alternatives[0]],[{...lesson.alternatives[0],lineId:'L3'}]])await assert.rejects(generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl:async()=>mockReply({...lesson,alternatives})}),/provider_unavailable/);
});

test('diagnostic: requested model input and exact raw answer survive across three chess positions',async()=>{
 const italian='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
 const fools=new Chess();for(const move of ['f3','e5','g4'])fools.move(move);
 const cases=[
  {fen:italian,moves:['Nc3','Nf6','d3','h6','Bb3','a5','Nxe5','Nxe5','d4','Bd6'],score:10},
  {fen:new Chess().fen(),moves:['e4','e5','Nf3','Nc6'],score:0},
  {fen:fools.fen(),moves:['Qh4#'],score:null}
 ];
 for(const [i,fixture] of cases.entries()){
  const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:6000},candidateLines:[
   {id:'L1',moves:fixture.moves,scoreKind:fixture.score===null?'mate':'cp',scoreWhite:fixture.score,depth:16}
  ]};
  const original='Проверка '+(i+1)+': оценка зависит от точной позиции.\nПлан объясняется конкретными ходами и ответом соперника; результат не подменяется общим советом.';
  let providerCalls=0;
  const output=await generateAnswer({...query,fen:fixture.fen},evidence,{apiKey:'synthetic',fetchImpl:async(_url,options)=>{
   providerCalls++;
   const request=JSON.parse(options.body),input=JSON.parse(request.input);
   assert.equal(input.position,fixture.fen);
   assert.deepEqual(input.evidence.candidateLines[0].moves,fixture.moves);
   assert.match(request.instructions,/real chess argument rather than a generic three-sentence summary/);
   assert.match(request.instructions,/opponent's key resource/);
   return mockReply({answer:original});
  }});
  assert.equal(providerCalls,1);
  assert.equal(output,original,'provider response text must not be summarized or truncated by the server adapter');
 }
});

test('diagnostic: chat distinguishes model response from archive fallback without rewriting analysis',async()=>{
 const exact='Оценка равная.\nПлан белых — подготовить e4, чёрные отвечают ...e5.\nВариант показан без домыслов.';
 const syntheticIndex={status:'ready',search:async()=>({total:0,games:[],nextMoves:[]})};
 const model=await groundedChat(syntheticIndex,query,{openaiApiKey:'synthetic',fetchImpl:async()=>mockReply({answer:exact})});
 assert.equal(model.answer,exact);
 assert.equal(model.generated,true);
 assert.equal(model.provider,'openai');
 assert.equal(model.providerStatus,'ready');
 const fallback=await groundedChat(syntheticIndex,query);
 assert.equal(fallback.generated,false);
 assert.equal(fallback.provider,null);
 assert.equal(fallback.providerStatus,'not_configured');
 assert.notEqual(fallback.answer,exact);
});

test('illustrated mode requests separate explanations of alternative verified lines, not conflicting single-line instructions',async()=>{
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:6000},candidateLines:[
  {id:'L1',moves:['e4','e5'],scoreKind:'cp',scoreWhite:5,depth:16},
  {id:'L2',moves:['d4','d5'],scoreKind:'cp',scoreWhite:0,depth:16}
 ]};
 await generateAnswer(query,evidence,{apiKey:'synthetic',planDemo:true,fetchImpl:async(_url,options)=>{
  const request=JSON.parse(options.body);
  assert.match(request.instructions,/roughly three to five purposeful sentences/);
  assert.match(request.instructions,/each other eligible line independently in alternatives/);
  assert.doesNotMatch(request.instructions,/Explain only the one verified line that supports the illustrated plan/);
  assert.match(request.instructions,/two or three concise sentences within the field limit/);
  assert.deepEqual(request.text.format.schema.properties.alternatives.items.properties.lineId.enum,['L1','L2']);
  return mockReply(lesson);
 }});
});

test('[real] Italian lesson carries the recapture AND subsequent play through facts, schema and line-bound lessons',async()=>{
 const {createCoachEngine}=require('./coachEngine');
 const root='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
 const engine=createCoachEngine({movetimeMs:6000,log:()=>{}});let providerCalls=0,chosenId;
 try{
  const result=await groundedChat(null,{...query,fen:root},{engine,openaiApiKey:'synthetic',positionFactsEnabled:true,strategyKnowledgeEnabled:true,planDemoEnabled:true,fetchImpl:async(_url,opts)=>{
   providerCalls++;const body=JSON.parse(opts.body),input=JSON.parse(body.input);
   assert.equal(input.position,root);assert.equal(body.text.format.name,'chessaz_plan_lesson');
   const line=input.evidence.candidateLines.find(l=>l.moves.join(' ')==='Nc3 Nf6 d3 h6 Bb3 a5 Nxe5 Nxe5 d4 Bd6');
   assert.ok(line,'the pinned depth-16 engine must cover the owner regression');chosenId=line.id;
   assert.deepEqual(line.continuation.moves.slice(0,2),['dxe5','Bxe5']);
   assert.ok(line.continuation.moves.length>2,'the lesson continues after material restoration');
   assert.equal(line.continuation.source,'root_pv');assert.equal(line.endFacts.unsettled,false);
   assert.ok(line.endFacts.moveMechanisms.blockedPawnSteps.some(item=>item.move==='4. Nc3'&&item.pawn==='c2'&&item.blockedSquare==='c3'));
   assert.deepEqual(line.endFacts.moveMechanisms.pawnControls.find(item=>item.move==='8. d4').squares,['c5','e5']);
   assert.match(body.instructions,/freedSquaresUsed/);
   assert.equal(line.lineEndFacts.material.balanceWhite,-2);assert.equal(line.endFacts.material.balanceWhite,0);
   const board=new Chess(root);for(const san of [...line.moves,...line.continuation.moves])board.move(san,{strict:true});
   assert.equal(board.fen(),line.endFacts.fen);
   const primary={lineId:line.id,intro:'Белые временно отдают коня ради пешечной вилки на d4, после чего отыгрывают фигуру и активизируют ферзя.',conclusion:'Материал восстановлен. Ферзь d3 поддерживает e4, но у чёрных остаётся давление коня f6 на эту пешку; существенного преимущества вариант не показывает.'};
   const alternatives=input.evidence.candidateLines.filter(l=>l.id!==line.id&&!l.endFacts.unsettled).map(l=>({lineId:l.id,intro:'Отдельный синтетический разбор другой линии.',conclusion:'Вывод относится только к конечной позиции этой линии.'}));
   return mockReply({...primary,alternatives});
  }});
  assert.equal(providerCalls,1);assert.equal(result.planDemonstration.lineId,chosenId);
  assert.equal(result.lineLessons.length,3);assert.equal(result.engineLines.find(l=>l.id===chosenId).continuation.moves[0],'dxe5');
 }finally{engine.close();}
});
