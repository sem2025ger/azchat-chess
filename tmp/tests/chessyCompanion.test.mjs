import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('Chessy is opt-in and reuses the authenticated existing AI Coach',()=>{
 const chat=read('components/spieler/CoachChat.tsx');
 assert.match(chat,/VITE_AI_COACH_ENABLED!=='true'/);
 assert.match(chat,/VITE_CHESSY_ENABLED==='true'/);
 assert.match(chat,/chessyEnabled&&<div className="chessy-intro"/);
 assert.match(chat,/chessyEnabled&&<div className="chessy-prompts"/);
 assert.match(chat,/setDraft\(question\)/);
 assert.match(chat,/disabled=\{!token\|\|!!busy\|\|recording\}/);
 assert.match(chat,/onSubmit=\{send\}/);
 assert.doesNotMatch(read('components/spieler/ChessyAvatar.tsx'),/fetch\(|WebSocket|localStorage/);
});
test('Chessy prompts never assert a prior move was bad without history',()=>{
 const localized=read('i18n/chessyCopy.ts');
 for(const code of ['de','ru','az','tr','uk'])assert.match(localized,new RegExp('(?:^|\\n) '+code+':\\{','m'));
 assert.match(localized,/export const chessyCopy=\{\s*en,/);
 assert.match(localized,/without history/);
 assert.match(localized,/без истории партии/);
 assert.match(localized,/только проверенные варианты/);
});
test('Chessy animations respect reduced motion and are opt-in to desktop overlay',()=>{
 const styles=read('components/spieler/ChessyAvatar.css');
 assert.match(styles,/prefers-reduced-motion:reduce/);
 assert.match(styles,/\.chessy-enabled \.coach-chat-toggle/);
 const originalStyles=read('components/spieler/CoachChat.css');
 assert.match(originalStyles,/max-width:1023px/);
 assert.match(originalStyles,/display:none!important/);
});
