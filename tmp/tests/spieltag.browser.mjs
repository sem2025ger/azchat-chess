// Real Chromium with synthetic auth/data only. Exercises production Spieltag
// components, request payloads, captain/member UI and identity-change cleanup.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
const fixture=String.raw`
import '/src/index.css';import React from 'react';import{createRoot}from'react-dom/client';import Screen from '/src/screens/SpieltagScreen.tsx';import{MemoryRouter,Routes,Route,useNavigate}from'react-router-dom';import Preparation from '/src/screens/VorbereitungScreen.tsx';import{loadAnalysisSession}from'/src/utils/analysisSession.ts';
window.fixtureSession={access_token:'captain-test-only'};window.fixtureCalls=[];
const team='11111111-1111-4111-8111-111111111111',match='22222222-2222-4222-8222-222222222222';
let matches=[],boards=[];const native=window.fetch;
window.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://spieltag-fixture.invalid/'))return native(url,options);
 const path=new URL(url).pathname;window.fixtureCalls.push({path,method:options.method,body:options.body});
 const token=options.headers.Authorization,body=options.body?JSON.parse(options.body):{};let data;
 if(path==='/api/spieltag/teams')data={teams:token.includes('outsider')?[]:[{id:team,club_id:team,name:'1. Mannschaft',role:token.includes('captain')?'captain':'member'}]};
 else if(path==='/api/spieltag/clubs')data={clubs:[{id:team,name:'Fixture Verein',slug:'fixture'}]};
 else if(path==='/api/spieler/13404431'){
  if(window.delayCard)await new Promise(resolve=>window.releaseCard=resolve);
  data={player:{fide_id:13404431,name:'Fixture FIDE Player',surname:'Fixture',federation:'GER',title:'FM',fide_rating:2100,club:null,source_date:'2026-10-25',source_url:'https://ratings.fide.com/profile/13404431'}};
 }
 else if(path.endsWith('/boards/1/lichess')){boards=boards.map(b=>({...b,opponent_lichess_username:body.username}));data={boards};}
 else if(path==='/api/vorbereitung/player')data={fideId:'13404431',rejected:0,candidates:[],games:['1. Nf3 d5 2. g3 Nf6 3. Bg2 e6 1-0','1. g3 d5 2. Nf3 Nf6 3. Bg2 e6 1-0'].map((moves,i)=>({id:'broadcast-'+i,source:'lichess-broadcast',link_basis:i?'name':'fide_id',pgn:'[Event "Broadcast fixture"]\n[White "Fixture, Player"]\n[Black "Guest, Player"]\n[Result "1-0"]\n\n'+moves,white:'Fixture, Player',black:'Guest, Player',result:'1-0',date:'2026.09.25',color:'white',speed:'classical',timeControl:'5400+30',opening:'Reti Opening',eco:'A05',createdAt:2}))};
 else if(path.startsWith('/api/vorbereitung/'))data={nickname:'target_user',rejected:0,games:[{id:'prep-one',lichessId:'abcdefgh',pgn:'[Event \"Fixture\"]\n[Result \"1-0\"]\n\n1. e4 c5 2. Nf3 d6 1-0',white:'target_user',black:'guest',result:'1-0',date:'2026.10.25',color:'white',speed:'blitz',timeControl:'300+0',opening:'Sicilian Defense: Najdorf Variation',eco:'B90',createdAt:2}]};
 else if(path.endsWith('/boards/1')){if(options.method==='DELETE'){boards=[];data={deleted:true};}else{boards=[{...(boards[0]||{}),...body,match_id:match,board_number:1}];data={boards};}}
 else if(path.endsWith('/boards'))data={boards};
 else if(options.method==='POST'||options.method==='PATCH'){matches=[{...body,id:match,team_id:team}];data={matches};}
 else data={matches};
 return new Response(JSON.stringify(data),{status:options.method==='POST'?201:200,headers:{'content-type':'application/json'}});
};
function Shell(){window.fixtureNavigate=useNavigate();return <Routes><Route path='/' element={<Screen/>}/><Route path='/vorbereitung' element={<Preparation/>}/><Route path='/game' element={<p id='analysis-landed'>Analyse</p>}/></Routes>;}function App(){return <MemoryRouter><Shell/></MemoryRouter>;}window.fixtureAnalysis=()=>loadAnalysisSession()?.moveHistory;window.fixtureAnalysisPly=()=>loadAnalysisSession()?.viewMoveIndex;window.changeSession=value=>{window.fixtureSession=value?{access_token:value}:null;window.dispatchEvent(new Event('fixture-auth'));};
createRoot(document.getElementById('root')).render(<App/>);
`;
const plugin={name:'spieltag-browser-fixtures',enforce:'pre',
 resolveId(id,importer){if(id==='/__spieltag_fixture.tsx')return id;if(id==='../context/AuthContext'&&(importer?.endsWith('/screens/SpieltagScreen.tsx')||importer?.endsWith('/screens/VorbereitungScreen.tsx')))return '\0spieltag-fixture-auth';},
 load(id){if(id==='/__spieltag_fixture.tsx')return fixture;if(id==='\0spieltag-fixture-auth')return `import{useSyncExternalStore}from'react';const subscribe=cb=>{window.addEventListener('fixture-auth',cb);return()=>window.removeEventListener('fixture-auth',cb);};const snapshot=()=>window.fixtureSession;export function useAuth(){return{session:useSyncExternalStore(subscribe,snapshot,snapshot)};}`;},
 configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/spieltag-fixture')return next();res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/spieltag-fixture','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#202020"><div id="root"></div><script type="module" src="/__spieltag_fixture.tsx"></script></body></html>'));});},
};
const server=await createServer({configFile:false,plugins:[plugin,react()],server:{host:'127.0.0.1',port:0},define:{
 'import.meta.env.VITE_SERVER_URL':JSON.stringify('https://spieltag-fixture.invalid'),
 'import.meta.env.VITE_VORBEREITUNG_ENABLED':JSON.stringify('true'),'import.meta.env.VITE_SPIELTAG_ENABLED':JSON.stringify('true'),'import.meta.env.VITE_SPIELER_V1_ENABLED':JSON.stringify('true'),
}});
let chrome,ws,profile;const deadline=setTimeout(()=>{chrome?.kill('SIGKILL');console.error('Spieltag browser deadline exceeded');process.exit(1);},120000);
try{
 await server.listen();const base=server.resolvedUrls.local[0];
 const binary=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(binary,'Chromium required');
 profile=await mkdtemp(join(tmpdir(),'chessaz-spieltag-'));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,...JSON.parse(process.env.CHROME_ARGS||'[]'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 let stderr='';chrome.stderr.on('data',c=>{stderr=(stderr+c).slice(-4000);});
 const pause=()=>new Promise(r=>setTimeout(r,50));let port;
 for(let i=0;i<200;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await pause();}assert.ok(port,stderr);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map(),exceptions=[];
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout '+method));},15000);pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({id:request,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate("Boolean(document.body && ("+expression+"))"))return;await pause();}throw Error('UI wait failed: '+expression+'\n'+await evaluate('document.body.innerText'));};
 const click=label=>evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!el)throw Error('Button missing');el.click();})()`);
 const fill=(label,value)=>evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const el=l?.querySelector('input,textarea,select');if(!el)throw Error('Input missing');const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:base+'spieltag-fixture'});
 await wait(`document.body.innerText.includes('Spieltermin eintragen')`);
 await click('Spieltermin eintragen');await fill('Runde','Runde 1');await fill('Gegnerische Mannschaft','Gastmannschaft');await fill('Datum und Uhrzeit','2026-11-08T11:00');await fill('Spielort','Bochum');await click('Termin speichern');
 await wait(`document.querySelector('[role="tablist"]')`);assert.equal(await evaluate(`JSON.parse(window.fixtureCalls.find(c=>c.method==='POST').body).starts_at`),'2026-11-08T10:00:00.000Z');
 await click('Brett hinzufügen');await fill('Eigene Spielerin','Home player');await fill('Gegnerin / Gegner','Guest player');await fill('Gegnerische FIDE-ID','13404431');await click('Brett speichern');await wait(`document.body.innerText.includes('Home player')`);
 await click('Gegner');await wait(`document.body.innerText.includes('Guest player')`);await click('Spielerkarte · 13404431');await wait(`document.body.innerText.includes('Fixture FIDE Player')`);await click('Karte schließen');await fill('Lichess-Benutzername des Gegners','target_user');await click('Lichess-Zuordnung speichern');await wait(`document.body.innerText.includes('Lichess-Konto: target_user (nicht verifiziert)')`);
 await click('Nach der Runde');await fill('Ergebnis','1/2-1/2');await wait(`window.fixtureCalls.some(c=>c.body&&JSON.parse(c.body).result==='1/2-1/2')`);await fill('Kurze Notizen','Gut gespielt!');await click('Notizen speichern');await wait(`window.fixtureCalls.some(c=>c.body&&JSON.parse(c.body).notes==='Gut gespielt!')`);
 // Primary source: a private opponent FIDE link loads named archives automatically.
 await click('Gegner');await click('Vorbereitung');await wait(`document.body.innerText.includes('2 importierte Partien')`);
 assert.equal(await evaluate(`window.fixtureCalls.filter(c=>c.path==='/api/vorbereitung/player').length`),1);
 await wait(`document.body.innerText.includes('Namenszuordnung (nicht verifiziert)')`);
 await fill('Eröffnung oder Variante','A05');await wait(`document.body.innerText.includes('2 passende Partien')`);await fill('Eröffnung oder Variante','Najdorf');await wait(`document.body.innerText.includes('Keine Partien in dieser Variante')`);await fill('Eröffnung oder Variante','');
 await fill('Züge (SAN','1.Sf3 d5 2.g3 Sf6');await click('Züge suchen');await wait(`document.body.innerText.includes('2 Partien erreichten diese Stellung')&&[...document.querySelectorAll('button')].some(b=>b.textContent==='Bg2')`);
 await click('Bg2');await wait(`document.querySelector('[aria-label="g2 wB"]')`);await wait(`document.body.innerText.includes('2 Partien erreichten diese Stellung')`);
 await click('Stellung aufstellen');await fill('FEN','8/8/8/8/8/8/8/8 w - - 0 1');await click('Stellung suchen');await wait(`document.body.innerText.includes('Ungültige Stellung')`);
 await fill('FEN','rnbqkb1r/ppp1pppp/5n2/3p4/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq - 0 3');await click('Stellung suchen');await wait(`!document.body.innerText.includes('Ungültige Stellung')&&document.body.innerText.includes('2 Partien erreichten diese Stellung')`);
 // Palette and touch-sized board buttons support free setup and ordinary moves.
 await click('Brett leeren');await evaluate(`document.querySelector('[aria-label="wK"]').click()`);await evaluate(`document.querySelector('[aria-label^="e1 "]').click()`);await evaluate(`document.querySelector('[aria-label="bK"]').click()`);await evaluate(`document.querySelector('[aria-label^="e8 "]').click()`);await click('Stellung suchen');await wait(`document.body.innerText.includes('0 Partien erreichten diese Stellung')`);
 await click('Grundstellung');await click('Züge spielen');await evaluate(`document.querySelector('[aria-label^="g1 "]').click()`);await evaluate(`document.querySelector('[aria-label^="f3 "]').click()`);await wait(`document.querySelector('[aria-label="f3 wN"]')`);
 await fill('Züge (SAN','1.Sf3 d5 2.g3 Sf6');await click('Züge suchen');await wait(`document.body.innerText.includes('2 Partien erreichten diese Stellung')`);
 for(const width of [390,1280]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await pause();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));}
 await click('In ChessAZ analysieren');await wait(`document.getElementById('analysis-landed')`);assert.equal(await evaluate('window.fixtureAnalysisPly()'),4);assert.equal((await evaluate('window.fixtureAnalysis()')).length,6);
 await evaluate(`window.fixtureNavigate('/')`);await wait(`document.querySelector('[role="tablist"]')`);await click('Gegner');await click('Lichess-Konto vorbereiten');
 await wait(`document.querySelector('details input')?.value==='target_user'`);await click('Partien laden');await wait(`document.querySelector('details').innerText.includes('Najdorf')`);
 await evaluate(`window.changeSession('member-test-only')`);await wait(`document.querySelector('details input')?.value===''`);assert.equal(await evaluate(`document.body.innerText.includes('Najdorf')`),false);await evaluate(`window.changeSession('captain-test-only')`);await fill('Lichess-Benutzername','target_user');await click('Partien laden');await wait(`document.querySelector('details').innerText.includes('Najdorf')`);
 // Scope secondary filters so their values cannot leak into the primary search.
 const fillSecondary=(value)=>evaluate(`(()=>{const el=document.querySelector('details input[placeholder="Najdorf oder B90"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await fillSecondary('Najdorf');await wait(`document.querySelector('details').innerText.includes('1 passende Partien')`);await fillSecondary('B90');await wait(`document.querySelector('details').innerText.includes('1 passende Partien')`);
 await fillSecondary('B99');await wait(`document.querySelector('details').innerText.includes('Keine Partien in dieser Variante')`);await fillSecondary('B90');await click('In ChessAZ analysieren');await wait(`document.getElementById('analysis-landed')`);assert.deepEqual(await evaluate('window.fixtureAnalysis()'),['e4','c5','Nf3','d6']);
 await evaluate(`window.fixtureNavigate('/')`);await wait(`document.querySelector('[role="tablist"]')`);
 // Same components at both viewport sizes: no horizontal overflow.
 for(const width of [390,1280]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await pause();assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));}
 await evaluate(`window.changeSession('member-test-only')`);await wait(`document.body.innerText.includes('Nur für bestätigte Mannschaftsmitglieder')`);await click('Nach der Runde');await wait(`document.body.innerText.includes('Gut gespielt!')`);assert.equal(await evaluate('document.querySelectorAll(".spieltag-form").length'),0);assert.equal(await evaluate(`document.body.innerText.includes('Brett hinzufügen')`),false);
 await evaluate(`window.changeSession('captain-test-only')`);await wait(`document.querySelector('[role="tablist"]')`);await click('Gegner');await evaluate('window.delayCard=true');await click('Spielerkarte · 13404431');await wait('typeof window.releaseCard==="function"');await evaluate(`window.changeSession('outsider-test-only');window.releaseCard()`);await wait(`document.body.innerText.includes('noch keiner Mannschaft zugeordnet')`);assert.equal(await evaluate(`document.body.innerText.includes('Guest player')||document.body.innerText.includes('Fixture FIDE Player')`),false);
 await evaluate('window.changeSession(null)');await wait(`document.body.innerText.includes('Bitte zuerst anmelden')`);assert.equal(exceptions.length,0,exceptions.join('\n'));
 console.log('PASS Spieltag/Vorbereitung browser: captain schedule/lineup/opponents/card/results/notes, primary FIDE/name fallback, German moves/transpositions, next moves, FEN/setup/palette/illegal position, matched-ply analysis, secondary nickname/name/ECO/empty, member read-only, 390/1280 widths, identity changes and stale-card cleanup');
}finally{
 try{ws?.close();}catch{}chrome?.kill('SIGKILL');await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});clearTimeout(deadline);
}
