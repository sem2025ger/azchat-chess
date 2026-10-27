import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/App.tsx'),layout=read('src/components/Layout.tsx'),region=read('src/screens/RegionOverview.tsx'),chat=read('src/screens/SchachTreffDesktop.tsx');
test('NRW overview is independently routed but gated by existing regional feature flag',()=>{
 assert.match(app,/path="region\/:regionId"/);
 assert.match(app,/path="region\/:regionId\/:section"/);
 assert.match(app,/VITE_CLUBS_NRW_ENABLED === 'true'/);
 assert.match(layout,/to="\/region\/nrw"/);
 assert.match(chat,/to="\/region\/nrw"/);
});
test('national chat, Spieler and Vorbereitung remain independent from regional selection',()=>{
 assert.match(layout,/to="\/chat"/);
 assert.match(layout,/to="\/spieler"/);
 assert.match(region,/to="\/chat"/);
 assert.match(region,/to="\/spieler"/);
 assert.match(region,/to="\/vorbereitung"/);
 assert.doesNotMatch(region,/localStorage|navigator\.geolocation|regionId\s*===\s*['"]bayern/);
});
test('NRW dashboard sources are scoped and transparent about unavailable data',()=>{
 for(const section of ['turniere','ligen','vereine','news','live'])assert.match(region,new RegExp(section));
 assert.match(region,/\.eq\('published',true\)/);
 assert.match(region,/\.in\('club_id',ids\)/);
 assert.match(region,/clubs-nrw\/news/);
 assert.match(region,/keine für NRW verifizierte Live-Übertragung/);
 assert.match(region,/keine offizielle Live-Tabelle/);
 assert.match(region,/if\(!validRegion\)/);
 assert.match(region,/to=\{'\/clubs-nrw\/'/);
});

test('regional rail reuses the national room and guards membership',()=>{
 const rail=read('src/components/schachTreff/NationwideChatRail.tsx');
 assert.match(region,/NationwideChatRail/);
 assert.match(rail,/NATIONAL_ROOM_SLUG = 'chessaz-deutsch'/);
 assert.match(rail,/\.eq\('club_id',id\)/);
 assert.match(rail,/if\(!joined\)/);
 assert.match(rail,/if\(!userId\|\|!clubId\|\|!member\|\|busy/);
 assert.match(rail,/maxLength=\{1200\}/);
 assert.match(rail,/key=\{user\?\.id \?\? 'guest'\}/);
 assert.doesNotMatch(rail,/service_role|SUPABASE_SERVICE|bypassRls/);
});
