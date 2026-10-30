'use strict';
const {Chess,validateFen}=require('chess.js');
const {LANGUAGE_CODES,safeGame}=require('./aiCoachCore');
const {generateAnswer}=require('./aiCoachOpenAI');

const fallback={
 de:(total)=>'In dieser Stellung wurden '+total+' öffentliche Partien gefunden. Du kannst die Beispiele unten in der Analyse öffnen. Eine Stockfish-Bewertung liegt hier nicht vor.',
 en:(total)=>'Found '+total+' public games in this position. Open the examples below in Analysis. No Stockfish evaluation is available in this chat.',
 ru:(total)=>'В этой позиции найдено '+total+' публичных партий. Открой примеры ниже в разделе анализа. Оценка Stockfish в этом чате пока недоступна.',
 az:(total)=>'Bu mövqedə '+total+' açıq partiya tapıldı. Nümunələri aşağıda təhlildə aç. Bu çatda Stockfish qiymətləndirməsi hələ yoxdur.',
 tr:(total)=>'Bu konumda '+total+' herkese açık parti bulundu. Örnekleri aşağıda analizde açabilirsin. Bu sohbette Stockfish değerlendirmesi henüz yok.',
 uk:(total)=>'У цій позиції знайдено '+total+' відкритих партій. Переглянь приклади нижче в аналізі. Оцінка Stockfish у чаті поки недоступна.'
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

function validChatQuery(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['message','fen','side','language','history'].includes(k)))return false;
 if(typeof value.message!=='string'||value.message.trim().length<2||value.message.length>500)return false;
 if(typeof value.fen!=='string'||value.fen.length>200||!validateFen(value.fen).ok)return false;
 if(!['white','black','any'].includes(value.side)||!LANGUAGE_CODES.has(value.language))return false;
 if(value.history!==undefined&&(!Array.isArray(value.history)||value.history.length>8||value.history.some(item=>!item||typeof item!=='object'||Object.keys(item).some(k=>!['role','text'].includes(k))||!['user','assistant'].includes(item.role)||typeof item.text!=='string'||item.text.length<1||item.text.length>1200)))return false;
 try{new Chess(value.fen);}catch{return false;}
 return true;
}
function publicChatGames(result,fen,count=5){
 return (result.games||[]).slice(0,count).flatMap(record=>{
  const game=safeGame(record,{fen});
  return game?[{id:game.id,white:game.white,black:game.black,result:game.result,ply:game.ply,pgn:game.pgn,date:game.date||null}]:[];
 });
}
async function groundedChat(index,query,{openaiApiKey=null,openaiModel='gpt-6-sol',fetchImpl=fetch,signal}={}){
 const requested=gameRequest(query.message);
 let result=null;
 // Search rechecks both players' opt-outs. Never query private/personal games.
 if(index?.status==='ready')try{result=await index.search({fen:query.fen,side:query.side,scope:'all',sort:'strongest',limit:requested??5});}catch{ /* General teaching can continue without archive claims. */ }
 if(!result&&!openaiApiKey)throw Object.assign(Error('index_unavailable'),{code:index?.status==='warming'?'index_warming':'index_unavailable'});
 const games=result?publicChatGames(result,query.fen,requested??5):[],language=normalizeLanguage(query.language);
 const evidence={archiveAvailable:!!result,matched:result?.total??null,
  nextMoves:(result?.nextMoves||[]).slice(0,8).map(x=>({move:x.move,count:x.count})),
  games:games.map(({white,black,result,date,ply,pgn})=>{const board=new Chess();board.loadPgn(pgn);return {white,black,result,date,hasPgn:true,matchedPly:ply,continuation:board.history().slice(ply,ply+6)};})};
 const archiveOnly=!!requested&&!!result;
 const answer=archiveOnly?gameHeadings[language]:openaiApiKey?await generateAnswer({...query,language},evidence,{apiKey:openaiApiKey,model:openaiModel,fetchImpl,signal}):fallback[language](result.total||0);
 return {answer,generated:archiveOnly||!!openaiApiKey,provider:archiveOnly?null:openaiApiKey?'openai':null,providerStatus:archiveOnly?'archive':openaiApiKey?'ready':'not_configured',
  source:result?'public-archive':'none',archiveAvailable:!!result,engineVerified:false,position:query.fen,matched:result?.total??null,archiveOnly,games:archiveOnly?games.map(game=>{const board=new Chess();board.loadPgn(game.pgn);const moves=board.history();return {...game,moves:moves.slice(0,30),continuation:moves.slice(game.ply,game.ply+6)};}):games};
}
module.exports={validChatQuery,groundedChat,publicChatGames,gameRequest};
