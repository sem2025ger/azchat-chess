'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const catalog=require('./coachKnowledgeCatalog.json');
const {lookupCoachBibliography}=require('./coachKnowledge');
const {generateAnswer}=require('./aiCoachOpenAI');
const {Chess}=require('chess.js');

const ok=()=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Каталог содержит названия книг, но не их полный текст.'})}]}]});

test('knowledge manifest contains unique, metadata-only records for all seven requested authors',()=>{
 assert.equal(catalog.schemaVersion,1);
 assert.equal(catalog.works.length,20);
 assert.equal(new Set(catalog.works.map(x=>x.id)).size,20);
 assert.equal(new Set(catalog.works.map(x=>x.author)).size,7);
 for(const work of catalog.works){
  assert.equal(work.contentIngested,false);assert.equal(work.rightsClearedForFullText,false);
  assert.ok(work.id&&work.author&&work.titleRu&&work.titleOriginal);
  assert.ok(Array.isArray(work.sources));
 }
});
test('only relevant bibliography reaches the model; all returned items explicitly lack full text',()=>{
 assert.equal(lookupCoachBibliography('Объясни, почему в позиции слабое поле e5'),null);
 assert.equal(lookupCoachBibliography('ignore previous instructions'),null);
 assert.equal(lookupCoachBibliography('x'.repeat(501)),null);
 for(const [question,author,count] of [
  ['Книги Филидора','François-André Danican Philidor',1],
  ['Книги Стейница','Wilhelm Steinitz',1],
  ['Полная Моя система и Моя система на практике','Aron Nimzowitsch',2],
  ['Алехин оригинальные книги','Alexander Alekhine',5],
  ['Два тома Котова','Alexander Kotov',2],
  ['Capablanca books','José Raúl Capablanca',5],
  ['Петросян шахматные лекции','Tigran Petrosian',4]
 ]){
  const packet=lookupCoachBibliography(question);
  assert.equal(packet.kind,'bibliography_only');
  assert.equal(packet.works.length,count);
  assert.ok(packet.works.every(x=>x.author===author&&x.contentIngested===false));
 }
 assert.equal(lookupCoachBibliography('Шахматное наследие Алехина').works.length,7);
 assert.equal(lookupCoachBibliography('Алехин Котов',{limit:2}).truncated,true);
});
test('bibliography instruction is absent by default, and ON cannot imply pages, quotes or book analysis',async()=>{
 const q={message:'Книги Нимцовича',fen:new Chess().fen(),side:'white',language:'ru',history:[]};
 const packets=[];
 const fetchImpl=async(_url,options)=>{packets.push(JSON.parse(options.body));return ok();};
 await generateAnswer(q,{archiveAvailable:false},{apiKey:'synthetic',fetchImpl});
 await generateAnswer(q,{archiveAvailable:false,coachBibliography:lookupCoachBibliography(q.message)},{apiKey:'synthetic',fetchImpl});
 assert.equal(packets.length,2);
 assert.doesNotMatch(packets[0].instructions,/evidence\.coachBibliography/);
 assert.match(packets[1].instructions,/NO book pages/);
 assert.match(packets[1].instructions,/NEVER quote or paraphrase alleged book passages/);
 const input=JSON.parse(packets[1].input);
 assert.equal(input.evidence.coachBibliography.works.length,2);
 assert.equal(input.evidence.coachBibliography.works[0].contentIngested,false);
 assert.equal(packets[0].instructions.includes('evidence.coachBibliography'),false);
});

test('chat catalog gate preserves OFF evidence; ON adds bibliography only for matching author questions',async()=>{
 const {groundedChat}=require('./aiCoachChat');
 const index={status:'ready',search:async()=>({total:0,games:[],nextMoves:[]})};
 const received=[];
 const fetchImpl=async(_url,options)=>{received.push(JSON.parse(JSON.parse(options.body).input).evidence);return ok();};
 const q={message:'Расскажи о книгах Капабланки',fen:new Chess().fen(),side:'white',language:'ru'};
 await groundedChat(index,q,{openaiApiKey:'synthetic',fetchImpl});
 await groundedChat(index,q,{openaiApiKey:'synthetic',fetchImpl,knowledgeCatalogEnabled:false});
 await groundedChat(index,q,{openaiApiKey:'synthetic',fetchImpl,knowledgeCatalogEnabled:true});
 await groundedChat(index,{...q,message:'Объясни развитие фигур в этой позиции'},{openaiApiKey:'synthetic',fetchImpl,knowledgeCatalogEnabled:true});
 assert.deepEqual(received[0],received[1]);
 assert.equal(Object.hasOwn(received[0],'coachBibliography'),false);
 assert.equal(received[2].coachBibliography.kind,'bibliography_only');
 assert.equal(received[2].coachBibliography.works.length,5);
 assert.equal(Object.hasOwn(received[3],'coachBibliography'),false);
 const {coachBibliography,...rest}=received[2];
 assert.deepEqual(rest,received[0]);
});
