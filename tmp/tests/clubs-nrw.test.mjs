import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync('src/App.tsx','utf8'),layout=readFileSync('src/components/Layout.tsx','utf8'),ui=readFileSync('src/screens/ClubsNRWScreen.tsx','utf8');
test('NRW routes and navigation default off',()=>{assert.match(app,/VITE_CLUBS_NRW_ENABLED === 'true'/);assert.match(layout,/VITE_CLUBS_NRW_ENABLED === 'true'/);});
test('duel cannot start game and roster is private by default',()=>{assert.match(ui,/Spielstart deaktiviert/);assert.doesNotMatch(ui,/make_move|join_queue|start_game|game_start/);assert.match(ui,/public_roster:false/);});

import {execFileSync} from 'node:child_process';
import {nrwAuthReturnTarget} from '../src/lib/nrwAuthReturn.ts';

test('all NRW flags off preserves the main routing and navigation entry points',()=>{
 const baseline='3a44fde7f6218827e382d07381f337f76d065e6a';
 for(const path of ['src/App.tsx','src/components/Layout.tsx','src/routeLoaders.ts','scripts/buildQaPreview.mjs']){
  const baselineContent = execFileSync('git',['show',baseline+':tmp/'+path],{encoding:'utf8'});
  let actual = readFileSync(path,'utf8');
  if(path === 'src/components/Layout.tsx') {
    // Allow only the separately reviewed 240px desktop sidebar geometry change.
    // All route entries and feature-flagged links must remain byte-for-byte identical.
    for(const [next, previous] of [
      ['w-20 xl:w-[240px]', 'w-20 xl:w-[260px]'],
      ['xl:justify-start px-2 xl:px-4 border-b', 'xl:justify-start px-2 xl:px-6 border-b'],
      ['<nav className="px-3 xl:px-4 pt-10', '<nav className="px-3 xl:px-5 pt-10'],
      ['<div className="p-2 xl:p-4 space-y-3 border-t', '<div className="p-2 xl:p-5 space-y-3 border-t'],
      ['site-nav-copy ml-3 hidden xl:flex', 'site-nav-copy ml-4 hidden xl:flex'],
    ]) {
      assert.ok(actual.includes(next), 'Expected the approved desktop sidebar change: ' + next);
      actual = actual.replace(next,previous);
    }
  }
  assert.equal(actual,baselineContent,path);
 }
 const home='src/screens/HomeScreen.tsx';
 const homeBaseline=execFileSync('git',['show',baseline+':tmp/'+home],{encoding:'utf8'});
 const flagGatedLink=/ {10}\{import\.meta\.env\.VITE_CLUBS_NRW_ENABLED === 'true' && \(\n {12}<Link to="\/region\/nrw"[^>]+md:hidden">\n {14}NRW – Schach\n {12}<\/Link>\n {10}\)\}\n\n/;
 assert.match(readFileSync(home,'utf8'),flagGatedLink);
 assert.equal(readFileSync(home,'utf8').replace(flagGatedLink,''),homeBaseline);
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
