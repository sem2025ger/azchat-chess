import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {sectionsFixturePlugin} from './sectionsFixtures.mjs';

export async function checkSectionLayouts({root=process.cwd(),captureRoot,phase='after',verify=true,playOnly=false}={}){
 const server=await createServer({root,configFile:false,cacheDir:join(tmpdir(),'chessaz-sections-vite-'+process.pid+'-'+phase),optimizeDeps:{include:['react','react-dom/client','react-router-dom','chess.js','lucide-react'],noDiscovery:true},plugins:[sectionsFixturePlugin({play:playOnly}),react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}},define:Object.fromEntries([
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
  for(let i=0;i<600;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await pause(50);}assert.ok(port,stderr);
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});let id=0;
  ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')diagnostics.push(m.params.args.map(a=>a.value||a.description));if(m.method==='Network.loadingFailed')diagnostics.push(m.params);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},20000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(50);}throw Error('UI wait: '+expression+' '+await evaluate('document.body.innerText')+' '+JSON.stringify({exceptions,diagnostics}));};
  const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click();})()`);
  const fill=(label,value)=>evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.getClientRects().length&&l.textContent.startsWith(${JSON.stringify(label)}));const el=label?.control||label?.querySelector('input');if(!el)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(captureRoot)await mkdir(captureRoot,{recursive:true});

  // A separate fixture mode keeps the existing section regression unchanged.
  if(playOnly){
   const snapshot=async(name,width,height)=>{
    if(!captureRoot)return;
    const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(join(captureRoot,phase+'-'+name+'-'+width+'x'+height+'.png'),Buffer.from(image.data,'base64'));
   };
   const settled=async()=>{
    await evaluate('document.fonts.ready');
    await evaluate("Promise.all([...document.images].filter(img=>img.getClientRects().length).map(img=>img.decode().catch(()=>{})))");
    await pause(120);
   };
   const measure=()=>evaluate(`(()=>{
    const r=s=>document.querySelector(s).getBoundingClientRect();
    const root=document.querySelector('.play-lobby-screen'),route=document.querySelector('[data-route-scroll]');
    const board=r('.play-lobby-board'),panel=r('.mobile-arena-panel'),nav=r('[data-mobile-app-nav]'),content=route.getBoundingClientRect();
    return {above:board.top-content.top,below:nav.top-panel.bottom,gap:panel.top-board.bottom,boardWidth:board.width,boardHeight:board.height,boardTop:board.top,panelBottom:panel.bottom,navTop:nav.top,contentTop:content.top,scrollable:root.scrollHeight>root.clientHeight+1||route.scrollHeight>route.clientHeight+1};
   })()`);
   const boardOverlay=async selector=>{
    const rects=await evaluate(`(()=>{const b=document.querySelector('.play-lobby-board').getBoundingClientRect(),o=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return ['top','left','width','height'].map(k=>Math.abs(b[k]-o[k]));})()`);
    assert.ok(rects.every(n=>n<=1),'Overlay must stay over the board: '+JSON.stringify(rects));
   };
   for(const [width,height]of[[360,780],[390,844],[430,932],[360,640],[768,1024],[1023,900],[1440,900]]){
    const mobile=width<768;
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});
    await wait('typeof window.fixtureNavigate==="function"');
    // Freeze decorative animation only in this test for reproducible pixel comparisons.
    await evaluate(`(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.append(s);})()`);
    await wait(mobile?"document.querySelector('.mobile-home-brand-domain')?.getClientRects().length":"document.querySelector('.desktop-home-arena')?.getClientRects().length");
    await settled();await snapshot('home',width,height);
    if(verify&&mobile){
     const colors=await evaluate(`(()=>{const d=document.querySelector('.mobile-home-brand-domain'),p=d.querySelector('.mobile-home-brand-dot');return [getComputedStyle(d).color,getComputedStyle(p).color];})()`);
     assert.deepEqual(colors,['rgb(226, 191, 160)','rgb(226, 191, 160)']);
    }
    await evaluate("window.fixtureNavigate('/play')");
    await wait("document.querySelector('.play-lobby-board [data-square]') && document.querySelector("+(mobile?"'.mobile-arena-panel'":"'.arena-start-game'")+")");
    await settled();await snapshot('play-idle',width,height);
    if(!mobile)continue;
    const metric=await measure();measurements.push({width,height,...metric});
    if(verify){
     assert.ok(metric.gap>=14&&metric.gap<=16,'Board/panel gap '+JSON.stringify(metric));
     assert.ok(Math.abs(metric.boardWidth-metric.boardHeight)<=1,'Square board '+JSON.stringify(metric));
     if(width===390)assert.ok(Math.abs(metric.above-metric.below)<=16,'Unbalanced composition '+JSON.stringify(metric));
     if(height!==640)assert.ok(metric.above>=0&&metric.below>=0,'Content clipped '+JSON.stringify(metric));
     else{
      if(metric.below<0)assert.ok(metric.scrollable,'Short screen must scroll');
      await evaluate("document.querySelector('.mobile-arena-panel').scrollIntoView({block:'end'})");
      const end=await measure();assert.ok(end.below>=-1,'Panel unreachable '+JSON.stringify(end));
      await evaluate("document.querySelector('.play-lobby-board').scrollIntoView({block:'start'})");
      const start=await measure();assert.ok(start.above>=-1,'Board unreachable '+JSON.stringify(start));
     }
    }
    if(height===640)continue;
    await evaluate("document.querySelector('.mobile-arena-start').click()");
    await wait("document.querySelector('.chessaz-search-mobile')?.getClientRects().length");
    await settled();await snapshot('play-searching',width,height);
    if(verify){
     await boardOverlay('.chessaz-search-mobile');
     const search=await measure();
     for(const k of ['above','below','gap','boardWidth'])assert.ok(Math.abs(search[k]-metric[k])<=1,'Search moved layout: '+k);
    }
    await evaluate("document.querySelector('.chessaz-search-mobile__cancel').click()");
    await wait("!document.querySelector('.chessaz-search-mobile')");
    if(verify&&width===390){
     await evaluate("document.querySelector('.mobile-arena-time').click()");
     await wait("document.querySelector('.mobile-time-dialog[open]')");
     await evaluate("document.querySelector('.mobile-time-close').click()");
     await wait("!document.querySelector('.mobile-time-dialog')");
     await evaluate("document.querySelector('.mobile-arena-footer button').click()");
     await wait("document.getElementById('mobile-time-invite-title')");
     await evaluate("document.getElementById('mobile-time-invite-title').closest('[role=dialog]').querySelector('button').click()");
     await wait("!document.getElementById('mobile-time-invite-title')");
     await evaluate("window.fixtureNavigate('/play?room=qa-private-room')");
     await wait("document.querySelector('.play-lobby-screen').innerText.includes('Joining private room...')");
     const privateOverlay=await evaluate(`(()=>{const b=document.querySelector('.play-lobby-board'),overlay=[...b.parentElement.children].find(e=>e!==b&&e.textContent.includes('Joining private room...'));if(!overlay)throw Error('Missing private overlay');overlay.setAttribute('data-fixture-private-overlay','');return true;})()`);
     assert.ok(privateOverlay);await boardOverlay('[data-fixture-private-overlay]');
     await evaluate("window.fixtureSocketEvent('join_failed',{reason:'room_not_found'})");
     await wait("document.querySelector('.play-lobby-screen').innerText.includes('Room not found or expired.')");
     assert.ok(await evaluate(`(()=>{const board=document.querySelector('.play-lobby-board'),toast=[...board.parentElement.children].find(e=>e.textContent==='Room not found or expired.');if(!toast)return false;const b=board.getBoundingClientRect(),t=toast.getBoundingClientRect();return t.top>=b.top&&t.bottom<=b.bottom&&t.left>=b.left&&t.right<=b.right;})()`),'Join error toast must stay on the board');
    }
   }
   assert.deepEqual(exceptions,[],'Play browser runtime errors');
   if(captureRoot)await writeFile(join(captureRoot,phase+'-play-measurements.json'),JSON.stringify(measurements,null,2));
   return measurements;
  }
  for(const width of [1366,390]){
   const height=width===390?844:768;
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
   await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});await wait('typeof window.fixtureNavigate==="function"');
   for(const [name,path,heading]of[['Home','/',width===390&&verify?'Chessaz.de':'Chess Arena'],['Spieler','/spieler','Spieler'],['NRW','/region/nrw','Schach in Nordrhein-Westfalen'],['Spieltag','/spieltag','Spieltag'],['Vorbereitung','/vorbereitung',verify?'Spieler':'Vorbereitung']]){
    await evaluate('window.fixtureNavigate('+JSON.stringify(path)+')');await wait(`document.querySelector('main')?.innerText.includes(${JSON.stringify(heading)})`);
    if(name==='Spieler'){await fill('Nachname','Huseynov');await click('Suchen');await wait(`document.querySelector('.spieler-results button')`);await evaluate("document.querySelector('.spieler-results button').click()");await wait(`document.querySelector('.spieler-card')`);}
    if(name==='Spieltag')await wait(`document.querySelector('[aria-label="Mannschaftskampf"]')&&document.querySelectorAll('.spieltag-boards li').length===2`);
    if(name==='Vorbereitung'){if(verify){await wait(`document.getElementById('spieler-section-opponent')?.getAttribute('aria-selected')==='true'`);await pause(120);await fill('Nachname','Huseynov');await click('Suchen');await wait(`document.querySelector('#spieler-section-panel-opponent .spieler-results button')`);await evaluate("document.querySelector('#spieler-section-panel-opponent .spieler-results button').click()");}else{await fill('Spielername','Huseynov, Sabir');await click('Spielerpartien laden');}await wait(`document.body.innerText.includes('0 importierte Partien')`);await evaluate("document.querySelector('.preparation-position')?.closest('details')?.setAttribute('open','')");if(verify){await wait(`document.querySelector('.preparation-shared-board [data-piece-square="f1"] img')?.naturalWidth>0`);assert.match(await evaluate(`document.querySelector('.preparation-shared-board [data-piece-square="f1"] img').getAttribute('src')`),/\/pieces\/mobile\/neo\/wB\.svg$/);}}
    await evaluate('document.fonts.ready');await pause(120);
    const metric=await evaluate(`(()=>{const main=document.querySelector('main');const scrolling=[...main.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return /^(auto|scroll)$/.test(s.overflowY)&&e.clientHeight>0&&e.scrollHeight>e.clientHeight+1;});return{heading:[...main.querySelectorAll('h1')].filter(e=>e.getClientRects().length).map(e=>{const copy=e.cloneNode(true);copy.querySelectorAll('[aria-hidden="true"]').forEach(n=>n.remove());const content=copy.textContent.trim();const label=e.getAttribute('aria-label');return label&&label!==content?label+' [content: '+content+']':content}),width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,scrollContainers:scrolling.map(e=>({tag:e.tagName,className:e.className,height:e.clientHeight,scrollHeight:e.scrollHeight})),boardBottom:document.querySelector('.home-screen-root .home-board')?.getBoundingClientRect().bottom};})()`);
    measurements.push({name,...metric});
    if(captureRoot){const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(captureRoot,phase+'-'+name.toLowerCase()+'-'+width+'.png'),Buffer.from(image.data,'base64'));await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));}
    if(verify){assert.equal(metric.documentWidth<=width+1,true,name+' horizontal overflow '+JSON.stringify(metric));assert.deepEqual(metric.heading,[heading],name+' main heading');if(name!=='Home'||width===1366)assert.ok(metric.scrollContainers.length<=1,name+' nested vertical scroll '+JSON.stringify(metric));assert.ok(metric.documentHeight<=height+1,name+' body scroll competes with route '+JSON.stringify(metric));}
    if(verify&&name==='Home'&&width===390){
     const brand=await evaluate(`(()=>{const domain=document.querySelector('.mobile-home-brand-domain'),dot=domain.querySelector('.mobile-home-brand-dot');const d=getComputedStyle(domain),p=getComputedStyle(dot);return{color:d.color,dotColor:p.color,gradient:d.backgroundImage,clip:d.backgroundClip,dotFill:p.webkitTextFillColor,fill:d.webkitTextFillColor};})()`);
     assert.equal(brand.color,'rgb(226, 191, 160)');
     assert.equal(brand.dotColor,brand.color);
     assert.equal(brand.gradient,'linear-gradient(110deg, rgb(246, 226, 207), rgb(226, 191, 160) 45%, rgb(185, 140, 108))');
     assert.equal(brand.clip,'text');assert.equal(brand.dotFill,brand.fill);
    }
    if(verify&&name==='Home'&&width===1366){const bounds=await evaluate(`(()=>{const root=document.querySelector('.home-screen-root');const b=root.querySelector('.board-container');const controls=b.querySelector('.home-desktop-controls');return{root:root.getBoundingClientRect().bottom,board:b.getBoundingClientRect().bottom,controls:controls?.getBoundingClientRect().bottom,arena:root.querySelector('.desktop-home-arena').getBoundingClientRect().bottom,scroll:document.querySelector('main > div').scrollHeight,height:document.querySelector('main > div').clientHeight};})()`);assert.ok(bounds.scroll<=bounds.height+1,'Home page overflow '+JSON.stringify(bounds));assert.ok(bounds.root<=height+1&&bounds.board<=height+1&&bounds.controls<=height+1&&bounds.arena<=height+1,'Home clipped '+JSON.stringify(bounds));}
   }
  }
  if(verify){for(const [width,height]of[[1280,720],[1920,1080]]){await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate("window.fixtureNavigate('/')");await wait("document.querySelector('.home-screen-root')");await pause(100);const b=await evaluate(`(()=>{const s=document.querySelector('main > div'),board=document.querySelector('.home-screen-root .board-container'),arena=document.querySelector('.desktop-home-arena');return{page:document.documentElement.scrollHeight,height:innerHeight,scroll:s.scrollHeight,client:s.clientHeight,board:board.getBoundingClientRect().bottom,arena:arena.getBoundingClientRect().bottom,controls:document.querySelector('.home-desktop-controls').getBoundingClientRect().bottom};})()`);assert.ok(b.page<=height+1&&b.scroll<=b.client+1&&b.board<=height+1&&b.arena<=height+1&&b.controls<=height+1,'Home '+width+'x'+height+' overflow '+JSON.stringify(b));}}
  assert.deepEqual(exceptions,[],'Browser runtime errors');
  if(captureRoot)await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));
  return measurements;
 }finally{try{ws?.close();}catch{}chrome?.kill('SIGKILL');for(const p of pending.values())clearTimeout(p.timer);await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await checkSectionLayouts({root:process.env.SECTIONS_ROOT||process.cwd(),captureRoot:process.env.SECTIONS_CAPTURE,phase:process.env.SECTIONS_PHASE||'after',verify:process.env.SECTIONS_PHASE!=='before'});
 console.log('PASS section layout browser: headings, native scroll, 390/1366 widths and Home 1280x720/1366x768/1920x1080');
}
