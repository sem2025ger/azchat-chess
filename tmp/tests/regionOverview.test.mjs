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

test('NRW static external destinations are defined once in the shared config',()=>{
 const start=region.indexOf('const NRW_EXTERNAL_URLS = {');
 const end=region.indexOf('} as const;',start);
 assert.ok(start>=0&&end>start);
 const config=Function('return ('+region.slice(start+'const NRW_EXTERNAL_URLS = '.length,end+1)+')')();
 const newsSources=Object.values(config.newsSources).flat();
 assert.equal(Object.keys(config.official).length,5);
 assert.ok(config.liveBroadcasts);
 assert.equal(newsSources.length,12);
 assert.doesNotMatch(region.slice(0,start)+region.slice(end),/['"]https?:\/\//);
 assert.doesNotMatch(read('src/components/nrw/NewsPanels.tsx'),/['"]https?:\/\//);

 const directory=config.bochumDirectory;
 assert.equal(directory.length,8);
 assert.equal(directory[0].url,'https://sbboblog.wordpress.com/die-vereine/');
 assert.equal(directory.at(-1).name,'Stadt Bochum');
 const clubNames=directory.slice(1,-1).map(({name})=>name);
 assert.deepEqual(clubNames,[...clubNames].sort((a,b)=>a.localeCompare(b,'de')));
 const hosts=directory.map(({url})=>new URL(url).hostname);
 assert.equal(new Set(hosts).size,directory.length);
 const newsSourceHosts=new Set(newsSources.map(({url})=>new URL(url).hostname));
 assert.ok(hosts.every(host=>!newsSourceHosts.has(host)));
 for(const {url,description} of directory){
  const target=new URL(url);
  assert.equal(target.protocol,'https:');
  assert.doesNotMatch(target.pathname,/\/feed\/?$/i);
  assert.ok(description.length>0&&description.length<=70);
 }
});

test('NRW links to national chat without embedding it and the chat retains its membership guard',()=>{
 const rail=read('src/components/schachTreff/NationwideChatRail.tsx');
 assert.doesNotMatch(region,/NationwideChatRail/);
 assert.match(region,/<div className="nrw-links">[\s\S]*?to="\/vorbereitung"[\s\S]*?to="\/chat"/);
 assert.match(region,/to="\/chat"/);
 assert.match(rail,/NATIONAL_ROOM_SLUG = 'chessaz-deutsch'/);
 assert.match(rail,/\.eq\('club_id',id\)/);
 assert.match(rail,/if\(!joined\)/);
 assert.match(rail,/if\(!userId\|\|!clubId\|\|!member\|\|busy/);
 assert.match(rail,/maxLength=\{1200\}/);
 assert.match(rail,/key=\{user\?\.id \?\? 'guest'\}/);
 assert.doesNotMatch(rail,/service_role|SUPABASE_SERVICE|bypassRls/);
});

test('eight merged screens have complete six-language copy for fixed labels and stored notices',async()=>{
 const {default:ts}=await import('typescript');
 const sources=[['src/i18n/sectionCopy.ts','sectionCopy'],['src/i18n/regionalCopy.ts','regionalCopy'],['src/components/schachTreff/NationwideChatRail.tsx','chatUiText'],['src/screens/SpielerScreen.tsx','playerUiCopy'],['src/screens/SpieltagScreen.tsx','matchdayText'],['src/screens/RegionOverview.tsx','regionText'],['src/screens/VorbereitungScreen.tsx','preparationText'],['src/screens/ClubsNRWScreen.tsx','clubUiText']];
 const maps={};
 for(const [path,name] of sources){
  const source=read(path),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)initializer=node.initializer.getText(ast);ts.forEachChild(node,visit);};visit(ast);
  assert.ok(initializer,name);const copy=Function('return ('+initializer+')')();maps[name]=copy;
  for(const [key,entry] of Object.entries(copy))for(const locale of ['de','en','az','tr','ua','ru'])assert.ok(typeof entry[locale]==='string'&&entry[locale].trim(),`${name}: ${key}: ${locale}`);
 }
 const checks={
  playerUiCopy:['Profil','Partien','Verein —','Dieses Profil ist deinem Konto zugeordnet.','Anfrage eingegangen. Die Identität wird vor einer Zuordnung geprüft.'],
  chatUiText:['Mitglied','Chat ist momentan nicht verfügbar.','Beitritt nicht möglich. Bitte erneut versuchen.','Nachricht konnte nicht gesendet werden.'],
  matchdayText:['Du pflegst diese Mannschaft als Kapitänin oder Kapitän.','Nur für bestätigte Mannschaftsmitglieder.','Brett {number} aus dieser Aufstellung entfernen?','Spielerkarte nicht verfügbar. Das Profil kann ausgeblendet oder Spieler deaktiviert sein.'],
  regionalCopy:['Najdorf oder B90','Spieltag','Keine Partien in dieser Variante','Keine Partien für diese Filter','Mit Weiß','Mit Schwarz','Weiß','Schwarz','Nicht gespielt','Noch offen','Gegner offen','Noch keine Notizen.','Zuordnung über FIDE-ID','Namenszuordnung (nicht verifiziert)','Dieser Spieler hat zu viele Partien für die aktuelle Stellungssuche (höchstens 10.000). Es wird kein gekürztes Ergebnis angezeigt.','Zu viele Anfragen. Bitte warte eine Minute.','Keine Daten verfügbar. Bitte den vollständigen Namen als Nachname, Vorname oder eine FIDE-ID angeben.','Stellungssuche derzeit nicht verfügbar.','Diese Partie kann nicht geöffnet werden.'],
  regionText:['Nachrichten derzeit nicht verfügbar.','Keine aktuellen Meldungen verfügbar.','Verein','MP'],
  preparationText:['Zu viele Anfragen. Bitte warte eine Minute.','Partien konnten nicht geladen werden. Bitte prüfe den Namen und versuche es später erneut.','Diese Partie kann nicht in der Analyse geöffnet werden.'],
 };
 for(const [name,keys] of Object.entries(checks))for(const key of keys)for(const locale of ['en','az','tr','ua','ru']){
  if(key==='Profil'&&['az','tr'].includes(locale))continue; // Same correct word in Azerbaijani and Turkish.
  assert.notEqual(maps[name][key][locale],maps[name][key].de,`${key}: ${locale}`);
 }
 for(const locale of ['de','en','az','tr','ua','ru'])assert.ok(maps.matchdayText['Brett {number} aus dieser Aufstellung entfernen?'][locale].includes('{number}'));
});

test('stored Lichess retry message translates on a later language switch and preserves seconds',async()=>{
 const {default:ts}=await import('typescript');
 const source=read('src/screens/VorbereitungScreen.tsx'),ast=ts.createSourceFile('screen.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const declarations=[];const visit=node=>{if(ts.isVariableDeclaration(node)&&['preparationText','translatePreparation'].includes(node.name.getText(ast)))declarations.push('const '+node.getText(ast)+';');ts.forEachChild(node,visit);};visit(ast);
 const code=ts.transpile(declarations.join('\n'),{target:ts.ScriptTarget.ES2022});
 const translate=Function('translateSectionCopy',code+';return translatePreparation;')(value=>value);
 const stored='Lichess bittet um eine Pause. Bitte in 37 Sekunden erneut versuchen.';
 for(const locale of ['en','az','tr','ua','ru','de']){
  const value=translate(stored,locale);assert.ok(value.includes('37'));assert.equal(value.includes('Lichess bittet'),locale==='de');
  assert.equal(translate('Zu viele Anfragen. Bitte warte eine Minute.',locale).includes('Zu viele Anfragen'),locale==='de');
 }
 assert.equal(translate(stored,'de'),stored);
});

test('NRW news only recognizes declared region and category keys', async () => {
 const { regionLabels, categoryLabels, isRegion, isCategory } = await import('../src/components/nrw/newsData.ts');
 assert.deepEqual(Object.keys(regionLabels), ['nrw','ruhrgebiet','niederrhein','mittelrhein','owl','muensterland','suedwestfalen','bochum']);
 assert.ok(Object.keys(regionLabels).every(isRegion));
 assert.deepEqual(Object.keys(categoryLabels), ['landesverband','jugend_schule','region']);
 assert.ok(Object.keys(categoryLabels).every(isCategory));
 for (const key of ['unknown','BOCHUM','__proto__','toString',null]) {
  assert.equal(isRegion(key), false);
  assert.equal(isCategory(key), false);
 }
});

test('NRW news times use the active language and an absolute Berlin date', async () => {
 const { newsDateFormats, relativeNewsTime } = await import('../src/components/nrw/newsData.ts');
 const published = '2026-11-23T11:10:00.000Z';
 const now = Date.parse('2026-11-23T12:40:00.000Z');
 for (const [language, locale] of Object.entries({de:'de-DE',en:'en-GB',tr:'tr-TR',ua:'uk-UA',ru:'ru-RU'})) {
  const formats = newsDateFormats(language);
  const intl = new Intl.RelativeTimeFormat(locale,{numeric:'auto'});
  assert.equal(relativeNewsTime(formats.relative,published,now),intl.format(-1,'hour'));
  assert.equal(relativeNewsTime(formats.relative,published,now+86_400_000),intl.format(-1,'day'));
  assert.equal(relativeNewsTime(formats.relative,published,now-80*60_000),intl.format(-10,'minute'));
  assert.equal(formats.clock.format(new Date(published)),'12:10');
 }
});

test('NRW news uses Azerbaijani time words for past and future dates', async () => {
 const { newsDateFormats, relativeNewsTime } = await import('../src/components/nrw/newsData.ts');
 const { relative } = newsDateFormats('az');
 const now = Date.parse('2026-11-23T10:59:35Z');
 const minute = 60_000, hour = 60 * minute, day = 24 * hour;
 const cases = [
  [-30_000, 'indicə'], [30_000, 'indicə'], [-5 * minute, '5 dəqiqə əvvəl'],
  [-10 * hour, '10 saat əvvəl'], [-day, 'dünən'], [-5 * day, '5 gün əvvəl'],
  [5 * minute, '5 dəqiqə sonra'], [10 * hour, '10 saat sonra'], [day, '1 gün sonra'],
 ];
 for (const [offset, expected] of cases) {
  assert.equal(relativeNewsTime(relative, new Date(now + offset).toISOString(), now), expected);
 }
});

test('NRW Azerbaijani absolute dates and clocks use Berlin time with numeric dates year-round', async () => {
 const { newsDateFormats } = await import('../src/components/nrw/newsData.ts');
 const { clock, absolute } = newsDateFormats('az');
 for (const [utc, date, time] of [
  ['2026-11-23T10:59:35Z', '23.11.2026', '11:59'],
  ['2026-07-09T22:05:00Z', '10.07.2026', '00:05'],
 ]) {
  assert.equal(absolute.format(new Date(utc)), `${date}, ${time}`);
  assert.equal(clock.format(new Date(utc)), time);
 }
});
