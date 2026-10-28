import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
const fixture=String.raw`
import '/src/index.css';import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route}from'react-router-dom';import{ThemeProvider}from'/src/context/ThemeContext.tsx';import{LanguageProvider,useLanguage}from'/src/context/LanguageContext.tsx';import Screen from'/src/screens/SpielerScreen.tsx';import{loadAnalysisSession}from'/src/utils/analysisSession.ts';
localStorage.setItem('app-language','de');window.positionCalls=[];window.responseMode='ready';const native=window.fetch;
const pgn='[Event "Synthetic"]\n[White "White player"]\n[Black "Black player"]\n[Result "0-1"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 0-1';
window.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://positions-fixture.invalid/'))return native(url,options);
 const u=new URL(url);window.positionCalls.push({path:u.pathname,query:u.search,headers:options.headers});
 if(u.pathname==='/api/spieler/search')return Response.json({players:[{fide_id:202,name:'Synthetic, Player',title:null,fide_rating:2100,club:null}]});
 if(window.responseMode==='warming')return Response.json({code:'index_warming'},{status:503,headers:{'Retry-After':'5'}});
 return Response.json({games:[['new','2026-09-30'],['old','2026-04-01']].map(([id,date])=>({id,pgn,white:'White '+id,black:'Black '+id,whiteFideId:'101',blackFideId:'202',whiteRating:null,blackRating:null,event:'Synthetic',date,result:'0-1',ply:10,perspective:'black',outcome:'win',source:'lichess-broadcast',sourceUrl:'https://database.lichess.org/broadcast/lichess_db_broadcast_2026-09.pgn.zst',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'})),total:2,nextMoves:[{move:'Be3',count:2,winPct:100,drawPct:0,lossPct:0}],side:'black',perspective:'black',maxIndexedPlies:60,searchMs:4});
};
function Locales(){const{setLanguage}=useLanguage();return <nav>{['en','de','az','tr','ua','ru'].map(lang=><button key={lang} data-test-locale={lang} onClick={()=>setLanguage(lang)}>{lang}</button>)}</nav>;}window.positionAnalysis=()=>loadAnalysisSession()?.viewMoveIndex;
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter><Locales/><Routes><Route path='/' element={<Screen/>}/><Route path='/game' element={<p id='analysis-landed'>Analysis</p>}/></Routes></MemoryRouter></LanguageProvider></ThemeProvider>);
`;
const cacheDirs=[];
async function makeServer(enabled){const cacheDir=await mkdtemp(join(tmpdir(),'chessaz-position-vite-'));cacheDirs.push(cacheDir);const plugin={name:'position-browser-fixture',enforce:'pre',resolveId(id){if(id==='/__positions.tsx')return id;if(id==='../context/AuthContext')return '\0position-auth';},load(id){if(id==='/__positions.tsx')return fixture;if(id==='\0position-auth')return `export function useAuth(){return{session:{access_token:'synthetic-test-token'}};}`;},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/position-fixture')return next();res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/position-fixture','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#202020"><div id="root"></div><script type="module" src="/__positions.tsx"></script></body></html>'));});}};return createServer({configFile:false,cacheDir,plugins:[plugin,react()],server:{host:'127.0.0.1',port:0,hmr:false},define:{'import.meta.env.VITE_SERVER_URL':JSON.stringify('https://positions-fixture.invalid'),'import.meta.env.VITE_POSITION_SEARCH_ENABLED':JSON.stringify(String(enabled)),'import.meta.env.VITE_CLUBS_NRW_ENABLED':JSON.stringify('false')}});}
let server=await makeServer(false);
let chrome,ws,profile;const deadline=setTimeout(()=>{chrome?.kill('SIGKILL');console.error('Position browser deadline exceeded');process.exit(1);},120000);
try{
 await server.listen();let base=server.resolvedUrls.local[0];
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
 const click=label=>evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!el)throw Error('Button missing');for(let d=el.closest('details');d;d=d.parentElement?.closest('details'))if(!d.open)d.querySelector(':scope > summary').click();el.click();})()`);
 const fill=(label,value)=>evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const el=l?.querySelector('input,textarea,select');if(!el)throw Error('Input missing');for(let d=el.closest('details');d;d=d.parentElement?.closest('details'))if(!d.open)d.querySelector(':scope > summary').click();const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:base+'position-fixture'});
 await wait(`document.querySelector('.spieler-search')`);assert.equal(await evaluate(`Boolean(document.querySelector('.global-position-search'))`),false,'flag off preserves Spieler');
 await server.close();server=await makeServer(true);await server.listen();base=server.resolvedUrls.local[0];await cdp('Page.navigate',{url:base+'position-fixture'});
 await wait(`document.querySelector('.global-position-search')`);assert.ok(await evaluate(`document.querySelector('.global-position-search').compareDocumentPosition(document.querySelector('.spieler-search'))&Node.DOCUMENT_POSITION_FOLLOWING`),'card above name search');
 const {default:ts}=await import('typescript');
 const copy={};for(const [path,name]of [['../src/i18n/sectionCopy.ts','sectionCopy'],['../src/i18n/regionalCopy.ts','regionalCopy']]){const text=await readFile(new URL(path,import.meta.url),'utf8'),ast=ts.createSourceFile(path,text,99,true);const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)Object.assign(copy,Function('return ('+n.initializer.getText(ast)+')')());ts.forEachChild(n,visit);};visit(ast);}
 const visibleText=()=>evaluate(`document.querySelector('.global-position-search').innerText+' '+[...document.querySelectorAll('.global-position-search [aria-label]')].map(e=>e.getAttribute('aria-label')).join(' ')`);
 async function locales(keys){for(const lang of ['en','az','tr','ua','ru','de']){await evaluate("document.querySelector('[data-test-locale="+lang+"]').click()");await wait("document.querySelector('.preparation-position h2').textContent==="+JSON.stringify(copy['Nach Zügen oder Stellung suchen'][lang]));const text=await visibleText();for(const key of keys){assert.ok(text.includes(copy[key][lang]),key+': '+lang);if(copy[key][lang]!==copy[key].de)assert.equal(text.includes(copy[key].de),false,'German outside de: '+key+': '+lang);}}}
 await fill('Züge (SAN','1.e4 invalid');await click('Züge suchen');await wait(`document.body.innerText.includes('Ungültige Zugfolge')`);
 await locales(['Nach Zügen oder Stellung suchen','Züge spielen','Stellung aufstellen','Grundstellung','Umwandlung','Dame','Turm','Läufer','Springer','Züge (SAN oder deutsche Figurenbuchstaben)','Züge suchen','Vorbereitungsbrett','leer','Ungültige Zugfolge','Stellung in allen importierten Partien suchen','Meine Farbe','Stellung in der Datenbank suchen','Spielerfilter (optional)']);
 await fill('Züge (SAN','1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6');await click('Züge suchen');await fill('Meine Farbe','black');
 await click('Stellung aufstellen');await click('Brett leeren');await click('Stellung suchen');await wait(`document.body.innerText.includes('Ungültige Stellung')`);
 await locales(['Nach Zügen oder Stellung suchen','Züge spielen','Stellung aufstellen','Grundstellung','Figurenpalette','Entfernen','Brett leeren','Am Zug','Weiß','Schwarz','Rochaderechte','Stellung suchen','leer','Ungültige Stellung']);
 await click('Züge spielen');await click('Züge suchen');await click('Stellung in der Datenbank suchen');await wait(`document.querySelectorAll('.global-position-results li').length===2`);
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('.global-position-results li strong')].map(e=>e.textContent)`),['White new – Black new','White old – Black old']);
 assert.equal(await evaluate(`new URLSearchParams(window.positionCalls.at(-1).query).get('side')`),'black');assert.ok(await evaluate(`window.positionCalls.at(-1).headers.Authorization==='Bearer synthetic-test-token'`));
 await evaluate(`window.responseMode='warming'`);await click('Stellung in der Datenbank suchen');await wait(`document.body.innerText.includes('Die Suche wird vorbereitet.')`);await locales(['Die Suche wird vorbereitet. Bitte versuche es in wenigen Sekunden erneut.']);
 await evaluate(`window.responseMode='ready'`);await click('Stellung in der Datenbank suchen');await wait(`document.querySelectorAll('.global-position-results li').length===2`);
 for(const width of [390,1280]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'no overflow '+width);}
 await click('In ChessAZ analysieren');await wait(`document.getElementById('analysis-landed')`);assert.equal(await evaluate('window.positionAnalysis()'),10,'matched ply in analysis');
 assert.equal(exceptions.length,0,exceptions.join('\n'));
 console.log('PASS global position browser: actual Spieler flag off/on, card above name search, newest first, matched ply 10, request side, 503 warming, moves/setup/errors/aria in all six languages, 390/1280 widths');
}finally{try{ws?.close();}catch{}chrome?.kill('SIGKILL');await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});for(const dir of cacheDirs)await rm(dir,{recursive:true,force:true});clearTimeout(deadline);}
