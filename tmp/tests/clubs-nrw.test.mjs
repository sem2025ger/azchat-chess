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
  ["          .home-screen-root .desktop-home-arena.home-unified-card {\n            background: linear-gradient(145deg, #111419 0%, #16181f 54%, #1B1B22 100%);\n          }\n",""],
  ["className={`desktop-home-slogan","className=\"desktop-home-slogan"],
  ["${homeUnifiedCard ? \" xl:hidden\" : \"\"}`}","\""],
  ["className={`mobile-home-arena desktop-home-arena","className=\"mobile-home-arena desktop-home-arena"],
  ["${homeUnifiedCard ? \" home-unified-card\" : \"\"}`}","\""],
  ["          {homeUnifiedCard && (\n            <span className=\"desktop-home-slogan-text hidden\">{t('home.slogan')}</span>\n          )}\n\n",""],
 ];
 const approvedHomePieceChanges = [
  ["  const homeChessComPieces = import.meta.env.VITE_HOME_CHESSCOM_PIECES === 'true';\n", ""],
  ["        /* Desktop Home only: restrained Chess.com-like white and graphite pieces. */\n        @media (min-width: 1280px) {\n          .home-screen-root .home-board img[data-home-chesscom-piece=\"w\"] {\n            filter: contrast(.8) brightness(1.08) !important;\n          }\n          .home-screen-root .home-board img[data-home-chesscom-piece=\"b\"][alt=\"bP\"] {\n            filter: grayscale(1) contrast(.42) brightness(.61) brightness(1.10) !important;\n          }\n", ""],
  ["          /* Match non-pawn black figures to the existing satin graphite pawns.\n             Preserve the original piece paths and highlights; never affect CBURNETT. */\n          .home-screen-root .home-board img[data-home-graphite-set=\"classic\"] {\n            filter: grayscale(1) contrast(.75) brightness(.90) drop-shadow(0 2px 3px rgba(0,0,0,.34)) !important;\n          }\n          .home-screen-root .home-board img[data-home-graphite-set=\"neo\"],\n          .home-screen-root .home-board img[data-home-graphite-set=\"tournament\"] {\n            filter: grayscale(1) contrast(.92) brightness(.90) drop-shadow(0 2px 3px rgba(0,0,0,.34)) !important;\n          }\n        }\n", ""],
  ["homeBlackInk homeChessComPalette={homeChessComPieces} className", "homeBlackInk className"],
  // PR #197 approved square board and frame containment; preserve exact prior layout below.
  ["          <div className=\"relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] xl:p-3 overflow-hidden shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)] ring-2 ring-white/10 xl:ring-0 group transform-gpu transition-transform duration-1000 board-perspective home-board home-board-frame max-md:hidden\">\n", "          <div className=\"relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] overflow-hidden shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 xl:rotate-y-[12deg] xl:rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0 board-perspective home-board home-board-frame max-md:hidden\">\n"],
  ["xl:!p-0\" />", "xl:!p-2\" />"],
 ];
 for(const [withFlag,withoutFlag] of unifiedCardChanges){
  assert.equal(homeSource.split(withFlag).length,2,'approved Home feature fragment must occur exactly once');
  homeSource=homeSource.replace(withFlag,withoutFlag);
 }
 for(const [change,original] of approvedHomePieceChanges) {
  assert.equal(homeSource.split(change).length, 2, 'approved opt-in piece fragment must occur exactly once');
  homeSource=homeSource.replace(change,original);
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
