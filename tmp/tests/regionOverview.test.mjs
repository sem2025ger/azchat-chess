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

test('eight merged screens have complete six-language copy for fixed labels and stored notices',async()=>{
 const {default:ts}=await import('typescript');
 const sources=[['src/i18n/sectionCopy.ts','sectionCopy'],['src/i18n/regionalCopy.ts','regionalCopy'],['src/components/schachTreff/NationwideChatRail.tsx','chatUiText'],['src/screens/SpielerScreen.tsx','playerUiCopy'],['src/screens/SpieltagScreen.tsx','matchdayText'],['src/screens/RegionOverview.tsx','regionText'],['src/screens/VorbereitungScreen.tsx','preparationText']];
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
  regionText:['Nachrichten derzeit nicht verfügbar.','Verein','MP'],
  sectionCopy:['Keine aktuellen Meldungen verfügbar.'],
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
