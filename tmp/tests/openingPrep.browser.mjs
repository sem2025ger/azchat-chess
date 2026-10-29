import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {openingPrepCopy} from '../src/i18n/openingPrepCopy.ts';
const fixture=String.raw`
import '/src/index.css';import '/src/screens/SpielerScreen.css';import '/src/styles/sections.css';import React,{useState}from'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route}from'react-router-dom';
import{LanguageProvider,useLanguage}from'/src/context/LanguageContext.tsx';import OpeningPrep from'/src/components/spieler/OpeningPrep.tsx';import{loadAnalysisSession}from'/src/utils/analysisSession.ts';import{Chess}from'chess.js';
localStorage.setItem('app-language','de');window.calls=[];window.responseMode='ready';window.analysis=()=>loadAnalysisSession();
const native=window.fetch;
window.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://coach-fixture.invalid/'))return native(url,options);
 const body=JSON.parse(options.body);window.calls.push({body,headers:options.headers,cache:options.cache});
 if(window.responseMode==='hold')await new Promise(resolve=>window.release=resolve);
 if(!['ready','hold'].includes(window.responseMode))return Response.json({code:window.responseMode},{status:400});
 const board=new Chess();for(const move of body.moves.split(' '))board.move(move);const moves=board.history(),ply=moves.length,turn=board.turn()==='w'?'white':'black';
 const transposed=body.moves==='Nf3 d5 g3 Nf6';const rest=body.moves==='e4'?['e5','Nf3','Nc6']:transposed?['Bg2','e6']:['c4','e6','Nc3'];
 const model=new Chess();for(const move of transposed?'Nf3 Nf6 Ng1 Ng8 g3 d5 Nf3 Nf6 Bg2 e6'.split(' '):[...moves,...rest])model.move(move);
 const game={id:'synthetic',pgn:model.pgn(),ply:transposed?8:ply,white:'Synthetic White',black:'Synthetic Black',event:'Synthetic',date:'2026-10-29',result:'*',first25:model.history()};
 return Response.json({opening:'custom',color:body.color,moves,ply,turn,matched:1,inspected:1,briefing:null,groups:[{move:rest[0],replyColor:turn==='white'?'black':'white',replies:[{move:rest[1],count:1}],games:[game]}]});
};
function App(){const{setLanguage}=useLanguage();const[token,setToken]=useState('synthetic-only');window.setToken=setToken;window.language=setLanguage;return <main className='spieler-page section-page'><Routes><Route path='/' element={<OpeningPrep token={token}/>}/><Route path='/game' element={<p id='analysis-landed'>Analysis</p>}/></Routes></main>;}
createRoot(document.getElementById('root')).render(<LanguageProvider><MemoryRouter><App/></MemoryRouter></LanguageProvider>);
`;
export async function checkOpeningPrep({captureRoot}={}){
 const caches=[];let server,chrome,ws,profile;const pending=new Map();
 async function makeServer(enabled){const cacheDir=await mkdtemp(join(tmpdir(),'chessaz-coach-vite-'));caches.push(cacheDir);return createServer({configFile:false,cacheDir,plugins:[{name:'coach-fixture',resolveId(id){if(id==='/__coach.tsx')return id;},load(id){if(id==='/__coach.tsx')return fixture;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.url!=='/coach-fixture')return next();res.setHeader('content-type','text/html');res.end(await vite.transformIndexHtml('/coach-fixture','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#202020"><div id="root"></div><script type="module" src="/__coach.tsx"></script></body></html>'));});}},react()],server:{host:'127.0.0.1',port:0,hmr:false},define:{'import.meta.env.VITE_AI_COACH_ENABLED':JSON.stringify(String(enabled)),'import.meta.env.VITE_SERVER_URL':JSON.stringify('https://coach-fixture.invalid')}});}
 try{
 server=await makeServer(false);await server.listen();let base=server.resolvedUrls.local[0];
 const binary=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(binary,'Chromium required');
 profile=await mkdtemp(join(tmpdir(),'chessaz-spieltag-'));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,...JSON.parse(process.env.CHROME_ARGS||'[]'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 let stderr='';chrome.stderr.on('data',c=>{stderr=(stderr+c).slice(-4000);});
 const pause=()=>new Promise(r=>setTimeout(r,50));let port;
 for(let i=0;i<200;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await pause();}assert.ok(port,stderr);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const exceptions=[];
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout '+method));},15000);pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({id:request,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate("Boolean(document.body && ("+expression+"))"))return;await pause();}throw Error('UI wait failed: '+expression+'\n'+await evaluate('document.body.innerText'));};
 const click=label=>evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)}));if(!el)throw Error('Button missing');for(let d=el.closest('details');d;d=d.parentElement?.closest('details'))if(!d.open)d.querySelector(':scope > summary').click();el.click();})()`);
 const fill=(label,value)=>evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const el=l?.querySelector('input,textarea,select');if(!el){const f=[...document.querySelectorAll('fieldset')].find(f=>f.querySelector('legend')?.textContent.startsWith(${JSON.stringify(label)}));const b=f?.querySelector('button[data-value="'+${JSON.stringify(value)}+'"]');if(!b)throw Error('Input missing');b.click();return;}for(let d=el.closest('details');d;d=d.parentElement?.closest('details'))if(!d.open)d.querySelector(':scope > summary').click();const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);

 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:base+'coach-fixture'});
 await wait(`typeof window.language==='function'`);assert.equal(await evaluate(`!!document.querySelector('.chessaz-ai-coach')`),false);assert.equal(await evaluate('window.calls.length'),0);
 await server.close();server=await makeServer(true);await server.listen();base=server.resolvedUrls.local[0];await cdp('Page.navigate',{url:base+'coach-fixture'});await wait(`document.querySelector('.chessaz-ai-coach input')`);
 await fill(openingPrepCopy.de.input,'d4 d5');
 for(const width of [1280,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});
  for(const lang of ['de','en','ru','az','tr','ua']){
   const t=openingPrepCopy[lang==='ua'?'uk':lang];await evaluate('window.language('+JSON.stringify(lang)+')');await wait('document.querySelector(".chessaz-ai-coach input").getAttribute("aria-label")==='+JSON.stringify(t.input));
   assert.deepEqual(await evaluate(`[...document.querySelectorAll('.chessaz-ai-coach option')].map(e=>e.textContent)`),[t.white,t.black]);
   await click(t.start);await wait(`document.querySelector('.chessaz-ai-coach-results')`);await evaluate(`document.querySelector('.chessaz-ai-coach-group').open=true`);
   const text=await evaluate(`document.querySelector('.chessaz-ai-coach').innerText`);for(const key of ['desc','hint','whiteTurn','blackReplies','sample','noAi','moves'])assert.ok(text.includes(t[key]),lang+': '+key);
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'overflow '+lang+' '+width);
   const call=await evaluate('window.calls.at(-1)');assert.equal(call.body.language,lang==='ua'?'uk':lang);assert.equal(call.headers.Authorization,'Bearer synthetic-only');assert.equal(call.cache,'no-store');
  }
 }
 const t=openingPrepCopy.ru;
 await evaluate(`window.language('ru')`);await wait(`document.querySelector('.chessaz-ai-coach input').getAttribute('aria-label')===${JSON.stringify(t.input)}`);
 await fill(t.input,'e4');await fill(t.color,'white');await click(t.start);await wait(`document.querySelector('.chessaz-ai-coach-results')`);await evaluate(`document.querySelector('details').open=true`);assert.ok((await evaluate('document.body.innerText')).includes(t.whiteReplies));assert.ok((await evaluate('document.body.innerText')).includes(t.blackTurn));
 for(const [code,key]of [['invalid_query','invalid'],['index_warming','warming'],['rate_limit','rate'],['authentication_required','auth']]){
  await evaluate('window.responseMode='+JSON.stringify(code));await click(t.start);await wait(`document.querySelector('[role=alert]')?.textContent===${JSON.stringify(t[key])}`);
 }
 await evaluate(`window.responseMode='hold'`);await click(t.start);await wait(`typeof window.release==='function'`);await fill(t.input,'d4 d5');await evaluate(`window.release()`);assert.equal(await evaluate(`!!document.querySelector('.chessaz-ai-coach-results')`),false);assert.equal(await evaluate(`document.querySelector('.chessaz-ai-coach button').disabled`),false);
 await evaluate(`window.setToken('')`);await wait(`document.querySelector('[role=status]')?.textContent===${JSON.stringify(t.auth)}`);assert.equal(await evaluate(`document.querySelector('.chessaz-ai-coach button').disabled`),true);
 await evaluate(`window.setToken('synthetic-only');window.responseMode='ready'`);await fill(t.input,'Nf3 d5 g3 Nf6');await click(t.start);await wait(`document.querySelector('.chessaz-ai-coach-results')`);await evaluate(`document.querySelector('details').open=true`);
 if(captureRoot){await mkdir(captureRoot,{recursive:true});const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(captureRoot,'opening-prep-ru-mobile.png'),Buffer.from(shot.data,'base64'));}
 await click(t.open);await wait(`document.querySelector('#analysis-landed')`);assert.equal(await evaluate('window.analysis().viewMoveIndex'),8,'analysis opens at indexed ply, including transpositions');assert.equal((await evaluate('window.analysis().moveHistory')).length,10);
 assert.deepEqual(exceptions,[]);console.log('PASS OpeningPrep: six locales, both colors/turns, errors, stale response cancellation, default-off, mobile overflow and indexed analysis handoff');
 }finally{for(const p of pending.values())clearTimeout(p.timer);ws?.close();chrome?.kill('SIGKILL');await server?.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});for(const dir of caches)await rm(dir,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkOpeningPrep({captureRoot:process.env.COACH_CAPTURE});
