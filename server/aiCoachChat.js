'use strict';
const {Chess,validateFen}=require('chess.js');
const {LANGUAGE_CODES,safeGame}=require('./aiCoachCore');
const {generateAnswer}=require('./aiCoachOpenAI');
const {positionFacts}=require('./coachPositionFacts');
const {lineFacts,settlement}=require('./coachLineFacts');
const {lookupCoachBibliography}=require('./coachKnowledge');
const {selectStrategyKnowledge}=require('./coachStrategyKnowledge');
const {isPlanRequest}=require('./coachPlanDemo');

const fallback={
 de:(total)=>'In dieser Stellung wurden '+total+' öffentliche Partien gefunden. Du kannst die Beispiele unten in der Analyse öffnen.',
 en:(total)=>'Found '+total+' public games in this position. Open the examples below in Analysis.',
 ru:(total)=>'В этой позиции найдено '+total+' публичных партий. Открой примеры ниже в разделе анализа.',
 az:(total)=>'Bu mövqedə '+total+' açıq partiya tapıldı. Nümunələri aşağıda təhlildə aç.',
 tr:(total)=>'Bu konumda '+total+' herkese açık parti bulundu. Örnekleri aşağıda analizde açabilirsin.',
 uk:(total)=>'У цій позиції знайдено '+total+' відкритих партій. Переглянь приклади нижче в аналізі.'
};
function normalizeLanguage(language){return language==='ua'?'uk':language;}
const gameHeadings={
 de:'In Partien kamen folgende Fortsetzungen vor:',
 en:'These continuations occurred in games:',
 ru:'В партиях встречались такие продолжения:',
 az:'Partiyalarda belə davamlar oynanılıb:',
 tr:'Partilerde şu devam yolları oynandı:',
 uk:'У партіях зустрічалися такі продовження:'
};
const numberWords={одну:1,один:1,одна:1,две:2,два:2,дві:2,три:3,четыре:4,чотири:4,пять:5,"п'ять":5,шесть:6,семь:7,восемь:8,девять:9,десять:10,three:3,two:2,one:1,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,drei:3,zwei:2,ein:1,vier:4,"fünf":5,"üç":3,iki:2,bir:1,"dört":4,"beş":5};
function gameRequest(message){
 const value=message.toLowerCase();
 if(!/(?:парт(?:ии|ий|ию|ия|ій|ії)|part(?:ien|ies|y|i)|games?|oyun|partiya)/iu.test(value)||!/(?:найд|покаж|подбер|да[йй]|знайд|покаж|find|show|list|suche|zeig|finde|göster|bul|tap|göstər|göstər)/iu.test(value))return null;
 const number=value.match(/\b([1-9]|1[0-9]|20)\b/u);
 const word=value.match(/[\p{L}']+/gu)?.find(w=>Object.prototype.hasOwnProperty.call(numberWords,w));
 const count=number?Number(number[1]):word?numberWords[word]:null;
 return count===null?null:Math.max(1,Math.min(20,count));
}

// Client-submitted variations are untrusted hints. Rebuild every move from the exact FEN
// with chess.js before passing any SAN to the language model; do not accept engine scores.
function legalCandidateLines(lines,fen){
 if(lines===undefined)return [];
 if(!Array.isArray(lines)||lines.length<1||lines.length>3)return null;
 const normalized=[],seen=new Set();
 for(const line of lines){
  if(!line||typeof line!=='object'||Array.isArray(line)||Object.keys(line).some(k=>k!=='moves')||!Array.isArray(line.moves)||line.moves.length<1||line.moves.length>10)return null;
  const board=new Chess(fen),moves=[];
  for(const text of line.moves){
   if(typeof text!=='string'||text.length<2||text.length>16)return null;
   try{moves.push(board.move(text,{strict:true}).san);}catch{return null;}
  }
  const id=moves.join(' ');
  if(seen.has(id))return null;seen.add(id);
  normalized.push({moves});
 }
 return normalized;
}
function validChatQuery(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['message','fen','side','language','history','candidateLines'].includes(k)))return false;
 if(typeof value.message!=='string'||value.message.trim().length<2||value.message.length>500)return false;
 if(typeof value.fen!=='string'||value.fen.length>200||!validateFen(value.fen).ok)return false;
 if(!['white','black','any'].includes(value.side)||!LANGUAGE_CODES.has(value.language))return false;
 if(value.history!==undefined&&(!Array.isArray(value.history)||value.history.length>8||value.history.some(item=>!item||typeof item!=='object'||Object.keys(item).some(k=>!['role','text'].includes(k))||!['user','assistant'].includes(item.role)||typeof item.text!=='string'||item.text.length<1||item.text.length>1200)))return false;
 try{new Chess(value.fen);if(legalCandidateLines(value.candidateLines,value.fen)===null)return false;}catch{return false;}
 return true;
}
function publicChatGames(result,fen,count=5){
 return (result.games||[]).slice(0,count).flatMap(record=>{
  const game=safeGame(record,{fen});
  return game?[{id:game.id,white:game.white,black:game.black,result:game.result,ply:game.ply,pgn:game.pgn,date:game.date||null}]:[];
 });
}
// Server-verified engine evidence (flag-gated). The engine result replaces client lines as
// model evidence; client lines stay in the response because the current UI renders them.
function serverEngineLines(analysis){
 return analysis.lines.map((line,i)=>({id:'L'+(i+1),moves:line.sanPv,scoreKind:line.scoreKind,scoreWhite:line.scoreWhite,depth:line.depth,wdlWhite:line.wdlWhite,...(typeof line.unsettled==='boolean'?{unsettled:line.unsettled}:{}),...(line.continuation?{continuation:line.continuation}:{})}));
}
// Only server-verified Stockfish lines may receive deterministic end-position facts.
// End facts are model evidence, never exposed in the browser-facing response.
function withLineEndFacts(lines,fen){
 return lines.map(line=>{
  try{
   if(!Array.isArray(line.moves)||line.moves.length===0||line.moves.length>10)return line;
   const factsFor=(moves,score)=>{
    const board=new Chess(fen);for(const san of moves)board.move(san,{strict:true});
    const finalFen=board.fen(),facts=positionFacts(finalFen);
    if(!facts)return null;
    return {fen:finalFen,plies:moves.length,material:facts.material,majorities:facts.majorities,
     white:{pawns:facts.white.pawns,king:facts.white.king,minorityAttack:facts.white.strategy.minorityAttack,files:facts.white.files,outposts:facts.white.outposts,strategy:facts.white.strategy,pieces:board.board().flat().filter(p=>p?.color==='w').map(({type,square})=>({type,square}))},
     black:{pawns:facts.black.pawns,king:facts.black.king,minorityAttack:facts.black.strategy.minorityAttack,files:facts.black.files,outposts:facts.black.outposts,strategy:facts.black.strategy,pieces:board.board().flat().filter(p=>p?.color==='b').map(({type,square})=>({type,square}))},
     ...lineFacts(fen,moves,score),unsettled:settlement(fen,moves,score).unsettled};
   };
   const original=factsFor(line.moves,line);if(!original)return line;
   if(!line.continuation)return {...line,endFacts:original};
   const c=line.continuation;
   if(!Array.isArray(c.moves)||!c.moves.length||c.moves.length>6)return {...line,endFacts:{...original,unsettled:true}};
   const score={scoreKind:c.evalWhite===null?'mate':'cp',scoreWhite:c.evalWhite===null?null:c.evalWhite*100};
   const endFacts=factsFor([...line.moves,...c.moves],score);
   return {...line,lineEndFacts:original,endFacts:{...endFacts,unsettled:c.settled!==true||endFacts.unsettled}};
  }catch{return line;} // A corrupt SAN cannot compromise the chat request.
 });
}
async function groundedChat(index,query,{openaiApiKey=null,openaiModel='gpt-6-sol',fetchImpl=fetch,signal,engine=null,positionFactsEnabled=false,knowledgeCatalogEnabled=false,strategyKnowledgeEnabled=false,planDemoEnabled=false}={}){
 const requested=gameRequest(query.message);
 let result=null,analysis=null,engineError=null;
 const engineRun=engine&&!requested?engine.analyze(query.fen,{signal}).then(value=>{analysis=value.lines.length?value:null;if(!analysis)engineError='engine_unavailable';},e=>{engineError=e.code||'engine_unavailable';}):null;
 // Search rechecks both players' opt-outs. Never query private/personal games.
 if(index?.status==='ready')try{result=await index.search({fen:query.fen,side:query.side,scope:'all',sort:'strongest',limit:requested??5});}catch{ /* General teaching can continue without archive claims. */ }
 if(!result&&!openaiApiKey)throw Object.assign(Error('index_unavailable'),{code:index?.status==='warming'?'index_warming':'index_unavailable'});
 if(engineRun)await engineRun;
 const games=result?publicChatGames(result,query.fen,requested??5):[],language=normalizeLanguage(query.language);
 const clientLines=legalCandidateLines(query.candidateLines,query.fen)||[];
 const currentFacts=positionFactsEnabled?positionFacts(query.fen):null;
 const strategyKnowledge=positionFactsEnabled&&strategyKnowledgeEnabled&&currentFacts?selectStrategyKnowledge(currentFacts):null;
 const evidence={archiveAvailable:!!result,matched:result?.total??null,
  ...(analysis?{candidateLines:positionFactsEnabled?withLineEndFacts(serverEngineLines(analysis),query.fen):serverEngineLines(analysis),candidateOrigin:'server_stockfish_19',engine:{name:analysis.engine,budgetMs:analysis.budget.movetimeMs,perspective:'white'}}:{candidateLines:clientLines,candidateOrigin:'untrusted_client_legality_checked'}),
  nextMoves:(result?.nextMoves||[]).slice(0,8).map(x=>({move:x.move,count:x.count})),
  games:games.map(({white,black,result,date,ply,pgn})=>{const board=new Chess();board.loadPgn(pgn);return {white,black,result,date,hasPgn:true,matchedPly:ply,continuation:board.history().slice(ply,ply+6)};}),
  ...(positionFactsEnabled?{positionFacts:currentFacts}:{}),
  ...(strategyKnowledge?{strategyKnowledge}:{}),
  ...(knowledgeCatalogEnabled&&lookupCoachBibliography(query.message)?{coachBibliography:lookupCoachBibliography(query.message)}:{})};
 const archiveOnly=!!requested&&!!result;
 let answer,planDemonstration=null,lineLessons=null;
 if(archiveOnly)answer=gameHeadings[language];
 else if(openaiApiKey){
  // Only a server-recomputed line can be linked to an illustrated lesson.
  const showPlan=planDemoEnabled&&positionFactsEnabled&&strategyKnowledgeEnabled&&!!analysis&&isPlanRequest(query.message);
  const result=await generateAnswer({...query,language},evidence,{apiKey:openaiApiKey,model:openaiModel,fetchImpl,signal,planDemo:showPlan});
  if(typeof result==='string')answer=result;
  else {answer=result.answer;planDemonstration=result.planDemonstration||null;lineLessons=result.lineLessons||null;}
 }else answer=fallback[language](result.total||0);
 return {answer,generated:archiveOnly||!!openaiApiKey,provider:archiveOnly?null:openaiApiKey?'openai':null,providerStatus:archiveOnly?'archive':openaiApiKey?'ready':'not_configured',
  source:result?'public-archive':'none',archiveAvailable:!!result,engineVerified:!!analysis,candidateLines:clientLines,
  ...(planDemonstration?{planDemonstration}:{}),...(lineLessons?{lineLessons}:{}),
  ...(engine&&!requested?(analysis?{engineLines:serverEngineLines(analysis)}:{engineError}):{}),position:query.fen,matched:result?.total??null,archiveOnly,games:archiveOnly?games.map(game=>{const board=new Chess();board.loadPgn(game.pgn);const moves=board.history();return {...game,moves:moves.slice(0,30),continuation:moves.slice(game.ply,game.ply+6)};}):openaiApiKey?[]:games};
}
module.exports={validChatQuery,groundedChat,publicChatGames,gameRequest,legalCandidateLines,serverEngineLines};
