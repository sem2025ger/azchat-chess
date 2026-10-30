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
function validChatQuery(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['message','fen','side','language','history'].includes(k)))return false;
 if(typeof value.message!=='string'||value.message.trim().length<2||value.message.length>500)return false;
 if(typeof value.fen!=='string'||value.fen.length>200||!validateFen(value.fen).ok)return false;
 if(!['white','black','any'].includes(value.side)||!LANGUAGE_CODES.has(value.language))return false;
 if(value.history!==undefined&&(!Array.isArray(value.history)||value.history.length>8||value.history.some(item=>!item||typeof item!=='object'||Object.keys(item).some(k=>!['role','text'].includes(k))||!['user','assistant'].includes(item.role)||typeof item.text!=='string'||item.text.length<1||item.text.length>1200)))return false;
 try{new Chess(value.fen);}catch{return false;}
 return true;
}
function publicChatGames(result,fen){
 return (result.games||[]).slice(0,5).flatMap(record=>{
  const game=safeGame(record,{fen});
  return game?[{id:game.id,white:game.white,black:game.black,result:game.result,ply:game.ply,pgn:game.pgn,date:game.date||null}]:[];
 });
}
async function groundedChat(index,query,{openaiApiKey=null,openaiModel='gpt-6-sol',fetchImpl=fetch,signal}={}){
 let result=null;
 // Search rechecks both players' opt-outs. Never query private/personal games.
 if(index?.status==='ready')try{result=await index.search({fen:query.fen,side:query.side,scope:'all',sort:'strongest',limit:5});}catch{ /* General teaching can continue without archive claims. */ }
 if(!result&&!openaiApiKey)throw Object.assign(Error('index_unavailable'),{code:index?.status==='warming'?'index_warming':'index_unavailable'});
 const games=result?publicChatGames(result,query.fen):[],language=normalizeLanguage(query.language);
 const evidence={archiveAvailable:!!result,matched:result?.total??null,
  nextMoves:(result?.nextMoves||[]).slice(0,8).map(x=>({move:x.move,count:x.count})),
  games:games.map(({white,black,result,date})=>({white,black,result,date}))};
 const answer=openaiApiKey?await generateAnswer({...query,language},evidence,{apiKey:openaiApiKey,model:openaiModel,fetchImpl,signal}):fallback[language](result.total||0);
 return {answer,generated:!!openaiApiKey,provider:openaiApiKey?'openai':null,providerStatus:openaiApiKey?'ready':'not_configured',
  source:result?'public-archive':'none',archiveAvailable:!!result,engineVerified:false,position:query.fen,matched:result?.total??null,games};
}
module.exports={validChatQuery,groundedChat,publicChatGames};
