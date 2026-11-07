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
 const homeBaseline=execFileSync('git',['show',baseline+':tmp/'+home],{encoding:'utf8'});
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
  '                <span className="absolute bottom-[-4px] left-[6px] h-[34px] w-[17px]">',
  '                  <img src="/brand/sidebar-king.svg" alt="" width="17" height="34" className="absolute inset-0 h-full w-full object-fill" />',
  '                  <span className="sidebar-king-sheen pointer-events-none absolute inset-0" />',
  '                </span>',
  '              </span>',
 ].join(String.fromCharCode(10)) + String.fromCharCode(10);
 assert.equal(withoutM3.split(approvedMobileKing).length,2,'approved mobile king appears exactly once');
 assert.equal(withoutM3.replace(approvedMobileKing,'').replace(flagGatedLink,''),homeBaseline);
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
