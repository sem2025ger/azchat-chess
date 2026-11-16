import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('Chessy is opt-in and reuses the authenticated existing AI Coach',()=>{
 const chat=read('components/spieler/CoachChat.tsx');
 assert.match(chat,/VITE_AI_COACH_ENABLED!=='true'/);
 assert.match(chat,/VITE_CHESSY_ENABLED==='true'/);
 assert.match(chat,/chessyEnabled&&<div className="chessy-intro"/);
 assert.match(chat,/chessyEnabled&&<div className="chessy-prompts"/);
 assert.match(chat,/onClick=\{\(\)=>void ask\(chessy\.planRequest\[planSide\],false\)\}/);
 assert.doesNotMatch(chat,/chessy\.prompts/);
 assert.match(chat,/disabled=\{!token\|\|!!busy\|\|recording\}/);
 assert.match(chat,/onSubmit=\{send\}/);
 assert.doesNotMatch(read('components/spieler/ChessyAvatar.tsx'),/fetch\(|WebSocket|localStorage/);
});
test('Chessy offers one universal plan question with a White and a Black button in six locales',async()=>{
 const {chessyCopy}=await import('../src/i18n/chessyCopy.ts');
 assert.deepEqual(Object.keys(chessyCopy).sort(),['az','de','en','ru','tr','uk']);
 assert.equal(chessyCopy.ru.planQuestion,'Оцени позицию и предложи план игры');
 assert.equal(chessyCopy.ru.forWhite,'За белых');
 assert.equal(chessyCopy.ru.forBlack,'За чёрных');
 const require=createRequire(new URL('../../server/package.json',import.meta.url));
 const {gameRequest,validChatQuery}=require('./aiCoachChat.js');
 const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 for(const [code,copy] of Object.entries(chessyCopy)){
  for(const key of ['planQuestion','forWhite','forBlack'])assert.ok(copy[key].length>1,code+' '+key);
  assert.equal('prompts' in copy,false,code+': the three old suggestions are gone');
  for(const side of ['white','black']){
   const message=copy.planRequest[side];
   assert.ok(message.startsWith(copy.planQuestion.split(' ')[0]),code+' '+side+' asks the same question');
   // The server must treat the request as an analysis question, never as an archive game search.
   assert.equal(gameRequest(message),null,code+' '+side);
   assert.ok(validChatQuery({message,fen,side:'any',language:code==='uk'?'ua':code}),code+' '+side);
  }
  assert.notEqual(copy.planRequest.white,copy.planRequest.black,code);
 }
 const old=readFileSync(new URL('../src/i18n/chessyCopy.ts',import.meta.url),'utf8');
 for(const removed of ['Каких ошибок здесь следует избегать','Какие тактические угрозы есть','Объясни лучший практический план'])assert.equal(old.includes(removed),false,removed);
});
test('Chessy animations respect reduced motion and are opt-in to desktop overlay',()=>{
 const styles=read('components/spieler/ChessyAvatar.css');
 assert.match(styles,/prefers-reduced-motion:reduce/);
 assert.match(styles,/\.chessy-enabled \.coach-chat-toggle/);
 const originalStyles=read('components/spieler/CoachChat.css');
 assert.match(originalStyles,/max-width:1023px/);
 assert.match(originalStyles,/display:none!important/);
});
