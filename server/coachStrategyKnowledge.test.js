'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const bank=require('./coachStrategicPrinciples.json');
const {selectStrategyKnowledge}=require('./coachStrategyKnowledge');
const {positionFacts}=require('./coachPositionFacts');
const {groundedChat}=require('./aiCoachChat');
const {generateAnswer}=require('./aiCoachOpenAI');

const answer=()=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Оценка требует проверки; план должен иметь конкретную цель.'})}]}]});

test('sourced pilot contains four historical authors and no book copies',()=>{
 assert.equal(bank.kind,'position_conditioned_original_strategy_cues');
 assert.equal(bank.status,'pilot_not_full_books');
 assert.equal(bank.entries.length,12);
 assert.equal(new Set(bank.entries.map(x=>x.id)).size,12);
 assert.deepEqual(new Set(bank.entries.map(x=>x.author)),new Set(bank.authors));
 for(const e of bank.entries){
  assert.ok(e.sourceUrl.startsWith('https://'));
  assert.ok(e.work&&e.idea&&e.goal&&e.condition&&e.basis);
  assert.ok(!Object.hasOwn(e,'fullText')&&!Object.hasOwn(e,'originalAnnotation'));
 }
});

test('selection requires server facts, enforces bounds and never returns book passages',()=>{
 assert.equal(selectStrategyKnowledge(null),null);
 assert.equal(selectStrategyKnowledge({}),null);
 assert.equal(selectStrategyKnowledge({white:{},black:{}},{limit:0}),null);
 assert.equal(selectStrategyKnowledge({white:{},black:{}},{limit:9}),null);
 const facts=positionFacts(new Chess().fen());
 const selected=selectStrategyKnowledge(facts,{limit:8});
 assert.equal(selected.kind,'strategy_cues');
 assert.equal(selected.fullTextIngested,false);
 assert.ok(selected.items.length<=8);
 assert.ok(selected.items.some(x=>x.author==='Emanuel Lasker'));
 for(const item of selected.items){
  assert.ok(['white','black'].includes(item.side));
  assert.ok(item.positionEvidence.length>0);
  assert.equal(item.status,'historically_informed_heuristic_not_engine_verified');
  assert.ok(!Object.hasOwn(item,'moves')&&!Object.hasOwn(item,'score'));
 }
});

test('position-specific selector identifies Nimzowitsch blockade and Alekhine pawn conversion without asserting moves',()=>{
 const fen='4k3/8/8/4P3/8/8/4K3/8 w - - 0 1';
 const selected=selectStrategyKnowledge(positionFacts(fen),{limit:8});
 assert.ok(selected?.items.some(x=>x.id==='nimzowitsch-blockade'&&x.side==='black'&&x.positionEvidence.includes('e5')));
 assert.ok(selected?.items.some(x=>x.id==='alekhine-conversion'&&x.side==='white'&&x.positionEvidence.includes('e5')));
 assert.ok(selected.items.every(x=>!('engineVerified' in x)||x.engineVerified===false));
});

test('legacy context stays exactly unchanged with positional facts off; on adds sourced cues separately',async()=>{
 const fen=new Chess().fen(),question={message:'Оцени позицию и предложи план за белых',fen,side:'any',language:'ru'};
 const index={status:'ready',search:async()=>({total:0,games:[],nextMoves:[]})};
 const packets=[],fetchImpl=async(_url,options)=>{packets.push(JSON.parse(options.body));return answer();};
 await groundedChat(index,question,{openaiApiKey:'synthetic',fetchImpl});
 await groundedChat(index,question,{openaiApiKey:'synthetic',fetchImpl,positionFactsEnabled:true,strategyKnowledgeEnabled:true});
 await groundedChat(index,question,{openaiApiKey:'synthetic',fetchImpl,positionFactsEnabled:true});
 await groundedChat(index,question,{openaiApiKey:'synthetic',fetchImpl,strategyKnowledgeEnabled:true});
 const before=JSON.parse(packets[0].input).evidence,after=JSON.parse(packets[1].input).evidence;
 assert.equal(Object.hasOwn(before,'positionFacts'),false);
 assert.equal(Object.hasOwn(before,'strategyKnowledge'),false);
 assert.ok(after.positionFacts&&after.strategyKnowledge);
 assert.equal(after.strategyKnowledge.kind,'strategy_cues');
 assert.equal(after.coachBibliography,undefined);
 const factsOnly=JSON.parse(packets[2].input).evidence;
 assert.ok(factsOnly.positionFacts);
 assert.equal(Object.hasOwn(factsOnly,'strategyKnowledge'),false);
 assert.deepEqual(JSON.parse(packets[3].input).evidence,before);
 assert.doesNotMatch(packets[0].instructions,/evidence.strategyKnowledge is a server-curated/);
 assert.match(packets[1].instructions,/evidence.strategyKnowledge is a server-curated/);
 assert.match(packets[1].instructions,/MUST NOT be stated as an explicit rule written by that author/);
 const {positionFacts:ignored,strategyKnowledge:ignore,...rest}=after;
 assert.deepEqual(rest,before);
});

test('curated cues do not alter engine lines, numerical scores or source identity',async()=>{
 const fen=new Chess().fen(),lesson=selectStrategyKnowledge(positionFacts(fen));
 const q={message:'Как играть белыми?',fen,side:'any',language:'ru'};
 const evidence={positionFacts:positionFacts(fen),strategyKnowledge:lesson,engine:{name:'stockfish-19-lite',budgetMs:900},candidateOrigin:'server_stockfish_19',candidateLines:[{id:'L1',moves:['e4','e5'],scoreKind:'cp',scoreWhite:0,depth:9}]};
 let supplied=null;
 await generateAnswer(q,evidence,{apiKey:'synthetic',fetchImpl:async(_url,options)=>{supplied=JSON.parse(options.body);return answer();}});
 const received=JSON.parse(supplied.input).evidence;
 assert.deepEqual(received,evidence);
 assert.match(supplied.instructions,/fallible teaching heuristics only/);
 assert.match(supplied.instructions,/prefer supplied Stockfish moves/);
});
