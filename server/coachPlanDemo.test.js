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
const lesson={intro:'Позиция равная. План белых — развить фигуры и подготовить борьбу за центр.',lineId:'L1',conclusion:'В показанной позиции белые развили коня, а чёрные отвечают симметрично; решающего преимущества нет.'};
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
 assert.deepEqual(request.text.format.schema.properties.lineId.enum,['none','L1','L2']);
 assert.match(request.instructions,/interface renders intro/);
 assert.match(request.instructions,/ACTUAL moves/);
 assert.deepEqual(value,{answer:lesson.intro+'\n'+lesson.conclusion,planDemonstration:{lineId:'L1',intro:lesson.intro,conclusion:lesson.conclusion}});
 assert.equal(JSON.parse(request.input).evidence.candidateLines[0].moves.join(' '),'e4 e5 Nf3 Nc6');
});

test('none option is an honest plain-text answer without a fictitious board illustration',async()=>{
 const evidence={candidateOrigin:'server_stockfish_19',engine:{name:'stockfish-19-lite',budgetMs:900},candidateLines:[{id:'L1',moves:['e4'],scoreKind:'cp',scoreWhite:0,depth:16}]};
 const choice={...lesson,lineId:'none',conclusion:'Эта короткая линия не подтверждает дальнейший стратегический план.'};
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
