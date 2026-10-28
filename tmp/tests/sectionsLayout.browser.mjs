import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {sectionsFixturePlugin} from './sectionsFixtures.mjs';

export async function checkSectionLayouts({root=process.cwd(),captureRoot,phase='after',verify=true}={}){
 const server=await createServer({root,configFile:false,cacheDir:join(tmpdir(),'chessaz-sections-vite-'+process.pid+'-'+phase),optimizeDeps:{include:['react','react-dom/client','react-router-dom','chess.js','lucide-react'],noDiscovery:true},plugins:[sectionsFixturePlugin(),react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}},define:Object.fromEntries([
  ['VITE_SERVER_URL','https://sections-fixture.invalid'],...['VITE_SPIELER_V1_ENABLED','VITE_CLUBS_NRW_ENABLED','VITE_SPIELTAG_ENABLED','VITE_VORBEREITUNG_ENABLED'].map(k=>[k,'true'])
 ].map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)]))});
 let chrome,ws,profile;const pending=new Map(),exceptions=[],diagnostics=[],measurements=[];
 try{
  await server.listen();
  const binary=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(binary,'Chromium is required for section layout regression');
  profile=await mkdtemp(join(tmpdir(),'chessaz-sections-'));
  chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,...JSON.parse(process.env.CHROME_ARGS||'[]'),'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';chrome.stderr.on('data',c=>{stderr=(stderr+c).slice(-4000);});
  const pause=ms=>new Promise(r=>setTimeout(r,ms));let port;
  for(let i=0;i<200;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await pause(50);}assert.ok(port,stderr);
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});let id=0;
  ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')diagnostics.push(m.params.args.map(a=>a.value||a.description));if(m.method==='Network.loadingFailed')diagnostics.push(m.params);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},20000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(50);}throw Error('UI wait: '+expression+' '+await evaluate('document.body.innerText')+' '+JSON.stringify({exceptions,diagnostics}));};
  const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click();})()`);
  const fill=(label,value)=>evaluate(`(()=>{const el=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('input');if(!el)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(captureRoot)await mkdir(captureRoot,{recursive:true});
  for(const width of [1366,390]){
   const height=width===390?844:768;
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
   await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});await wait('typeof window.fixtureNavigate==="function"');
   for(const [name,path,heading]of[['Home','/','Chess Arena'],['Spieler','/spieler','Spieler'],['NRW','/region/nrw','Schach in Nordrhein-Westfalen'],['Spieltag','/spieltag','Spieltag'],['Vorbereitung','/vorbereitung','Vorbereitung']]){
    await evaluate('window.fixtureNavigate('+JSON.stringify(path)+')');await wait(`document.querySelector('main')?.innerText.includes(${JSON.stringify(heading)})`);
    if(name==='Spieler'){await fill('Nachname','Huseynov');await click('Suchen');await wait(`document.querySelector('.spieler-results button')`);await evaluate("document.querySelector('.spieler-results button').click()");await wait(`document.querySelector('.spieler-card')`);}
    if(name==='Spieltag')await wait(`document.querySelector('[aria-label="Mannschaftskampf"]')&&document.querySelectorAll('.spieltag-boards li').length===2`);
    if(name==='Vorbereitung'){await fill('Spielername','Huseynov, Sabir');await click('Spielerpartien laden');await wait(`document.body.innerText.includes('0 importierte Partien')`);await evaluate("document.querySelector('.preparation-position')?.closest('details')?.setAttribute('open','')");}
    await evaluate('document.fonts.ready');await pause(120);
    const metric=await evaluate(`(()=>{const main=document.querySelector('main');const scrolling=[...main.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return /^(auto|scroll)$/.test(s.overflowY)&&e.clientHeight>0&&e.scrollHeight>e.clientHeight+1;});return{heading:[...main.querySelectorAll('h1')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()),width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,scrollContainers:scrolling.map(e=>({tag:e.tagName,className:e.className,height:e.clientHeight,scrollHeight:e.scrollHeight})),boardBottom:document.querySelector('.home-screen-root .home-board')?.getBoundingClientRect().bottom};})()`);
    measurements.push({name,...metric});
    if(captureRoot){const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(captureRoot,phase+'-'+name.toLowerCase()+'-'+width+'.png'),Buffer.from(image.data,'base64'));await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));}
    if(verify){assert.equal(metric.documentWidth<=width+1,true,name+' horizontal overflow '+JSON.stringify(metric));assert.deepEqual(metric.heading,[heading],name+' main heading');if(name!=='Home'||width===1366)assert.ok(metric.scrollContainers.length<=1,name+' nested vertical scroll '+JSON.stringify(metric));assert.ok(metric.documentHeight<=height+1,name+' body scroll competes with route '+JSON.stringify(metric));}
    if(verify&&name==='Home'&&width===1366){const bounds=await evaluate(`(()=>{const root=document.querySelector('.home-screen-root');const b=root.querySelector('.board-container');const controls=b.querySelector('[aria-label]')?.closest('div');return{root:root.getBoundingClientRect().bottom,board:b.getBoundingClientRect().bottom,controls:controls?.getBoundingClientRect().bottom,arena:root.querySelector('.desktop-home-arena').getBoundingClientRect().bottom,scroll:document.querySelector('main > div').scrollHeight,height:document.querySelector('main > div').clientHeight};})()`);assert.ok(bounds.scroll<=bounds.height+1,'Home page overflow '+JSON.stringify(bounds));assert.ok(bounds.root<=height+1&&bounds.board<=height+1&&bounds.arena<=height+1,'Home clipped '+JSON.stringify(bounds));}
   }
  }
  if(verify){for(const [width,height]of[[1280,720],[1920,1080]]){await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate("window.fixtureNavigate('/')");await wait("document.querySelector('.home-screen-root')");await pause(100);const b=await evaluate(`(()=>{const s=document.querySelector('main > div'),board=document.querySelector('.home-screen-root .board-container'),arena=document.querySelector('.desktop-home-arena');return{page:document.documentElement.scrollHeight,height:innerHeight,scroll:s.scrollHeight,client:s.clientHeight,board:board.getBoundingClientRect().bottom,arena:arena.getBoundingClientRect().bottom};})()`);assert.ok(b.page<=height+1&&b.scroll<=b.client+1&&b.board<=height+1&&b.arena<=height+1,'Home '+width+'x'+height+' overflow '+JSON.stringify(b));}}
  assert.deepEqual(exceptions,[],'Browser runtime errors');
  if(captureRoot)await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));
  return measurements;
 }finally{try{ws?.close();}catch{}chrome?.kill('SIGKILL');for(const p of pending.values())clearTimeout(p.timer);await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await checkSectionLayouts({root:process.env.SECTIONS_ROOT||process.cwd(),captureRoot:process.env.SECTIONS_CAPTURE,phase:process.env.SECTIONS_PHASE||'after',verify:process.env.SECTIONS_PHASE!=='before'});
 console.log('PASS section layout browser: headings, native scroll, 390/1366 widths and Home 1280x720/1366x768/1920x1080');
}
