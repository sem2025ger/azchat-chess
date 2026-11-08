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
  ["  const homeUnifiedCard = import.meta.env.VITE_HOME_UNIFIED_CARD === 'true';\n",""],
  ["          .home-screen-root .desktop-home-arena.home-unified-card {\n            background: linear-gradient(165deg, #1a1d36 0%, #11132a 55%, #0a0b1c 100%);\n          }\n",""],
  ["className={`desktop-home-slogan","className=\"desktop-home-slogan"],
  ["${homeUnifiedCard ? \" xl:hidden\" : \"\"}`}","\""],
  ["className={`mobile-home-arena desktop-home-arena","className=\"mobile-home-arena desktop-home-arena"],
  ["${homeUnifiedCard ? \" home-unified-card\" : \"\"}`}","\""],
  ["          {homeUnifiedCard && (\n            <span className=\"desktop-home-slogan-text hidden\">{t('home.slogan')}</span>\n          )}\n\n",""],
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
