import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {sectionsFixturePlugin} from './sectionsFixtures.mjs';
import {chessyCopy} from '../src/i18n/chessyCopy.ts';
import {coachChatCopy} from '../src/i18n/coachChatCopy.ts';

export async function checkSpielerDesign({root=process.cwd(),captureRoot,phase='after',verify=true}={}){
 const plugin=sectionsFixturePlugin(),load=plugin.load;plugin.load=id=>{let code=load(id);if(id==='/__sections_fixture.tsx'){code=code.replace('import{LanguageProvider}', 'import{Chess}from"chess.js";import{LanguageProvider,useLanguage}').replace('<LanguageProvider><MemoryRouter>', '<LanguageProvider><LanguageProbe/><MemoryRouter>');code=code.replace("if(path==='/api/spieler/search')", `if(path==='/api/ai-coach/chat'){window.layoutChatCalls=(window.layoutChatCalls||0)+1;const position=JSON.parse(options.body).fen;const probe=new Chess(position);const engineLines=probe.moves().slice(0,3).map((move,i)=>({id:'layout-line-'+i,moves:[move],scoreKind:'cp',scoreWhite:12-i*2,depth:16}));if(/план|продолжение/.test(JSON.parse(options.body).message))for(const line of engineLines){const follow=new Chess(position);for(const san of line.moves)follow.move(san);const move=follow.moves()[0];if(move)line.continuation={moves:[move],evalWhite:0.1,depth:16,settled:true};}data={position,engineVerified:true,engineLines,answer:'Тестовый ответ: сначала проверьте безопасность короля и развитие фигур. План зависит от позиции: Nf3, c3 и O-O нужно сопоставить с ответами соперника. '+ 'Подробное объяснение для проверки читаемости и прокрутки. '.repeat(8),generated:true,games:Array.from({length:5},(_,i)=>({id:'layout-'+i,white:'Synthetic White with a long name '+i,black:'Synthetic Black with a long name '+i,ply:0,pgn:'1. e4 e5',result:'*'}))};if(JSON.parse(options.body).message.includes('план')){const intro='Позиция близка к равной. План белых — развить фигуры и подготовить борьбу за центр.',conclusion='В показанном варианте белые улучшают развитие, но решающего преимущества ещё нет.';data.answer=intro+'\\n'+conclusion;data.planDemonstration={lineId:'L1',intro,conclusion};data.engineLines=data.engineLines.map((line,i)=>({...line,id:'L'+(i+1)}));}}
 else if(path==='/api/ai-coach/preparation')data={opening:'custom',color:JSON.parse(options.body).color,moves:['e4','c5'],ply:2,turn:'white',matched:37,inspected:15,briefing:null,groups:['Nf3','Nc3','d4'].map(move=>({move,replyColor:'black',availableInSample:5,replies:[{move:'d6',count:5}],games:Array.from({length:5},(_,i)=>({id:'prep-'+move+i,white:'Synthetic White '+i,black:'Synthetic Black '+i,result:'*',date:'2026-10-30',event:'Layout fixture',ply:0,pgn:'1. e4 e5',first25:['e4','e5']}))}))};
 else if(path==='/api/spieler/search')`);code+=`function LanguageProbe(){const {setLanguage}=useLanguage();window.fixtureLanguage=setLanguage;return null;}`;}return code;};
 const server=await createServer({root,configFile:false,cacheDir:join(tmpdir(),'chessaz-sections-vite-'+process.pid+'-'+phase),optimizeDeps:{include:['react','react-dom/client','react-router-dom','chess.js','lucide-react'],noDiscovery:true},plugins:[plugin,react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}},define:Object.fromEntries([
  ['VITE_SERVER_URL','https://sections-fixture.invalid'],...['VITE_SPIELER_V1_ENABLED','VITE_CLUBS_NRW_ENABLED','VITE_SPIELTAG_ENABLED','VITE_VORBEREITUNG_ENABLED','VITE_POSITION_SEARCH_ENABLED','VITE_AI_COACH_ENABLED','VITE_CHESSY_ENABLED','VITE_CHESSY_PLAN_DEMO_ENABLED'].map(k=>[k,'true'])
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
  const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click();})()`);
  const fill=(label,value)=>evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const el=label?.control||label?.querySelector('input');if(!el)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(captureRoot)await mkdir(captureRoot,{recursive:true});
  const capture=async name=>{if(captureRoot){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(captureRoot,phase+'-'+name+'.png'),Buffer.from(shot.data,'base64'));}};
  for(const [width,height]of [[1280,720],[1280,900],[390,844]]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
   await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});await wait('typeof window.fixtureNavigate==="function"');await evaluate("window.fixtureNavigate('/spieler')");await wait("document.querySelector('.global-position-search')");
   for(const lang of (verify?['de','en','az','tr','ua','ru']:['de','ru'])){
    await evaluate('window.fixtureLanguage('+JSON.stringify(lang)+')');await evaluate('document.fonts.ready');await pause(100);
    if(lang==='de'||lang==='ru'){
     await capture('position-'+lang+'-'+width+'x'+height);
     if(width===1280&&height===720&&captureRoot){const shot=await cdp('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:Math.ceil(await evaluate('document.querySelector("aside").getBoundingClientRect().width')),height,scale:1}});await writeFile(join(captureRoot,phase+'-menu-'+lang+'.png'),Buffer.from(shot.data,'base64'));}
    }
    const metric=await evaluate(`(()=>{const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}:null;};return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,board:rect(document.querySelector('.global-position-search .preparation-shared-board')),toolbar:rect(document.querySelector('.global-position-search .preparation-toolbar')),search:rect(document.querySelector('.global-position-primary')),moves:rect(document.querySelector('.global-position-search .preparation-moves-input')),title:rect(document.querySelector('.spieler-page>header h1')),header:rect(document.querySelector('.spieler-workspace-top')),tabs:rect(document.querySelector('[aria-label] [id="spieler-section-position"]')),visible:document.querySelector('main').innerText,menu:[...document.querySelectorAll('aside nav .site-nav-label')].map(e=>{const s=getComputedStyle(e);return {family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,style:s.fontStyle,transform:s.textTransform};})};})()`);measurements.push({lang,...metric});
    // The real AI Coach must be rendered next to the board, not omitted from QA.
    const coach=await evaluate(`(()=>{const el=document.querySelector('.chessaz-ai-coach'),board=document.querySelector('.preparation-shared-board'),rail=document.querySelector('.global-position-right-rail');if(!el||!board||!rail)return null;const c=el.getBoundingClientRect(),b=board.getBoundingClientRect();return {heading:el.querySelector('.ai-coach-wordmark')?.textContent?.trim(),label:el.querySelector('.chessaz-ai-coach-input')?.textContent?.trim(),x:c.x,y:c.y,boardRight:b.right,boardBottom:b.bottom,railScroll:rail.scrollHeight,railHeight:rail.clientHeight};})()`);
    if(verify){
      const labels={de:'Partiensuche — Züge eingeben',en:'Find games — enter moves',az:'Partiya axtarışı — gedişləri daxil edin',tr:'Parti arama — hamleleri girin',ua:'Пошук партій — введіть ходи',ru:'Поиск партий — введите ходы'};
      assert.ok(coach,'AI Coach DOM stays mounted for state persistence '+lang+' '+width);if(width===390)assert.ok(await evaluate(`getComputedStyle(document.querySelector('.chessaz-ai-coach')).display==='none'&&getComputedStyle(document.querySelector('.coach-chat')).display==='none'`),'desktop-only Coach hidden on phone '+lang);assert.ok(metric.board&&Math.abs(metric.board.width-metric.board.height)<1.5,'board must stay square '+lang+' '+width+' '+JSON.stringify(metric.board));assert.equal(await evaluate(`!!document.querySelector('.chessaz-ai-coach-help, .position-info')`),false,'no redundant help disclosures');if(width===1280)assert.ok(await evaluate(`(()=>{const r=document.querySelector('.ai-coach-wordmark').getBoundingClientRect(),c=document.querySelector('.chessaz-ai-coach').getBoundingClientRect();return r.left>=c.left-1&&r.right<c.right-100})()`),'metal title leaves room for desktop Coach ask button');
      assert.equal(coach.heading,'AI Coach','premium title '+lang);assert.equal(await evaluate(`!!document.querySelector('.global-position-search .preparation-mode')`),false,'hide board mode buttons '+lang);assert.ok(await evaluate(`document.querySelector('.ai-coach-wordmark').getBoundingClientRect().height<45`),'compact Coach title '+lang);assert.equal(await evaluate(`!!document.querySelector('.preparation-moves-input')`),false,'no duplicate SAN input '+lang);
      assert.equal(coach.label,labels[lang],'localized opening input '+lang);assert.equal(await evaluate(`!!document.querySelector('.chessaz-ai-coach>p[role="status"]')`),false,'no duplicate Coach login hint '+lang);assert.equal(await evaluate(`!!document.querySelector('.global-position-controls>p[role="status"]')`),false,'no redundant filter login hint '+lang);assert.ok(await evaluate(`(()=>{const a=getComputedStyle(document.querySelector('.global-position-primary')),b=getComputedStyle(document.querySelector('.position-advanced-settings>summary'));return a.backgroundColor===b.backgroundColor&&a.borderTopColor===b.borderTopColor})()`),'matching graphite actions '+lang);
      if(width===1280)assert.ok(coach.x>=coach.boardRight-2,'Coach should be to right of board '+lang);
      else assert.ok(await evaluate(`getComputedStyle(document.querySelector('.chessaz-ai-coach')).display==='none'`),'mobile Coach is hidden '+lang);
    }
    if(verify){assert.ok(parseFloat(metric.font)>16,'base font increased');assert.ok(metric.documentWidth<=width+1,'overflow '+lang+' '+width);assert.ok(!/\bV1\b/i.test(metric.visible),'internal label');assert.ok(metric.tabs.x>=metric.header.x-5&&metric.tabs.x+metric.tabs.width<=metric.header.x+metric.header.width+5,'tabs remain inside section header');assert.ok(metric.title.width<=1&&metric.title.height<=1,'duplicate Spieler heading visually hidden');assert.ok(!await evaluate(`!!document.querySelector('#spieler-section-panel-position .spieler-search')`),'directory only in opponent');assert.ok(!await evaluate(`!!document.querySelector('.global-position-search .position-sort')`),'no sort before results');assert.equal(await evaluate(`[...document.querySelectorAll('.global-position-search label')].some(e=>e.textContent.includes('Umwandlung')&&e.getClientRects().length)`),false,'no permanent promotion');assert.equal(new Set(metric.menu.map(m=>JSON.stringify(m))).size,1,'same menu typography');assert.ok(metric.menu.every(m=>m.style==='normal'&&m.transform==='none'));const menuGeometry=await evaluate(`(()=>{const nav=document.querySelector(innerWidth<1024?'[data-mobile-app-nav]':'aside');return [...nav.querySelectorAll('.site-nav-link')].map(e=>{const r=e.getBoundingClientRect(),l=e.querySelector('.site-nav-label'),s=getComputedStyle(l);return {height:r.height,iconX:e.querySelector('svg').getBoundingClientRect().x-r.x,labelY:l.getBoundingClientRect().y-r.y,family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,style:s.fontStyle};});})()`);assert.equal(new Set(menuGeometry.map(x=>JSON.stringify([x.family,x.size,x.weight,x.style]))).size,1,'uniform visible menu typography');assert.equal(new Set(menuGeometry.map(x=>x.height)).size,1,'equal menu item heights');assert.ok(menuGeometry.every(x=>x.style==='normal'));if(width===1280)assert.equal(new Set(menuGeometry.map(x=>x.iconX)).size,1,'desktop icons share a grid');else assert.equal(new Set(menuGeometry.map(x=>x.labelY)).size,1,'mobile labels share a grid');assert.equal(await evaluate(`!!document.querySelector('.site-nav-subtitle')`),false,'Schach-Treff subtitle removed');if(width===1280){if(height===720)assert.ok(await evaluate(`document.querySelector('[data-route-scroll]').scrollHeight<=document.querySelector('[data-route-scroll]').clientHeight+1`),'initial workspace needs no scrolling '+lang+' '+JSON.stringify(metric)+' '+await evaluate(`JSON.stringify({scroll:document.querySelector('[data-route-scroll]').scrollHeight,height:document.querySelector('[data-route-scroll]').clientHeight,page:document.querySelector('.spieler-page').getBoundingClientRect().bottom,card:document.querySelector('.global-position-search').getBoundingClientRect().bottom,children:[...document.querySelector('.global-position-search').children].map(e=>[e.tagName,e.className,e.getBoundingClientRect().bottom,getComputedStyle(e).marginBottom]),left:[...document.querySelector('.preparation-position').childNodes].map(e=>e.nodeType===3?['text',e.textContent]:[e.tagName,e.className,e.getBoundingClientRect().y,e.getBoundingClientRect().height,getComputedStyle(e).position,getComputedStyle(e).marginBottom]),grid:getComputedStyle(document.querySelector('.preparation-position')).gridTemplateRows})`));for(const key of ['board','toolbar','search'])assert.ok(metric[key]?.bottom<=height+1,key+' below viewport '+JSON.stringify(metric));assert.ok(metric.board.width>=500&&metric.board.width<=530,'board size '+metric.board.width);}}
   }
   if(verify&&width===1280&&height===720){
    await evaluate(`(()=>{const probe=document.createElement('div');probe.id='spieler-wheel-probe';probe.style.cssText='height:950px;min-height:950px';document.querySelector('.global-position-search').appendChild(probe)})()`);
    for(const selector of ['.preparation-shared-board','.chessaz-ai-coach']){
      await evaluate(`document.querySelector('[data-route-scroll]').scrollTop=0`);
      const at=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(b.left+b.width/2),y:Math.round(Math.max(20,Math.min(innerHeight-70,b.top+40)))}})()`);
      await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:at.x,y:at.y,deltaX:0,deltaY:300});
      await wait(`document.querySelector('[data-route-scroll]').scrollTop>=450`);
    }
    await evaluate(`(()=>{document.getElementById('spieler-wheel-probe').remove();document.querySelector('[data-route-scroll]').scrollTop=0})()`);
   }
   if(verify&&width===1280){
    // Open the real sections together: long answer, game examples, preparation and filters.
    await evaluate(`document.querySelector('.chessaz-ai-coach>button').click()`);await wait(`document.querySelector('.chessaz-ai-coach-results-panel')`);await wait(`document.querySelector('.preparation-shared-board [data-piece-square="c5"]')`);
    assert.equal(await evaluate(`document.querySelector('.preparation-toolbar button').disabled`),false,'prepared position has real move history');
    await evaluate(`document.querySelector('.coach-chat-toggle').click()`);await wait(`document.querySelector('.coach-chat-compose input')`);
    await evaluate(`(()=>{const input=document.querySelector('.coach-chat-compose input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Layout regression');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(20);await evaluate(`document.querySelector('.coach-chat-compose').requestSubmit()`);await wait(`document.querySelector('.coach-chat-message.assistant')`);
    await evaluate(`(()=>{for(const selector of ['.chessaz-ai-coach-group','.coach-chat-games','.position-advanced-settings','.position-player-filter']){const d=document.querySelector(selector);if(d&&!d.open)d.querySelector('summary').click();}})()`);await pause(50);
    const layout=await evaluate(`(()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return {top:x.top,bottom:x.bottom,left:x.left,right:x.right};};return {prep:r('.chessaz-ai-coach'),chat:r('.coach-chat'),history:r('.coach-chat-history'),compose:r('.coach-chat-compose'),controls:r('.global-position-controls'),width:document.documentElement.scrollWidth,viewport:innerWidth};})()`);
    assert.ok(layout.chat.left>=layout.prep.left,'floating chat remains on the right');assert.ok(layout.history.bottom<=layout.compose.top+1,'history never covers composer');assert.ok(await evaluate(`getComputedStyle(document.querySelector('.coach-chat-panel')).position==='absolute'`),'chat overlays the search rail without covering the chessboard');assert.ok(layout.width<=layout.viewport+1,'expanded sections fit horizontally');
    await evaluate(`document.querySelector('.chessaz-ai-coach-results-panel>summary').click()`);await pause(40);assert.ok(await evaluate(`document.querySelector('.coach-chat-panel').getBoundingClientRect().bottom<=innerHeight+1`),'floating chat remains entirely inside viewport');
    // Reading mode uses the real Chessy surface and three server-bound lines.
    assert.equal(await evaluate(`document.querySelectorAll('.coach-chat-study-choices button').length`),3);
    await evaluate(`document.querySelector('.coach-chat-study-choices button').click()`);
    await evaluate(`document.querySelector('.coach-chat-study-nav button[aria-label]').nextElementSibling.nextElementSibling.click()`);
    await evaluate(`(()=>{const input=document.querySelector('.coach-chat-compose input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Keep my reading draft');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(30);
    const compact=await evaluate(`(()=>{const b=document.querySelector('.preparation-shared-board').getBoundingClientRect();return {board:{x:b.x,y:b.y,width:b.width,height:b.height},history:document.querySelector('.coach-chat-history').clientHeight,calls:window.layoutChatCalls};})()`);
    for(const lang of ['de','en','az','tr','ua','ru']){
     const copy=coachChatCopy[lang==='ua'?'uk':lang];
     await evaluate('window.fixtureLanguage('+JSON.stringify(lang)+')');await wait(`document.querySelector('.coach-chat-expand').textContent===${JSON.stringify(copy.expandChat)}`);
     const beforeReading=await evaluate(`(()=>{const b=document.querySelector('.preparation-shared-board').getBoundingClientRect();return {board:{x:b.x,y:b.y,width:b.width,height:b.height},history:document.querySelector('.coach-chat-history').clientHeight};})()`);
     await evaluate(`document.querySelector('.coach-chat-expand').click()`);await wait(`document.querySelector('.coach-chat-expand').getAttribute('aria-expanded')==='true'`);await pause(30);
     const reading=await evaluate(`(()=>{const r=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};return{board:r('.preparation-shared-board'),panel:r('.coach-chat-panel'),history:r('.coach-chat-history'),compose:r('.coach-chat-compose'),intro:getComputedStyle(document.querySelector('.chessy-intro')).display,prompts:getComputedStyle(document.querySelector('.chessy-prompts')).display,label:document.querySelector('.coach-chat-expand').textContent,controlled:document.querySelector('.coach-chat-expand').getAttribute('aria-controls')===document.querySelector('.coach-chat-panel').id,draft:document.querySelector('.coach-chat-compose input').value,preview:document.querySelector('.coach-chat-study-nav span').textContent,calls:window.layoutChatCalls,scrollbar:getComputedStyle(document.querySelector('.coach-chat-history'),'::-webkit-scrollbar').width};})()`);
     assert.deepEqual({x:reading.board.x,y:reading.board.y,width:reading.board.width,height:reading.board.height},beforeReading.board,'expanding keeps the chessboard geometry '+lang);
     assert.ok(reading.panel.x>=reading.board.right+7,'reading panel never covers the board '+lang);
     assert.ok(reading.panel.y>=0&&reading.panel.bottom<=height-10&&reading.panel.right<=width-10,'reading panel fits viewport '+lang);
     assert.ok(reading.history.height>beforeReading.history+80,'reading mode gives the answer substantially more space '+lang);
     assert.ok(reading.history.bottom<=reading.compose.y,'answer and composer stay separate '+lang);
     assert.equal(reading.intro,'none');assert.equal(reading.prompts,'none');assert.equal(reading.label,copy.restoreChat);assert.equal(reading.controlled,true);
     assert.equal(reading.draft,'Keep my reading draft');assert.equal(reading.preview,'1 / 1');assert.equal(reading.calls,compact.calls,'expand makes no model request');
     assert.equal(reading.scrollbar,'16px','mouse can grab a wider native scrollbar');
     if(lang==='ru')await capture('chessy-reading-'+width+'x'+height);
     await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
     await wait(`document.querySelector('.coach-chat-expand').getAttribute('aria-expanded')==='false'`);
     assert.equal(await evaluate(`document.querySelector('.coach-chat-compose input').value`),'Keep my reading draft','Escape preserves draft');
    }
    // Drag the actual native thumb instead of simulating scrollTop changes.
    await evaluate(`document.querySelector('.coach-chat-expand').click()`);await pause(30);
    await evaluate(`(()=>{const list=document.querySelector('.coach-chat-history'),probe=document.createElement('div');probe.id='chessy-thumb-probe';probe.style.minHeight='900px';list.appendChild(probe);list.scrollTop=0;})()`);await pause(30);
    const thumb=await evaluate(`(()=>{const el=document.querySelector('.coach-chat-history'),r=el.getBoundingClientRect();return{x:Math.round(r.right-8),y:Math.round(r.top+16),bottom:Math.round(r.bottom-16),overflow:el.scrollHeight>el.clientHeight+20};})()`);
    assert.ok(thumb.overflow,'long answer needs a draggable scrollbar');
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:thumb.x,y:thumb.y,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:thumb.x,y:thumb.bottom,button:'left',buttons:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:thumb.x,y:thumb.bottom,button:'left',buttons:0,clickCount:1});
    await wait(`document.querySelector('.coach-chat-history').scrollTop>20`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:thumb.x,y:thumb.bottom,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:thumb.x,y:thumb.y,button:'left',buttons:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:thumb.x,y:thumb.y,button:'left',buttons:0,clickCount:1});
    await wait(`document.querySelector('.coach-chat-history').scrollTop<5`);
    await evaluate(`document.getElementById('chessy-thumb-probe').remove()`);
    await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height,deviceScaleFactor:1,mobile:false});
    await wait(`(()=>{const p=document.querySelector('.coach-chat-panel').getBoundingClientRect(),b=document.querySelector('.preparation-shared-board').getBoundingClientRect();return p.x>=b.right+7&&p.right>1420&&p.right<=1430;})()`);
    await cdp('Emulation.setDeviceMetricsOverride',{width:1100,height,deviceScaleFactor:1,mobile:false});
    await wait(`document.querySelector('.coach-chat-expand').getAttribute('aria-expanded')==='false'`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.coach-chat-expand')).display`),'none','stacked layout keeps its existing board/chat flow');
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(50);
    await evaluate(`document.querySelector('.coach-chat-expand').click()`);await pause(30);
    await evaluate(`document.querySelector('.coach-chat-expand').click()`);await pause(30);
    if(width===1280&&height===720){
     await evaluate(`(()=>{const probe=document.createElement('div');probe.id='chat-scroll-probe';probe.style.height='1200px';document.querySelector('.global-position-search').appendChild(probe);document.querySelector('.coach-chat-history').scrollIntoView({block:'center'});document.querySelector('.coach-chat-history').scrollTop=0;})()`);await pause(50);
     const at=await evaluate(`(()=>{const r=document.querySelector('.coach-chat-history').getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),outer:document.querySelector('[data-route-scroll]').scrollTop};})()`);
     await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:at.x,y:at.y,deltaX:0,deltaY:160});await wait(`document.querySelector('.coach-chat-history').scrollTop>0`);assert.ok(Math.abs(await evaluate(`document.querySelector('[data-route-scroll]').scrollTop`)-at.outer)<3,'inner chat gets the wheel before page');
     await evaluate(`document.querySelector('.coach-chat-history').scrollTop=document.querySelector('.coach-chat-history').scrollHeight`);await pause(30);await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:at.x,y:at.y,deltaX:0,deltaY:160});assert.ok(await evaluate(`document.querySelector('.coach-chat-history').scrollTop>0`),'chat uses its own scroll rather than route scroll');await evaluate(`document.getElementById('chat-scroll-probe').remove()`);
    }
    await evaluate(`document.querySelector('.coach-chat-panel').scrollIntoView({block:'center'})`);await pause(50);await capture('spieler-expanded-'+width+'x'+height);
    // The plan's verified Stockfish line appears immediately between idea and result.
    if(height===720){
     await evaluate("window.fixtureLanguage('ru')");
     await evaluate("document.querySelector('.chessy-prompts button').click()");
     await wait("document.querySelector('.coach-chat-plan-primary')");
     const illustrated=await evaluate("(()=>{const m=[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1),intro=m.querySelector(':scope>p'),plan=m.querySelector('.coach-chat-plan-primary'),result=m.querySelector('.coach-chat-plan-conclusion'),nav=m.querySelector('.coach-chat-study-nav'),actions=m.querySelector('.coach-chat-message-actions');return {text:intro?.textContent,plan:plan?.textContent,outcome:result?.textContent,order:!!(intro.compareDocumentPosition(plan)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(plan.compareDocumentPosition(result)&Node.DOCUMENT_POSITION_FOLLOWING),nav:nav?.textContent,copy:!!actions?.querySelector('.coach-chat-copy'),listen:!!actions?.querySelector('.coach-chat-listen'),alternatives:!!m.querySelector('.coach-chat-plan-alternatives')};})()");
     assert.ok(illustrated.text.includes('Позиция близка'),'brief objective assessment');
     assert.ok(illustrated.plan.includes('Показать план на доске'),'verified main line');
     assert.ok(illustrated.outcome.includes('решающего преимущества ещё нет'),'explains the actual result');
     assert.ok(illustrated.order,'plan → line → outcome');
     assert.ok(illustrated.nav.includes('0 / 2'),'starts at exact original FEN');
     assert.ok(illustrated.copy&&illustrated.listen&&illustrated.alternatives,'copy, audio and alternatives preserved');
     await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-study-nav button[aria-label]').nextElementSibling.nextElementSibling.click()");
     await wait("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-study-nav span').textContent.includes('1 / 2')");
     assert.ok(await evaluate("document.querySelector('.preparation-shared-board [data-piece-square]')!==null"),'move preview appears on the study board');
     assert.ok(illustrated.plan.includes('продолжение Stockfish'),'separate labelled continuation in plan');
     const beforeContinuation=await evaluate("[...document.querySelectorAll('.preparation-shared-board [data-piece-square]')].map(e=>e.getAttribute('data-piece-square')).sort().join(',')");
     await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-study-nav button[aria-label]').nextElementSibling.nextElementSibling.click()");
     await wait("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-study-nav span').textContent.includes('2 / 2')");
     assert.ok(await evaluate("document.querySelector('.coach-chat-continuation-boundary')!==null"),'replay crosses the visible continuation boundary');
     await wait("[...document.querySelectorAll('.preparation-shared-board [data-piece-square]')].map(e=>e.getAttribute('data-piece-square')).sort().join(',')!=="+JSON.stringify(beforeContinuation));
     const afterContinuation=await evaluate("[...document.querySelectorAll('.preparation-shared-board [data-piece-square]')].map(e=>e.getAttribute('data-piece-square')).sort().join(',')");
     assert.notEqual(afterContinuation,beforeContinuation,'continuation changes the actual shared board');
     assert.equal(await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-study-nav button[aria-label]').nextElementSibling.nextElementSibling.disabled"),true,'replay ends after continuation, not original PV');

     assert.equal(await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-plan-conclusion strong').textContent.trim()"),coachChatCopy.ru.planOutcome+':');
     for(const lang of ['de','en','az','tr','ua','ru']){
      await evaluate("window.fixtureLanguage("+JSON.stringify(lang)+")");
      const text=await evaluate("(()=>{const m=[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1);return {plan:m.querySelector('.coach-chat-plan-primary strong')?.textContent,outcome:m.querySelector('.coach-chat-plan-conclusion strong')?.textContent}})()");
      const tr=coachChatCopy[lang==='ua'?'uk':lang];
      assert.equal(text.plan,tr.planReplay,'plan localized '+lang);
      assert.equal(text.outcome?.trim(),tr.planOutcome+':','conclusion localized '+lang);
      assert.equal(await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-continuation strong').textContent.trim()"),chessyCopy[lang==='ua'?'uk':lang].stockfishContinuation+':','continuation localized '+lang);
     }
     await evaluate("window.fixtureLanguage('ru')");
     const beforeMain=await evaluate("document.querySelectorAll('.coach-chat-message.assistant').length");
     await evaluate("(()=>{const input=document.querySelector('.coach-chat-compose input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Объясни продолжение');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
     await evaluate("document.querySelector('.coach-chat-compose').requestSubmit()");
     await wait("document.querySelectorAll('.coach-chat-message.assistant').length>"+beforeMain);
     assert.equal(await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-plan-primary')===null"),true,'ordinary chat remains outside the plan schema');
     assert.equal(await evaluate("[...document.querySelectorAll('.coach-chat-message.assistant')].at(-1).querySelector('.coach-chat-continuation strong').textContent.trim()"),chessyCopy.ru.stockfishContinuation+':','main chat displays the same separate continuation');

    }
    await evaluate(`(()=>{document.querySelector('.coach-chat-toggle').click();for(const d of document.querySelectorAll('.position-advanced-settings[open]'))d.querySelector('summary').click();document.querySelector('[data-route-scroll]').scrollTop=0;})()`);
   }
   await evaluate("window.fixtureNavigate('/spieler?tab=opponent')");await wait(`!document.getElementById('spieler-section-panel-opponent').hidden`);await evaluate("window.fixtureLanguage('ru')");await pause(100);if(!verify)await capture('opponent-ru-'+width+'x'+height);
   if(verify){for(const lang of ['de','en','az','tr','ua','ru']){await evaluate('window.fixtureLanguage('+JSON.stringify(lang)+')');await pause(50);assert.equal(await evaluate(`document.querySelectorAll('#spieler-section-panel-opponent .spieler-search input').length`),1,'one opponent input');assert.equal(await evaluate(`[...document.querySelectorAll('#spieler-section-panel-opponent form')].filter(e=>e.getClientRects().length).length`),1,'one opponent search form');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'opponent overflow '+lang+' '+width);}await evaluate("window.fixtureLanguage('ru')");await evaluate(`(()=>{const input=document.querySelector('#spieler-section-panel-opponent .spieler-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Huseynov');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(50);await evaluate(`document.querySelector('#spieler-section-panel-opponent .spieler-search').requestSubmit()`);await wait(`document.querySelector('#spieler-section-panel-opponent .spieler-results button')`);await evaluate(`document.querySelector('#spieler-section-panel-opponent .spieler-results button').click()`);await wait(`document.querySelector('#spieler-section-panel-opponent .named-preparation')?.innerText.includes('0 ')`);assert.equal(await evaluate(`document.querySelectorAll('#spieler-section-panel-opponent .named-preparation .preparation-primary>form').length`),0,'no duplicate player lookup');assert.ok(await evaluate(`document.querySelector('#spieler-section-panel-opponent .spieler-results').innerText.includes('2371')`),'rating remains visible');await capture('opponent-ru-'+width+'x'+height);}
  }
  if(captureRoot)await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));console.log('PASS Spieler design: six locales, viewport work area, tabs, directory, promotion, navigation typography and overflow');
 }finally{for(const p of pending.values())clearTimeout(p.timer);try{ws?.close();}catch{}chrome?.kill('SIGKILL');await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkSpielerDesign({captureRoot:process.env.SPIELER_CAPTURE,phase:process.env.DESIGN_PHASE||'after',verify:process.env.DESIGN_PHASE!=='before'});
