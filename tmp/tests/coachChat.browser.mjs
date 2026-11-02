import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';import {Chess} from 'chess.js';
import {coachChatCopy} from '../src/i18n/coachChatCopy.ts';
import {formatEngineScore} from '../src/utils/engineLines.ts';
const require=createRequire(new URL('../../server/package.json',import.meta.url)),express=require('express'),{WebSocket,WebSocketServer}=require('ws');
const {installAiCoach}=require('./aiCoach.js');
const fixture=String.raw`
import '/src/index.css';import React,{useState}from'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route,useNavigate}from'react-router-dom';import{LanguageProvider,useLanguage}from'/src/context/LanguageContext.tsx';import CoachChat from'/src/components/spieler/CoachChat.tsx';import GlobalPositionSearch from'/src/components/spieler/GlobalPositionSearch.tsx';import OpeningPrep from'/src/components/spieler/OpeningPrep.tsx';import{ThemeProvider}from'/src/context/ThemeContext.tsx';import{clearPositionSearchState}from'/src/utils/positionSearchState.ts';import{loadAnalysisSession}from'/src/utils/analysisSession.ts';
localStorage.setItem('app-language','de');window.streams=[];window.mode='ready';const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia=async(...args)=>{if(window.mode==='denied')throw new DOMException('fixture denial','NotAllowedError');const stream=await original(...args);window.streams.push(stream);if(window.mode==='permission-hold')await new Promise(r=>window.releasePermission=r);return stream;};
function App(){const{setLanguage}=useLanguage();const[token,setToken]=useState('synthetic-user'),[fen,setFen]=useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');const[account,setAccount]=useState('account-initial'),[workspace,setWorkspace]=useState(false);window.setWorkspace=setWorkspace;window.navigate=useNavigate();window.analysis=loadAnalysisSession;window.language=setLanguage;window.setToken=setToken;window.setAccount=setAccount;window.logout=()=>{clearPositionSearchState();setAccount('guest');setToken('');};window.setFen=setFen;return <Routes><Route path='/game' element={<div id='analysis-fixture'>Analysis route</div>}/><Route path='/' element={<main style={{maxWidth:390,padding:10,margin:'auto'}}>{workspace?<GlobalPositionSearch key={account} accountId={account} token={token} coach={(color,onColorChange,onPreparedMoves)=><OpeningPrep token={token} accountId={account} color={color} onColorChange={onColorChange} onPreparedMoves={onPreparedMoves}/>}/>:<CoachChat key={account} accountId={account} token={token} fen={fen} side='white'/>}</main>}/></Routes>;}
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter><App/></MemoryRouter></LanguageProvider></ThemeProvider>);
`;
export async function checkCoachChat({captureRoot}={}){
 let server,api,chrome,ws,profile,cacheDir,wss;const pending=new Map(),calls=[],exceptions=[];let clock=0,mode='ready',release;
 try{
 wss=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>wss.once('listening',r));
 wss.on('connection',(socket,req)=>{assert.equal(req.headers.authorization,'Bearer synthetic-provider');socket.on('message',raw=>{const event=JSON.parse(raw);
  if(event.type==='session.update')socket.send(JSON.stringify({type:'session.updated'}));
  if(event.type==='response.create'){calls.push({kind:'speech',body:event.response});const pcm=Buffer.alloc(4800);for(let i=0;i<2400;i++)pcm.writeInt16LE(Math.round(800*Math.sin(i*Math.PI*2*440/24000)),i*2);socket.send(JSON.stringify({type:'response.output_audio.delta',delta:pcm.toString('base64')}));const finish=()=>socket.send(JSON.stringify({type:'response.done',response:{status:mode==='speech-error'?'incomplete':'completed'}}));if(mode==='hold-speech')release=finish;else finish();}
 });});
 const app=express();app.use((req,res,next)=>{res.set('Access-Control-Allow-Origin','*');res.set('Access-Control-Allow-Headers','Authorization,Content-Type');if(req.method==='OPTIONS')return res.sendStatus(204);next();});
 // Synthetic public position search: archive appears only after explicit user request.
 app.get('/api/positions/search',(req,res)=>res.json({total:1,nextMoves:[],games:[{
  id:'public-fixture',source:'lichess-broadcast',pgn:'1. e4 e5',ply:0,
  white:'Fixture White',black:'Fixture Black',result:'*'
 }]}));
 // Simulate the isolated older QA backend; it rejects the new optional field.
 app.post('/api/ai-coach/chat',express.json({limit:'16kb'}),(req,res,next)=>{
  if(mode!=='legacy-chat')return next();
  if(req.body?.candidateLines)return res.status(400).json({code:'invalid_query'});
  return res.json({answer:'Legacy Coach explanation without Stockfish evidence.',generated:true,
   games:[{id:'legacy-game',white:'Fixture White',black:'Fixture Black',pgn:'1. e4 e5',ply:0,result:'*'}]});
 });
 // Simulate the backend with AI_COACH_SERVER_ENGINE_ENABLED=true: its own verified lines in engineLines.
 let serverLines=null;
 app.post('/api/ai-coach/chat',express.json({limit:'16kb'}),(req,res,next)=>{
  if(!['server-lines','server-lines-malformed','server-lines-other-fen'].includes(mode))return next();
  const board=new Chess(req.body.fen),first=board.moves()[0];board.move(first);const reply=board.moves()[0];
  const second=new Chess(req.body.fen).moves()[1];
  serverLines=[{id:'L1',moves:[first,reply],scoreKind:'cp',scoreWhite:43,depth:15,wdlWhite:[95,902,3]},{id:'L2',moves:[second],scoreKind:'mate',scoreWhite:-2,depth:15,wdlWhite:[0,0,1000]}];
  return res.json({answer:'Server-grounded explanation.',generated:true,games:[],engineVerified:true,candidateLines:req.body.candidateLines||[],
   position:mode==='server-lines-other-fen'?new Chess().fen():req.body.fen,
   engineLines:mode==='server-lines-malformed'?[{...serverLines[0],moves:['Ke8']}]:serverLines});
 });
 installAiCoach(app,{enabled:true,index:{status:'ready',search:async()=>({total:1,games:[{id:'public-fixture',source:'lichess-broadcast',pgn:'1. e4 e5',ply:0,white:'Fixture White',black:'Fixture Black',result:'*'}],nextMoves:[{move:'e4',count:1}]})},verifyToken:async token=>token.startsWith('synthetic-')?{id:token}:null,openaiApiKey:'synthetic-provider',now:()=>clock,
  socketFactory:(url,options)=>{assert.equal(new URL(url).hostname,'api.openai.com');return new WebSocket('ws://127.0.0.1:'+wss.address().port,options);},
  fetchImpl:async(url,options)=>{
   const transcription=url.endsWith('transcriptions');assert.equal(url,transcription?'https://api.openai.com/v1/audio/transcriptions':'https://api.openai.com/v1/responses');
   if(transcription){assert.ok(options.body.get('file').size>16);calls.push({kind:'transcribe',language:options.body.get('language')});if(mode==='hold-transcribe')await new Promise(r=>release=r);return Response.json({text:'How should I develop my pieces?'});}
   const body=JSON.parse(options.body),input=JSON.parse(body.input);calls.push({kind:'chat',body:input,instructions:body.instructions});if(mode==='hold-chat')await new Promise(r=>release=r);if(mode==='error')return new Response('SECRET provider error',{status:401});
   return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Fixture answer: '+input.question})}]}]});
  }});
 api=app.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
 cacheDir=await mkdtemp(join(tmpdir(),'chessaz-chat-vite-'));
 const makeServer=enabled=>createServer({configFile:false,envDir:false,cacheDir,plugins:[{name:'coach-chat-fixture',resolveId(id){if(id==='/__coach-chat.tsx')return id;},load(id){if(id==='/__coach-chat.tsx')return fixture;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.url!=='/coach-chat-fixture')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/coach-chat-fixture','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#202020;color:white"><div id="root"></div><script type="module" src="/__coach-chat.tsx"></script></body></html>'));});}},react()],server:{host:'127.0.0.1',port:0,hmr:false},define:{'import.meta.env.VITE_AI_COACH_ENABLED':JSON.stringify(String(enabled)),'import.meta.env.VITE_SERVER_URL':JSON.stringify('http://127.0.0.1:'+api.address().port)}});server=await makeServer(false);await server.listen();
 const binary=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(binary,'Chromium required');profile=await mkdtemp(join(tmpdir(),'chessaz-chat-chrome-'));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,...JSON.parse(process.env.CHROME_ARGS||'[]'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 let stderr='';chrome.stderr.on('data',c=>stderr=(stderr+c).slice(-4000));const pause=()=>new Promise(r=>setTimeout(r,50));let port;
 for(let i=0;i<200;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await pause();}assert.ok(port,stderr);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new globalThis.WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout '+method));},15000);pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({id:request,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate('Boolean('+expression+')'))return;await pause();}throw Error('UI wait failed: '+expression+'\n'+await evaluate('document.body.innerText'));};
 const click=label=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!button||button.disabled)throw Error('Active button missing');button.click();})()`);
 const fill=text=>evaluate(`(()=>{const el=document.querySelector('.coach-chat-compose input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');await cdp('Network.setBlockedURLs',{urls:['https://*','wss://*']});await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'coach-chat-fixture'});await wait('typeof window.setToken==="function"');assert.equal(await evaluate('!!document.querySelector(".coach-chat")'),false,'Coach chat defaults off');assert.equal(calls.length,0);await server.close();server=await makeServer(true);await server.listen();await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'coach-chat-fixture'});await wait('document.querySelector(".coach-chat-toggle")');
 for(const width of [390,1280]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});for(const lang of ['de','en','az','tr','ua','ru']){
  const t=coachChatCopy[lang==='ua'?'uk':lang];clock+=61000;await evaluate('window.language('+JSON.stringify(lang)+');window.setToken('+JSON.stringify('synthetic-'+width+'-'+lang)+');window.setAccount('+JSON.stringify('account-'+width+'-'+lang)+')');await wait('document.querySelector(".coach-chat-toggle").textContent==='+JSON.stringify(t.title));if(!await evaluate('!!document.querySelector(".coach-chat-panel")'))await click(t.title);
  await fill('Study the centre');await click(t.send);await wait('document.querySelector(".coach-chat-message.assistant")');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'fit '+lang+' '+width);assert.ok(!(await evaluate('document.body.innerText')).includes(t.privacy));assert.equal(calls.at(-1).body.position,new Chess().fen());assert.equal(calls.at(-1).body.history.length,0);
 }}
 const t=coachChatCopy.ru;await fill('Explain it more simply');await click(t.send);await wait('document.querySelectorAll(".coach-chat-message.assistant").length===2');assert.equal(calls.at(-1).body.history.length,2);
 // Archive navigation requires an explicit search; teaching alone does not open games.
 await fill('Find five games');await click(t.send);await wait('document.querySelector(".coach-chat-games")');
 // Returning from analysis restores the exact conversation, public games, draft and scroll,
 // without another model/audio request. Rotation of a bearer token keeps the same account.
 await evaluate('document.querySelector(".coach-chat-games summary").click()');await wait('document.querySelector(".coach-chat-games").open');
 await fill('Keep this draft');await evaluate('document.querySelector(".coach-chat-history").scrollTop=10');await pause();
 const savedText=await evaluate('document.querySelector(".coach-chat-history").innerText'),savedScroll=await evaluate('document.querySelector(".coach-chat-history").scrollTop'),beforeNavigation=calls.length;
 await evaluate('document.querySelector(".coach-chat-games button").click()');await wait('document.querySelector("#analysis-fixture")');assert.equal(await evaluate('window.analysis().viewMoveIndex'),0);
 await evaluate('window.navigate(-1)');await wait('document.querySelector(".coach-chat-compose input")');await wait('document.querySelector(".coach-chat-games")');await evaluate('document.querySelector(".coach-chat-games").open=true');assert.equal(await evaluate('document.querySelector(".coach-chat-history").innerText'),savedText);assert.equal(await evaluate('document.querySelector(".coach-chat-compose input").value'),'Keep this draft');assert.equal(await evaluate('document.querySelector(".coach-chat-history").scrollTop'),savedScroll);assert.equal(calls.length,beforeNavigation);
 await evaluate('window.setToken("synthetic-rotated")');await pause();assert.equal(await evaluate('document.querySelector(".coach-chat-history").innerText'),savedText);assert.ok(!(await evaluate('JSON.stringify(sessionStorage)')).includes('synthetic-rotated'),'bearer token is never persisted');
 await evaluate('window.setAccount("other-account")');await wait('document.querySelectorAll(".coach-chat-message").length===0');await click(t.title);assert.equal(await evaluate('document.querySelector(".coach-chat-compose input").value'),'');await evaluate('window.setAccount("account-1280-ru")');await wait('document.querySelectorAll(".coach-chat-message.assistant").length===3');
 // Switching the site language keeps the same position conversation and draft.
 const beforeLanguageSwitch=calls.length, beforeLanguageText=await evaluate('JSON.stringify([...document.querySelectorAll(".coach-chat-message > p")].map(p=>p.textContent))');
 await evaluate('window.language("de")');
 await wait('document.querySelector(".coach-chat-toggle").textContent==='+JSON.stringify(coachChatCopy.de.title));
 assert.equal(await evaluate('JSON.stringify([...document.querySelectorAll(".coach-chat-message > p")].map(p=>p.textContent))'),beforeLanguageText,'previous message text is unchanged');
 assert.equal(await evaluate('document.querySelector(".coach-chat-copy").textContent'),coachChatCopy.de.copyAnswer,'controls translate into German');
 assert.equal(await evaluate('document.querySelector(".coach-chat-compose input").value'),'Keep this draft','draft survives language switch');
 assert.equal(calls.length,beforeLanguageSwitch,'language switch must not call the provider');
 await fill('Was ist der Plan für Schwarz?');await click(coachChatCopy.de.send);
 await wait('document.querySelectorAll(".coach-chat-message.assistant").length===4');
 assert.equal(calls.at(-1).body.question,'Was ist der Plan für Schwarz?','German question reaches the provider');
 assert.ok(calls.at(-1).instructions.includes('Reply in de using clear, concise teaching language.'),'German locale reaches the model instructions');
 await evaluate('window.language("ru")');
 await wait('document.querySelector(".coach-chat-toggle").textContent==='+JSON.stringify(coachChatCopy.ru.title));
 assert.equal(await evaluate('document.querySelectorAll(".coach-chat-message.assistant").length'),4);
 assert.equal(await evaluate('document.querySelector(".coach-chat-history").innerText').then(s=>s.includes('Was ist der Plan für Schwarz?')),true);
 // An in-flight response survives a locale switch without remount, duplication, or stuck busy state.
 const priorAssistantCount=await evaluate('document.querySelectorAll(".coach-chat-message.assistant").length');
 const priorUserCount=await evaluate('document.querySelectorAll(".coach-chat-message.user").length');
 mode='hold-chat';await fill('In-flight language switch question');await click(coachChatCopy.ru.send);
 for(let i=0;i<100&&!release;i++)await pause();assert.ok(release,'provider response must be held');
 await evaluate('window.language("de")');
 await wait('document.querySelector(".coach-chat-toggle").textContent==='+JSON.stringify(coachChatCopy.de.title));
 release();release=null;mode='ready';
 await wait('document.querySelectorAll(".coach-chat-message.assistant").length==='+String(priorAssistantCount+1));
 assert.equal(await evaluate('document.querySelectorAll(".coach-chat-message.user").length'),priorUserCount+1,'one user message for in-flight request');
 assert.equal(await evaluate('[...document.querySelectorAll(".coach-chat-message.user > p")].filter(p=>p.textContent==="In-flight language switch question").length'),1,'question is not duplicated');
 await wait('!document.querySelector(".coach-chat-history [role=status]")');
 assert.equal(await evaluate('document.querySelector(".coach-chat-compose input").disabled'),false,'composer remains usable');
 await evaluate('window.language("ru")');
 await wait('document.querySelector(".coach-chat-toggle").textContent==='+JSON.stringify(coachChatCopy.ru.title));
 mode='error';await fill('Preserve my question');await click(t.send);await wait('document.querySelector("[role=alert]")');assert.equal(await evaluate('document.querySelector(".coach-chat-compose input").value'),'Preserve my question');assert.ok(!(await evaluate('document.body.innerText')).includes('SECRET'));mode='ready';
 clock+=61000;await click(t.voice);await wait('document.querySelector("[aria-pressed=true]")');await new Promise(r=>setTimeout(r,350));await evaluate('(()=>{const b=document.querySelector("[aria-pressed=true]");b.click();b.click();})()');await wait('document.querySelector(".coach-chat-compose input").value==="How should I develop my pieces?"');assert.equal(calls.at(-1).kind,'transcribe');assert.equal(calls.at(-1).language,'ru');assert.ok(await evaluate('window.streams.at(-1).getTracks().every(t=>t.readyState==="ended")'));
 await click(t.send);await wait('document.querySelector("audio")?.readyState>=2');assert.ok(await evaluate('document.querySelector("audio").duration>0'));assert.equal(calls.at(-1).kind,'speech');if(captureRoot){await mkdir(captureRoot,{recursive:true});const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(captureRoot,'coach-chat-voice-ru.png'),Buffer.from(shot.data,'base64'));}await click(t.stopSpeaking);await wait('!document.querySelector("audio")');
 // Replay reuses the verified WAV; streaming starts before provider completion.
 const replayCalls=calls.length;await evaluate('[...document.querySelectorAll(".coach-chat-listen")].at(-1).click()');await wait('document.querySelector("audio")?.readyState>=2');assert.equal(calls.length,replayCalls,'same-answer replay makes no provider call');await click(t.stopSpeaking);
 clock+=61000;mode='hold-speech';await click(t.listen);await wait('document.querySelector(".coach-chat-stream")?.textContent.includes('+JSON.stringify(t.speechPlaying)+')');assert.equal(await evaluate('!!document.querySelector("audio")'),false,'audio is already streamed before WAV completion');assert.ok(release);release();release=null;mode='ready';await wait('document.querySelector("audio")?.readyState>=2');await click(t.stopSpeaking);
 const assistantCountBeforeSpeechError=await evaluate('document.querySelectorAll(".coach-chat-message.assistant").length');
 clock+=61000;mode='speech-error';await evaluate('[...document.querySelectorAll(".coach-chat-listen")].at(-2).click()');await wait('document.querySelector(".coach-chat-speech-error")');assert.ok((await evaluate('document.querySelector(".coach-chat-speech-error").textContent')).includes(t.speechUnavailable));assert.equal(await evaluate('document.querySelectorAll(".coach-chat-message.assistant").length'),assistantCountBeforeSpeechError,'speech error preserves existing assistant messages');mode='ready';

 await evaluate('window.mode="denied"');await click(t.voice);await wait('document.querySelector("[role=alert]")?.textContent==='+JSON.stringify(t.micDenied));await evaluate('window.mode="ready"');
 clock+=61000;const before=calls.filter(c=>c.kind==='transcribe').length;await click(t.voice);await wait('document.querySelector("[aria-pressed=true]")');await click(t.title);await wait('!document.querySelector(".coach-chat-panel")');assert.ok(await evaluate('window.streams.at(-1).getTracks().every(t=>t.readyState==="ended")'));assert.equal(calls.filter(c=>c.kind==='transcribe').length,before);await click(t.title);
 await evaluate('window.mode="permission-hold"');const streamCount=await evaluate('window.streams.length');await evaluate('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.getAttribute("aria-label")==='+JSON.stringify(t.voice)+');b.click();b.click();})()');await wait('typeof window.releasePermission==="function"');await click(t.title);await evaluate('window.releasePermission()');await wait('window.streams.at(-1).getTracks().every(t=>t.readyState==="ended")');assert.equal(await evaluate('window.streams.length'),streamCount+1,'rapid mic clicks open only one stream');await evaluate('window.mode="ready"');await click(t.title);
 mode='hold-chat';await fill('Stale board question');await click(t.send);for(let i=0;i<100&&!release;i++)await pause();assert.ok(release);const next=new Chess();next.move('d4');await evaluate('window.setFen('+JSON.stringify(next.fen())+')');await wait('document.querySelectorAll(".coach-chat-message").length===0');release();release=null;mode='ready';await pause();assert.equal(await evaluate('document.querySelectorAll(".coach-chat-message").length'),0);
 await evaluate('window.logout()');await click(t.title);await wait('document.querySelector(".coach-chat-compose input").disabled');assert.equal(await evaluate('document.querySelector(".coach-chat-voice-option input").disabled'),true);

 // Exercise the actual Players workspace composition, not just a standalone chat prop.
 clock+=61000;await evaluate('window.setToken("synthetic-colour");window.setAccount("colour-owner");window.setWorkspace(true)');await wait('document.querySelector(".chessaz-ai-coach-color select")');assert.equal(await evaluate('document.querySelector(".chessaz-ai-coach-color select").value'),'black');await click(t.title);await fill('Plan for my colour');await click(t.send);await wait('document.querySelector(".coach-chat-message.assistant")');assert.equal(calls.at(-1).body.archiveFilterSide,'black');assert.equal(calls.at(-1).body.requestedSide,undefined,'archive colour must not assert learner identity');assert.equal(calls.at(-1).body.sideToMove,'w','archive filter does not change whose turn it is');
 await evaluate('(()=>{const el=document.querySelector(".chessaz-ai-coach-color select");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(el,"white");el.dispatchEvent(new Event("change",{bubbles:true}));})()');await wait('!document.querySelector(".coach-chat-panel")');await click(t.title);await fill('Plan for White');await click(t.send);await wait('document.querySelector(".coach-chat-message.assistant")');assert.equal(calls.at(-1).body.archiveFilterSide,'white');assert.equal(calls.at(-1).body.requestedSide,undefined,'explicitly requested White plan must not infer the learner identity');await fill('Find five games');await click(t.send);await wait('document.querySelector(".coach-chat-games")');const colourCalls=calls.length;await evaluate('document.querySelector(".coach-chat-games summary").click()');await wait('document.querySelector(".coach-chat-games").open');await evaluate('document.querySelector(".coach-chat-games button").click()');await wait('document.querySelector("#analysis-fixture")');await evaluate('window.navigate(-1)');await wait('document.querySelector(".coach-chat-message.assistant")');assert.equal(await evaluate('document.querySelector(".chessaz-ai-coach-color select").value'),'white');assert.equal(calls.length,colourCalls);
 // A successfully prepared line must be the same position shown to the chat and archive search.
 await evaluate(`(()=>{const el=document.querySelector('.chessaz-ai-coach-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'e4 e5 Nf3 Nc6');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause();await evaluate(`document.querySelector('.chessaz-ai-coach>button').click()`);await wait(`document.querySelector('.chessaz-ai-coach-results-panel')`);await wait(`document.querySelector('.preparation-shared-board [data-piece-square="f3"]')`);
 const prepared=new Chess();for(const move of ['e4','e5','Nf3','Nc6'])prepared.move(move);
 assert.equal(await evaluate(`document.querySelector('.preparation-toolbar button').disabled`),false,'prepared line retains back/forward history');await evaluate(`document.querySelector('.preparation-toolbar button').click()`);await wait(`document.querySelector('.preparation-shared-board [data-piece-square="b8"]')`);await evaluate(`document.querySelectorAll('.preparation-toolbar button')[1].click()`);await wait(`document.querySelector('.preparation-shared-board [data-piece-square="c6"]')`);
 await click(t.title);await fill('Plan in the prepared position');await click(t.send);await wait(`document.querySelector('.coach-chat-message.assistant')`);assert.equal(calls.at(-1).body.position,prepared.fen(),'chat uses the prepared board, not the previous position');assert.equal(calls.at(-1).body.sideToMove,'w');
 // New QA controls do not reset the selected board when the Coach chat is cleared.
 assert.ok(await evaluate('!!document.querySelector(".preparation-fullscreen-action")'));
 assert.ok(await evaluate('!!document.querySelector(".coach-chat-copy")'));
 await evaluate('window.confirm=()=>true');await click(t.clearChat);
 await wait('document.querySelectorAll(".coach-chat-message").length===0');
 assert.ok(await evaluate('!!document.querySelector(".preparation-shared-board")'));
 await evaluate('window.setWorkspace(false);window.logout()');await wait('document.querySelector(".coach-chat-toggle")');
 assert.equal(await evaluate('Object.keys(sessionStorage).filter(k=>k.startsWith("chessaz:position-search:")).length'),0,'logout clears all account snapshots');
 // A legacy server may reject candidateLines: preserve *local* Stockfish replay,
 // label the ungrounded AI text and never show unsolicited archive parties.
 mode='legacy-chat';
 await evaluate('window.setToken("synthetic-legacy");window.setAccount("legacy-browser");window.setWorkspace(false)');
 await wait('document.querySelector(".coach-chat-toggle")');
 await click(t.title);await fill('Explain this position using Stockfish 19');await click(t.send);
 await wait('document.querySelector(".coach-chat-message.assistant")');
 assert.equal(await evaluate('document.querySelectorAll(".coach-chat-games").length'),0,'no unsolicited archive games');
 await wait('document.querySelector(".coach-chat-study")');
 assert.ok(await evaluate('!!document.querySelector(".coach-chat-engine-unlinked")'),'show real provenance warning');
 assert.ok(await evaluate('document.querySelector(".coach-chat-engine-source").textContent.includes("Stockfish 19")'));
 await evaluate('document.querySelector(".coach-chat-study-choices button").click()');
 await wait('document.querySelector(".coach-chat-study-nav")');
 // Server-verified lines replace local ones, show White-perspective evaluations and no
 // provenance warning, in all six languages at 390 px and once at 1280 px.
 const chatKey=account=>'chessaz:position-search:v1:'+account+':chat';
 for(const [width,lang] of [[390,'de'],[390,'en'],[390,'az'],[390,'tr'],[390,'ua'],[390,'ru'],[1280,'ru']]){
  const tl=coachChatCopy[lang==='ua'?'uk':lang];mode='server-lines';clock+=61000;
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});
  await evaluate('window.language('+JSON.stringify(lang)+');window.setToken("synthetic-server-'+width+lang+'");window.setAccount("server-'+width+lang+'")');
  await wait('document.querySelector(".coach-chat-toggle")?.textContent==='+JSON.stringify(tl.title));
  if(!await evaluate('!!document.querySelector(".coach-chat-panel")'))await click(tl.title);
  await fill('Explain the Stockfish lines');await click(tl.send);
  await wait('document.querySelector(".coach-chat-message.assistant .coach-chat-study")');
  const shown=await evaluate('[...document.querySelectorAll(".coach-chat-study-choices button")].map(b=>b.textContent)');
  assert.equal(shown.length,2,lang);
  assert.ok(shown[0].includes(serverLines[0].moves[0])&&shown[0].includes(tl.variant)&&shown[0].includes(formatEngineScore({kind:'cp',white:43})),shown[0]);
  assert.ok(shown[1].includes(serverLines[1].moves[0])&&shown[1].includes(formatEngineScore({kind:'mate',white:-2})),shown[1]);
  assert.equal(await evaluate('document.querySelector(".coach-chat-engine-source").textContent'),'Stockfish 19 · '+tl.engineServer,lang);
  assert.equal(await evaluate('document.querySelector(".coach-chat-eval-note").textContent'),tl.evalPerspective,lang);
  assert.equal(await evaluate('!!document.querySelector(".coach-chat-engine-unlinked")'),false,'no provenance warning for server lines '+lang);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'evaluation badges fit '+width+' '+lang);
  assert.ok(await evaluate('[...document.querySelectorAll(".coach-chat-study-choices button")].every(b=>b.scrollWidth<=b.clientWidth+1)'),'line buttons do not overflow '+width+' '+lang);
 }
 const tr=coachChatCopy.ru,account='server-1280ru';
 await evaluate('document.querySelector(".coach-chat-study-choices button").click()');
 await wait('document.querySelector(".coach-chat-study-nav span")?.textContent==="0 / 2"');
 // Restoring a valid server-verified answer keeps its lines and evaluations.
 const restore=async()=>{await evaluate('window.setAccount("restore-probe")');await wait('document.querySelectorAll(".coach-chat-message").length===0');await evaluate('window.setAccount('+JSON.stringify(account)+')');await pause();await pause();};
 await restore();await wait('document.querySelector(".coach-chat-eval")');
 assert.ok((await evaluate('document.querySelector(".coach-chat-eval").textContent'))===formatEngineScore({kind:'cp',white:43}));
 // Legacy language-bound chat snapshots restore only for the exact FEN and archive side.
 const legacyOriginal=JSON.parse(await evaluate('sessionStorage.getItem('+JSON.stringify(chatKey(account))+')'));
 const legacyContext=JSON.parse(legacyOriginal.payload.context);
 assert.equal(legacyContext.length,2,'current chat context excludes language');
 const legacyFen=legacyContext[0],legacySide=legacyContext[1];
 const restoreLegacy=async(savedContext)=>{
  await evaluate('window.setAccount("restore-probe")');
  await wait('document.querySelectorAll(".coach-chat-message").length===0');
  const snapshot=JSON.parse(JSON.stringify(legacyOriginal));
  snapshot.payload.context=JSON.stringify(savedContext);
  await evaluate('sessionStorage.setItem('+JSON.stringify(chatKey(account))+','+JSON.stringify(JSON.stringify(snapshot))+')');
  await evaluate('window.setAccount('+JSON.stringify(account)+')');
  await pause();await pause();
 };
 await restoreLegacy([legacyFen,legacySide,'ru']);
 await wait('document.querySelector(".coach-chat-eval")');
 assert.ok(await evaluate('document.querySelectorAll(".coach-chat-message.assistant").length>0'),'legacy 3-part context restores existing messages');
 const differentFenBoard=new Chess(legacyFen);
 differentFenBoard.move(differentFenBoard.moves()[0]);
 await restoreLegacy([differentFenBoard.fen(),legacySide,'ru']);
 assert.equal(await evaluate('document.querySelectorAll(".coach-chat-message").length'),0,'different FEN legacy context is discarded');
 await restoreLegacy(legacyContext);
 await wait('document.querySelector(".coach-chat-eval")');
 // Corrupted session storage never throws and never renders unverified evidence.
 const original=await evaluate('sessionStorage.getItem('+JSON.stringify(chatKey(account))+')');assert.ok(original);
 const corrupt=async mutate=>{
  await evaluate('window.setAccount("restore-probe")');await wait('document.querySelectorAll(".coach-chat-message").length===0');
  const value=JSON.parse(original);mutate(value.payload.items.find(m=>m.role==='assistant'));
  await evaluate('sessionStorage.setItem('+JSON.stringify(chatKey(account))+','+JSON.stringify(JSON.stringify(value))+')');
  await evaluate('window.setAccount('+JSON.stringify(account)+')');await pause();await pause();
  if(!await evaluate('!!document.querySelector(".coach-chat-panel")'))await click(tr.title);
  assert.equal(await evaluate('document.querySelectorAll(".coach-chat-message").length'),0,'invalid stored chat is discarded');
  assert.equal(await evaluate('!!document.querySelector(".coach-chat-eval")'),false);
 };
 await corrupt(m=>{m.candidateLines={};});
 await corrupt(m=>{m.candidateLines[0].moves=['Ke8'];});
 await corrupt(m=>{m.candidateLines[0].score={kind:'cp',white:1e9};});
 await corrupt(m=>{m.engineServer=false;});                 // scores without server provenance
 await corrupt(m=>{m.engineLinked=false;});
 // Server claims verification but its lines are malformed or for another position:
 // fall back to local lines, no server label or score, and keep the provenance warning.
 for(const bad of ['server-lines-malformed','server-lines-other-fen']){
  mode=bad;clock+=61000;
  const before=await evaluate('document.querySelectorAll(".coach-chat-message.assistant").length');
  await fill('Explain again');await click(tr.send);
  await wait('document.querySelectorAll(".coach-chat-message.assistant").length==='+(before+1));
  await wait('[...document.querySelectorAll(".coach-chat-message.assistant")].at(-1).querySelector(".coach-chat-study")');
  const last='[...document.querySelectorAll(".coach-chat-message.assistant")].at(-1)';
  assert.equal(await evaluate(last+'.querySelector(".coach-chat-eval")'),null,bad+': never rendered as server-verified');
  assert.equal(await evaluate(last+'.querySelector(".coach-chat-engine-source").textContent'),'Stockfish 19',bad);
  assert.ok(await evaluate('!!'+last+'.querySelector(".coach-chat-engine-unlinked")'),bad+': provenance warning kept');
 }
 mode='ready';
assert.deepEqual(exceptions,[]);console.log('PASS CoachChat: real HTTP router, real MediaRecorder with Chromium fake microphone, multipart provider adapter, actual loopback WebSocket/WAV playback, six locales at 390/1280, bounded context, auth/error handling, denied/late permissions, close cleanup, stale board cancellation, analysis round-trip restoration, scroll/draft preservation, token rotation, account isolation, logout cleanup and actual workspace colour propagation. OpenAI responses are synthetic; no hosted credentials or external API calls.');
 }finally{for(const p of pending.values())clearTimeout(p.timer);ws?.close();chrome?.kill('SIGKILL');await server?.close();if(api)await new Promise(r=>api.close(r));if(wss){for(const client of wss.clients)client.terminate();await new Promise(r=>wss.close(r));}if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});if(cacheDir)await rm(cacheDir,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkCoachChat({captureRoot:process.env.COACH_CAPTURE});
