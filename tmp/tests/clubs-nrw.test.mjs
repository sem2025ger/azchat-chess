import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync('src/App.tsx','utf8'),layout=readFileSync('src/components/Layout.tsx','utf8'),ui=readFileSync('src/screens/ClubsNRWScreen.tsx','utf8');
test('NRW routes and navigation default off',()=>{assert.match(app,/VITE_CLUBS_NRW_ENABLED === 'true'/);assert.match(layout,/VITE_CLUBS_NRW_ENABLED === 'true'/);});
test('duel cannot start game and roster is private by default',()=>{assert.match(ui,/Spielstart deaktiviert/);assert.doesNotMatch(ui,/make_move|join_queue|start_game|game_start/);assert.match(ui,/public_roster:false/);});

import {execFileSync} from 'node:child_process';
import {nrwAuthReturnTarget} from '../src/lib/nrwAuthReturn.ts';

test('all NRW flags off preserves the main routing and navigation entry points',()=>{
 const baseline='3a44fde7f6218827e382d07381f337f76d065e6a';
 for(const path of ['src/App.tsx','src/components/Layout.tsx','src/routeLoaders.ts','scripts/buildQaPreview.mjs']){
  assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show',baseline+':tmp/'+path],{encoding:'utf8'}),path);
 }
 const home='src/screens/HomeScreen.tsx';
 const homeBaseline=execFileSync('git',['show',baseline+':tmp/'+home],{encoding:'utf8'});
 const flagGatedLink=/ {10}\{import\.meta\.env\.VITE_CLUBS_NRW_ENABLED === 'true' && \(\n {12}<Link to="\/region\/nrw"[^>]+md:hidden">\n {14}NRW – Schach\n {12}<\/Link>\n {10}\)\}\n\n/;
 let homeSource=readFileSync(home,'utf8');
 assert.match(homeSource,flagGatedLink);
 // Reverse only the explicitly approved, default-off Home feature additions.
 // Any other change to routing, flags, layout or the play button still fails.
 const unifiedCardChanges=[
  ["      {homeUnifiedCard && (\n        <style>{`\n          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,700&display=swap');\n\n          @media (min-width: 1280px) {\n            .home-screen-root .home-unified-card .home-unified-slogan {\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              gap: 9px;\n              font-family: 'Cormorant Garamond', Georgia, serif;\n              font-size: clamp(24px, 2.2vw, 31px);\n              font-weight: 700;\n              font-style: italic;\n              line-height: 1.15;\n              letter-spacing: 0;\n              overflow: visible;\n              text-overflow: clip;\n              text-shadow: none;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-part {\n              display: inline-flex;\n              align-items: center;\n              gap: 9px;\n              flex: none;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-word {\n              background: linear-gradient(180deg, #f6dfb4 0%, #e0b985 50%, #c2915e 100%);\n              background-clip: text;\n              -webkit-background-clip: text;\n              -webkit-text-fill-color: transparent;\n              color: transparent;\n              text-shadow: none;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-diamond {\n              display: inline-block;\n              width: 6px;\n              height: 6px;\n              flex: 0 0 6px;\n              transform: rotate(45deg);\n              background: linear-gradient(135deg, #e6c597, #9c6f45);\n            }\n          }\n        `}</style>\n      )}\n",""],
  ["  const homeUnifiedCard = import.meta.env.VITE_HOME_UNIFIED_CARD === 'true';\n",""],
  ["          .home-screen-root .desktop-home-arena.home-unified-card {\n            background:\n              radial-gradient(120% 70% at 30% 0%, rgba(205,215,230,0.07) 0%, rgba(205,215,230,0) 55%),\n              linear-gradient(150deg, #24272c 0%, #1d2023 32%, #16241f 68%, #0b1a15 100%);\n          }\n",""],
  ["className={`desktop-home-slogan","className=\"desktop-home-slogan"],
  ["${homeUnifiedCard ? \" xl:hidden\" : \"\"}`}","\""],
  ["className={`mobile-home-arena desktop-home-arena","className=\"mobile-home-arena desktop-home-arena"],
  ["${homeUnifiedCard ? \" home-unified-card\" : \"\"}`}","\""],
  ["          {homeUnifiedCard && (\n            <span className=\"desktop-home-slogan-text home-unified-slogan hidden\">\n              {t('home.slogan').split(/\\s*[•·]\\s*/u).map((part, index) => (\n                <span key={part + index} className=\"home-unified-slogan-part\">\n                  {index > 0 && <span className=\"home-unified-slogan-diamond\" aria-hidden=\"true\" />}\n                  <span className=\"home-unified-slogan-word\">{part}</span>\n                </span>\n              ))}\n            </span>\n          )}\n\n",""],
 ];
 for(const [withFlag,withoutFlag] of unifiedCardChanges){
  assert.equal(homeSource.split(withFlag).length,2,'approved Home feature fragment must occur exactly once');
  homeSource=homeSource.replace(withFlag,withoutFlag);
 }
 assert.equal(homeSource.replace(flagGatedLink,''),homeBaseline);
 for(const path of ['/region/nrw','/region/nrw/turniere','/region/nrw/ligen','/region/nrw/vereine','/region/nrw/news','/region/nrw/live','/clubs-nrw/bochumer-sv-02','/spieltag','/vorbereitung']){
  assert.equal(nrwAuthReturnTarget(path,{clubs:false,spieltag:false,preparation:false}),null);
  assert.equal(nrwAuthReturnTarget(path,{clubs:true,spieltag:true,preparation:true}),path);
 }
});

test('NRW sign-in return permits only the existing flag-gated internal destinations',()=>{
 const enabled={clubs:true,spieltag:true,preparation:true};
 for(const path of ['//example.org','/region/nrw/../chat','/region/nrw/invalid','/region/nrw/news\n','/clubs-nrw/%2f%2f','/clubs-nrw/test?next=//example.org','/chat','/spieltag?team=private']){
  assert.equal(nrwAuthReturnTarget(path,enabled),null,path);
 }
 assert.equal(nrwAuthReturnTarget('/spieltag',{...enabled,spieltag:false}),null);
 assert.equal(nrwAuthReturnTarget('/vorbereitung',{...enabled,preparation:false}),null);
});
