import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {sectionsFixturePlugin} from './sectionsFixtures.mjs';

export async function checkNRWDesign({root=process.cwd(),captureRoot,phase='after',verify=true}={}){
 const plugin=sectionsFixturePlugin(),load=plugin.load;
 plugin.load=id=>{
  let code=load(id);
  if(id==='/__sections_fixture.tsx'){
   code=code.replace('import{LanguageProvider}', 'import{LanguageProvider,useLanguage}').replace('<LanguageProvider><MemoryRouter>', '<LanguageProvider><LanguageProbe/><MemoryRouter initialEntries={["/region/nrw"]}>').replace("<Route path='/region/:regionId' element={<NRW/>}/>","<Route path='/region/:regionId' element={<NRW/>}/><Route path='/region/:regionId/:section' element={<NRW/>}/>");
   code+=`function LanguageProbe(){const {setLanguage}=useLanguage();window.fixtureLanguage=setLanguage;return null;}`;
   code=code.replace("data={items:[]}","data={items:window.nrwEmpty?[]:[{title:'QA: Mannschaftsmeisterschaft — neue Termine',url:'https://example.org/nrw-qa-news'},{title:'QA: Jugendtraining im Verein',url:'https://example.org/nrw-qa-training'}]}");
  }
  if(id==='\0sections-auth')return `export function useAuth(){return{user:window.nrwGuest?null:{id:'qa-user'},session:window.nrwGuest?null:{access_token:'nrw-fixture-only'},isLoading:false};}`;
  if(id==='\0sections-db')return `
const clubs=[{id:'qa-bochum',slug:'qa-bochum',name:'QA Schachgesellschaft Bochum — Mannschaft und Nachwuchs',city:'Bochum'},{id:'qa-essen',slug:'qa-essen',name:'QA Schachverein Essen',city:'Essen'},{id:'qa-duesseldorf',slug:'qa-duesseldorf',name:'QA Düsseldorfer Schachklub',city:'Düsseldorf'},{id:'qa-other',slug:'qa-other',name:'QA Schachverein Bochum',city:'Bochum'}];
const events=Array.from({length:5},(_,n)=>({id:'qa-event-'+n,club_id:clubs[n%4].id,title:'QA Turnier '+(n+1)+' — Offene Stadtmeisterschaft',starts_at:'2026-12-0'+(n+1)+'T18:30:00Z',venue:'QA Vereinsheim'}));
const leagues=Array.from({length:5},(_,n)=>({id:'qa-league-'+n,club_id:clubs[n%4].id,season:'2026/27',league:'QA NRW-Klasse',team:'QA Mannschaft '+(n+1),place:n+1,played:4,match_points:6-n}));
export const supabase={from(table){let single=false,filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},gte(){return q},order(){return q},limit(){return q},abortSignal(){return q},maybeSingle(){single=true;return q},then(resolve,reject){const tables={clubs_nrw:clubs.map(c=>({...c,published:true})),clubs_nrw_calendar:events,clubs_nrw_league_rows:leagues,clubs_nrw_members:[{user_id:'qa-user',club_id:'qa-bochum'}]};let rows=window.nrwEmpty?[]:(tables[table]||[]).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:single?(rows[0]||null):rows,error:window.nrwFailure?{message:'synthetic unavailable'}:null}).then(resolve,reject)}};return q}};
`;
  return code;
 };
 const server=await createServer({root,configFile:false,cacheDir:join(tmpdir(),'chessaz-sections-vite-'+process.pid+'-nrw-'+phase),optimizeDeps:{include:['react','react-dom/client','react-router-dom','chess.js','lucide-react'],noDiscovery:true},plugins:[plugin,react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}},define:Object.fromEntries([
  ['VITE_SERVER_URL','https://sections-fixture.invalid'],...['VITE_SPIELER_V1_ENABLED','VITE_CLUBS_NRW_ENABLED','VITE_SPIELTAG_ENABLED','VITE_VORBEREITUNG_ENABLED','VITE_POSITION_SEARCH_ENABLED'].map(k=>[k,'true'])
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
  const fill=(label,value)=>evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const el=label?.control||label?.querySelector('input');if(!el)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(captureRoot)await mkdir(captureRoot,{recursive:true});
  const capture=async name=>{if(captureRoot){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(captureRoot,phase+'-'+name+'.png'),Buffer.from(shot.data,'base64'));}};
  for(const [width,height] of [[1280,720],[1280,900],[390,844]]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
   await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});
   await wait("document.querySelector('.nrw-items a')");
   for(const lang of (verify?['de','en','az','tr','ua','ru']:['de','ru'])){
    await evaluate('window.fixtureLanguage('+JSON.stringify(lang)+')');await evaluate('document.fonts.ready');await pause(60);
    if(lang==='de'||lang==='ru')await capture('nrw-'+lang+'-'+width+'x'+height);
    const metric=await evaluate(`(()=>{const root=document.querySelector('.nrw-shell'),cards=[...root.querySelectorAll('.nrw-grid>.nrw-card')],r=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,headings:cards.map(e=>e.querySelector('h2').textContent),cards:cards.map(r),newsClosed:!root.querySelector('.nrw-news')?.open,rail:!!root.querySelector('.nrw-chat-rail'),scrolls:[...root.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+1&&/^(auto|scroll)$/.test(getComputedStyle(e).overflowY)).length,links:[...root.querySelectorAll('a')].filter(e=>e.getClientRects().length).map(e=>e.getAttribute('href')),cityLines:[...root.querySelectorAll('.nrw-card--vereine .nrw-items a')].map(e=>({title:r(e.querySelector('strong')),city:r(e.querySelector('small'))}))};})()`);
    measurements.push({lang,...metric});
    if(verify && (lang==='de'||lang==='ru')){
     const navMetrics=await evaluate(`(()=>{const links=[...document.querySelectorAll('aside nav .site-nav-link')].filter(e=>e.getClientRects().length);
      return links.map(link=>{const label=link.querySelector('.site-nav-label'),icon=link.firstElementChild,box=link.getBoundingClientRect(),r=label?.getBoundingClientRect(),i=icon?.getBoundingClientRect();
       return {name:label?.textContent||'',height:box.height,topGap:r?Math.abs(r.top-box.top):999,bottomGap:r?Math.abs(box.bottom-r.bottom):999,
        iconCenter:i?(i.top+i.bottom)/2:0,labelCenter:r?(r.top+r.bottom)/2:0,wrap:label?label.getBoundingClientRect().height>parseFloat(getComputedStyle(label).lineHeight)+2:false,
        clipped:label?label.scrollWidth>label.clientWidth+1:false,weight:label?parseInt(getComputedStyle(label).fontWeight):0,
        fontSize:label?parseFloat(getComputedStyle(label).fontSize):0};});})()`);
     if(width===1280){assert.ok(navMetrics.length>=5,'desktop menu mounted');
      assert.ok(navMetrics.every(v=>Math.abs(v.topGap-v.bottomGap)<=2),'vertical center: '+JSON.stringify(navMetrics));
      assert.ok(navMetrics.every(v=>Math.abs(v.iconCenter-v.labelCenter)<=2),'icon-label center: '+JSON.stringify(navMetrics));
      assert.ok(navMetrics.every(v=>!v.wrap&&!v.clipped&&v.fontSize>=15&&v.fontSize<=16&&v.weight>=500&&v.weight<=600),'readable one-line navigation: '+JSON.stringify(navMetrics));
      assert.ok(new Set(navMetrics.map(v=>Math.round(v.height))).size===1,'equal menu heights');
      assert.equal(navMetrics.find(v=>v.name==='Schach-Treff')?.name,'Schach-Treff','no subtitle');
     }
    }
    if(verify){
     assert.ok(metric.documentWidth<=width+1,'NRW overflow '+JSON.stringify(metric));assert.equal(metric.cards.length,3,'only three core panels');assert.equal(metric.rail,true,'national chat rail restored');assert.equal(metric.newsClosed,true,'news is secondary and closed initially');assert.equal(metric.scrolls,0,'no nested NRW scrolling');
     assert.ok(metric.links.includes('/vorbereitung'),'preparation entry preserved');assert.ok(!await evaluate("!!document.querySelector('.nrw-grid .nrw-card--live')"),'no unavailable broadcast card');
     assert.ok(metric.cityLines.every(r=>r.city.y>=r.title.bottom-1),'club city has its own line');
     if(width===1280){assert.equal(new Set(metric.cards.map(r=>Math.round(r.y))).size,1,'aligned core panels');assert.ok(metric.cards.every(r=>r.bottom<=height),'core panels fit '+lang+' '+JSON.stringify(metric));assert.ok(metric.cards.every(r=>r.width>=240),'readable panel width');}
     else assert.ok(metric.cards.every((r,i)=>!i||r.y>=metric.cards[i-1].bottom),'mobile panels stack');
     const gaps=await evaluate(`(()=>{const root=document.querySelector('.nrw-shell'),all=[...root.querySelectorAll('a,summary,select')].filter(e=>e.getClientRects().length);return all.every(e=>e.getBoundingClientRect().height>=32)})()`);assert.ok(gaps,'comfortable targets '+lang+' '+width);
    }
   }
   if(!verify)continue;
   await evaluate("window.fixtureLanguage('de')");await pause(50);
   await evaluate(`(()=>{const el=document.querySelector('.nrw-select select');el.value='Essen';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait("document.querySelector('.nrw-card--vereine .nrw-items')?.innerText.includes('Essen')");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-card--vereine .nrw-items li').length"),1,'city filter narrows actual rendered clubs');
   await evaluate("document.querySelector('.nrw-news summary').click()");await wait("document.querySelector('.nrw-news').open");assert.ok(await evaluate("document.querySelector('.nrw-news').innerText.includes('QA: Mannschaftsmeisterschaft')"),'news accessible on demand');
   await evaluate("document.querySelector('.nrw-news a[href=\"/region/nrw/news\"]').click()");await wait("document.querySelector('.nrw-grid--detail .nrw-card--news')");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-card').length"),1,'news details route retains one focused panel');
   for(const section of ['turniere','ligen','vereine','live']){
    await evaluate('window.fixtureNavigate('+JSON.stringify('/region/nrw/'+section)+')');await wait('document.querySelector('+JSON.stringify('.nrw-grid--detail .nrw-card--'+section)+')');
    assert.equal(await evaluate("document.querySelectorAll('.nrw-card').length"),1,'legacy route '+section);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'details overflow '+section);
    await evaluate("document.querySelector('.nrw-back a').click()");await wait("document.querySelectorAll('.nrw-grid>.nrw-card').length===3");
   }
   await evaluate("window.nrwGuest=true;window.fixtureNavigate('/region/invalid')");await wait("!document.querySelector('[data-region-overview]')");await evaluate("window.fixtureNavigate('/region/nrw')");await wait("document.querySelector('.nrw-signin')");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-signin').length"),2,'guest has actionable access explanations');assert.ok(await evaluate("[...document.querySelectorAll('.nrw-signin')].every(a=>a.getAttribute('href').startsWith('/profile?returnTo='))"),'login return destinations');await capture('guest-'+width);
   await evaluate("window.nrwGuest=false;window.nrwEmpty=true;window.fixtureNavigate('/region/invalid')");await wait("!document.querySelector('[data-region-overview]')");await evaluate("window.fixtureNavigate('/region/nrw')");await wait("document.querySelector('.nrw-card--vereine .nrw-muted')&&!document.querySelector('.nrw-card [role=status]')");assert.equal(await evaluate("document.querySelectorAll('.nrw-grid>.nrw-card').length"),3,'empty state retains clear tasks');
   await evaluate("window.nrwEmpty=false;window.nrwFailure=true;window.fixtureNavigate('/region/invalid')");await wait("!document.querySelector('[data-region-overview]')");await evaluate("window.fixtureNavigate('/region/nrw')");await wait("document.querySelector('.nrw-error[role=alert]')");assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'failure state overflow');
  }
  if(captureRoot)await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));console.log(verify?'PASS NRW design: six locales; 1280x720, 1280x900 and 390px; core hierarchy, city filter, collapsible news, legacy routes, guest, empty and error states':'Captured NRW baseline in DE and RU');
 }finally{for(const p of pending.values())clearTimeout(p.timer);try{ws?.close();}catch{}chrome?.kill('SIGKILL');await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkNRWDesign({captureRoot:process.env.NRW_CAPTURE,phase:process.env.NRW_PHASE||'after',verify:process.env.NRW_PHASE!=='before'});
