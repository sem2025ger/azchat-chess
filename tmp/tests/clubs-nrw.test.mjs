import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync('src/App.tsx','utf8'),layout=readFileSync('src/components/Layout.tsx','utf8'),ui=readFileSync('src/screens/ClubsNRWScreen.tsx','utf8');
test('NRW routes and navigation default off',()=>{assert.match(app,/VITE_CLUBS_NRW_ENABLED === 'true'/);assert.match(layout,/VITE_CLUBS_NRW_ENABLED === 'true'/);});
test('duel cannot start game and roster is private by default',()=>{assert.match(ui,/Spielstart deaktiviert/);assert.doesNotMatch(ui,/make_move|join_queue|start_game|game_start/);assert.match(ui,/public_roster:false/);});

import {execFileSync} from 'node:child_process';
import {nrwAuthReturnTarget} from '../src/lib/nrwAuthReturn.ts';

test('all NRW flags off preserves the main routing and navigation entry points',()=>{
 const baseline='3a44fde7f6218827e382d07381f337f76d065e6a';
 const layoutPath='src/components/Layout.tsx';
 // The shared language chooser is part of Layout at every flag setting.
 const layoutBaseline='cbe769783a6c7883e3bab9a76adcbc90bd562624';
 const spieltagGate="import.meta.env.VITE_SPIELTAG_ENABLED === 'true'";
 const tournamentGate="("+spieltagGate+" || import.meta.env.VITE_TEAM_TOURNAMENTS_ENABLED === 'true')";
 for(const path of ['src/App.tsx',layoutPath,'src/routeLoaders.ts','scripts/buildQaPreview.mjs']){
  let current=readFileSync(path,'utf8');
  if(path==='src/App.tsx'||path===layoutPath){
   // With tournaments off, only the original Spieltag gate controls this entry.
   assert.ok(current.includes(tournamentGate),path);
   current=current.replace(tournamentGate,spieltagGate);
  }
  const expected=execFileSync('git',['show',(path===layoutPath?layoutBaseline:baseline)+':tmp/'+path],{encoding:'utf8'});
  assert.equal(current,path===layoutPath?expected.replace(tournamentGate,spieltagGate):expected,path);
 }
 const home='src/screens/HomeScreen.tsx';
 const homeBaseline=execFileSync('git',['show',baseline+':tmp/'+home],{encoding:'utf8'})
  .replace(/ {12}background:\n {14}radial-gradient\(ellipse at 5% 0%,[^;]+;\n/,'')
  .replace(/ {12}\/\* Fine, translucent mineral grain[\s\S]+?;\n/,'')
  .replace('md:gap-4 bg-[#121212]/98 p-3','md:gap-4 p-3');
 const flagGatedLink=/ {10}\{import\.meta\.env\.VITE_CLUBS_NRW_ENABLED === 'true' && \(\n {12}<Link to="\/region\/nrw"[^>]+md:hidden">\n {14}NRW – Schach\n {12}<\/Link>\n {10}\)\}\n\n/;
 assert.match(readFileSync(home,'utf8'),flagGatedLink);
 // A disabled M3 must leave the approved Home byte-for-byte unchanged.
 const m3Import="import MyTournamentCard from '../components/teamTournaments/MyTournamentCard';"+String.fromCharCode(10);
 const m3Start='          {/* M3 HOME CARD START */}';
 const m3End='          {/* M3 HOME CARD END */}'+String.fromCharCode(10,10);
 const currentHome=readFileSync(home,'utf8');
 const start=currentHome.indexOf(m3Start);
 const finish=currentHome.indexOf(m3End,start);
 assert.ok(start>=0 && finish>start,'M3 block must be bounded');
 assert.match(currentHome,/VITE_TEAM_TOURNAMENTS_ENABLED === 'true'/);
 assert.match(currentHome,/VITE_TEAM_TOURNAMENTS_M3_ENABLED === 'true'/);
 const disabledHome=currentHome.replace(m3Import,'');
 const disabledStart=disabledHome.indexOf(m3Start);
 const disabledFinish=disabledHome.indexOf(m3End,disabledStart);
 const withoutM3=disabledHome.slice(0,disabledStart)+disabledHome.slice(disabledFinish+m3End.length);
 // The king is an approved, mobile-only visual addition (PR #195).
 // Remove only its exact markup before comparing all disabled NRW/M3 Home code.
 const approvedMobileKing = [
  '              <span className="relative inline-block h-0 w-0 align-baseline" aria-hidden="true">',
  '                <span className="absolute bottom-[0px] left-[11px] h-[44px] w-[22px]">',
  '                  <img src="/brand/sidebar-king.svg" alt="" width="22" height="44" className="absolute inset-0 h-full w-full object-fill" />',
  '                  <span className="sidebar-king-sheen pointer-events-none absolute inset-0" />',
  '                </span>',
  '              </span>',
 ].join(String.fromCharCode(10)) + String.fromCharCode(10);
 assert.equal(withoutM3.split(approvedMobileKing).length,2,'approved mobile king appears exactly once');
 let homeSource=withoutM3.replace(approvedMobileKing,'');
 // Reverse only the explicitly approved, default-off Home feature additions.
 // Any other change to routing, flags, layout or the play button still fails.
 const unifiedCardChanges=[
  ["      {homeUnifiedCard && (\n        <style>{`\n          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,700&display=swap');\n\n          @media (min-width: 1280px) {\n            .home-screen-root .home-unified-card .home-unified-slogan {\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              gap: 9px;\n              font-family: 'Cormorant Garamond', Georgia, serif;\n              font-size: clamp(28px, 2.53vw, 36px);\n              font-weight: 700;\n              font-style: italic;\n              line-height: 1.15;\n              letter-spacing: 0.02em;\n              overflow: visible;\n              text-overflow: clip;\n              text-shadow: none;\n              margin-bottom: 6px;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-part {\n              display: inline-flex;\n              align-items: center;\n              gap: 9px;\n              flex: none;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-word {\n              background: linear-gradient(180deg, #f4f6f8 0%, #cfd5db 50%, #9aa3ac 100%);\n              background-clip: text;\n              -webkit-background-clip: text;\n              -webkit-text-fill-color: transparent;\n              color: transparent;\n              text-shadow: none;\n              filter: drop-shadow(0 0 5px rgba(220,228,235,0.18));\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-diamond {\n              display: inline-block;\n              width: 7px;\n              height: 7px;\n              flex: 0 0 7px;\n              transform: rotate(45deg);\n              background: linear-gradient(135deg, #eef1f4, #8d969f);\n            }\n          }\n        `}</style>\n      )}\n",""],
  ["  const homeUnifiedCard = import.meta.env.VITE_HOME_UNIFIED_CARD === 'true';\n",""],
  ["          .home-screen-root .desktop-home-arena.home-unified-card {\n            background:\n              radial-gradient(120% 70% at 30% 0%, rgba(205,215,230,0.07) 0%, rgba(205,215,230,0) 55%),\n              linear-gradient(150deg, #24272c 0%, #1d2023 32%, #16241f 68%, #0b1a15 100%);\n          }\n",""],
  ["className={`desktop-home-slogan","className=\"desktop-home-slogan"],
  ["${homeUnifiedCard ? \" xl:hidden\" : \"\"}`}","\""],
  ["className={`mobile-home-arena desktop-home-arena","className=\"mobile-home-arena desktop-home-arena"],
  ["${homeUnifiedCard ? \" home-unified-card\" : \"\"}`}","\""],
  ["          {homeUnifiedCard && (\n            <span className=\"desktop-home-slogan-text home-unified-slogan hidden\">\n              {t('home.slogan').split(/\\s*[•·]\\s*/u).map((part, index) => (\n                <span key={part + index} className=\"home-unified-slogan-part\">\n                  {index > 0 && <span className=\"home-unified-slogan-diamond\" aria-hidden=\"true\" />}\n                  <span className=\"home-unified-slogan-word\">{part}</span>\n                </span>\n              ))}\n            </span>\n          )}\n\n",""],
 ];
 const approvedHomePieceChanges = [
  ["  const homeChessComPieces = import.meta.env.VITE_HOME_CHESSCOM_PIECES === 'true';\n", ""],
  ["        /* Desktop Home only: restrained Chess.com-like white and graphite pieces. */\n        @media (min-width: 1280px) {\n          .home-screen-root .home-board img[data-home-chesscom-piece=\"w\"] {\n            filter: contrast(.8) brightness(1.08) !important;\n          }\n          .home-screen-root .home-board img[data-home-chesscom-piece=\"b\"][alt=\"bP\"] {\n            filter: grayscale(1) contrast(.42) brightness(.61) brightness(1.10) !important;\n          }\n", ""],
  ["          /* Match non-pawn black figures to the existing satin graphite pawns.\n             Preserve the original piece paths and highlights; never affect CBURNETT. */\n          .home-screen-root .home-board img[data-home-graphite-set=\"classic\"] {\n            filter: grayscale(1) contrast(.83) brightness(.90) drop-shadow(0 -1px 1px rgba(250,250,245,.12)) drop-shadow(0 2px 3px rgba(0,0,0,.34)) !important;\n          }\n          .home-screen-root .home-board img[data-home-graphite-set=\"neo\"],\n          .home-screen-root .home-board img[data-home-graphite-set=\"tournament\"] {\n            filter: grayscale(1) contrast(1.02) brightness(.90) drop-shadow(0 -1px 1px rgba(250,250,245,.12)) drop-shadow(0 2px 3px rgba(0,0,0,.34)) !important;\n          }\n        }\n", ""],
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
