import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {sectionsFixturePlugin} from './sectionsFixtures.mjs';

const officialUrls = [
 'https://www.schachbund.de/index.php/turnierdatenbank-nordrhein-westfalen.html',
 'https://www.schachbundesliga.de/',
 'https://ergebnisdienst.schachbund.de/bedh.php?liga=olnr',
 'https://ergebnisdienst.svr-schach.de/',
 'https://www.schachbund.de/vereinsfinder.html',
];
const emptyNews = {
 de:'Keine aktuellen Meldungen verfügbar.',en:'No current news available.',az:'Hazırda xəbər yoxdur.',
 tr:'Güncel haber yok.',ua:'Немає актуальних новин.',ru:'Актуальных новостей нет.',
};
const newsSource = {
 de:'Schachbezirk Bochum · externe Quelle',en:'Bochum chess district · external source',
 az:'Bochum şahmat bölgəsi · xarici mənbə',tr:'Bochum satranç bölgesi · dış kaynak',
 ua:'Шаховий округ Бохум · зовнішнє джерело',ru:'Шахматный округ Бохума · внешний источник',
};

export async function checkNRWDesign({root=process.cwd(),captureRoot,phase='after',verify=true}={}){
 const plugin=sectionsFixturePlugin(),load=plugin.load;
 plugin.load=id=>{
  let code=load(id);
  if(id==='/__sections_fixture.tsx'){
   code=code.replace('import{LanguageProvider}', 'import{LanguageProvider,useLanguage}').replace('<LanguageProvider><MemoryRouter>', '<LanguageProvider><LanguageProbe/><MemoryRouter initialEntries={["/region/nrw"]}>').replace("<Route path='/region/:regionId' element={<NRW/>}/>","<Route path='/region/:regionId' element={<NRW/>}/><Route path='/region/:regionId/:section' element={<NRW/>}/>");
   code=code.replace("import NRW from", "import Clubs from '/src/screens/ClubsNRWScreen.tsx';import Profile from '/src/screens/ProfileScreen.tsx';import NRW from")
    .replace("<Route path='/region/:regionId' element={<NRW/>}/>", "<Route path='/clubs-nrw' element={<Clubs/>}/><Route path='/clubs-nrw/:slug' element={<Clubs/>}/><Route path='/profile' element={<Profile/>}/><Route path='/chat' element={<h1>Chat destination</h1>}/><Route path='/region/:regionId' element={<NRW/>}/>");
   code+=`function LanguageProbe(){const {setLanguage}=useLanguage();window.fixtureLanguage=setLanguage;return null;}`;
   code=code.replace("else if(path==='/api/clubs-nrw/news')data={items:[]};",`else if(path==='/api/clubs-nrw/news'){
    if(window.nrwNewsFailure)return new Response('fixture error',{status:503});
    data={items:window.nrwEmpty?[]:Array.from({length:5},(_,index)=>({title:'QA headline '+index,url:'https://example.org/news-'+index}))};
   }`);
  }
  if(id==='\0sections-auth')return `export function useAuth(){return{user:window.nrwGuest?null:{id:'qa-user'},session:window.nrwGuest?null:{access_token:'nrw-fixture-only'},isLoading:false};}`;
  if(id==='\0sections-db')return `
const clubs=[{id:'qa-bochum',slug:'qa-bochum',name:'QA Schachgesellschaft Bochum — Mannschaft und Nachwuchs',city:'Bochum'},{id:'qa-essen',slug:'qa-essen',name:'QA Schachverein Essen',city:'Essen'},{id:'qa-duesseldorf',slug:'qa-duesseldorf',name:'QA Düsseldorfer Schachklub',city:'Düsseldorf'},{id:'qa-other',slug:'qa-other',name:'QA Schachverein Bochum',city:'Bochum'}];
const events=Array.from({length:5},(_,n)=>({id:'qa-event-'+n,club_id:clubs[n%4].id,title:'QA Turnier '+(n+1)+' — Offene Stadtmeisterschaft',starts_at:'2026-12-0'+(n+1)+'T18:30:00Z',venue:'QA Vereinsheim'}));
const leagues=Array.from({length:5},(_,n)=>({id:'qa-league-'+n,club_id:clubs[n%4].id,season:'2026/27',league:'QA NRW-Klasse',team:'QA Mannschaft '+(n+1),place:n+1,played:4,match_points:6-n}));
export const supabase={from(table){window.nrwDbReads=(window.nrwDbReads||0)+1;let single=false,filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},or(){return q},gte(){return q},order(){return q},limit(){return q},abortSignal(){return q},maybeSingle(){single=true;return q},then(resolve,reject){const tables={clubs_nrw:clubs.map(c=>({...c,published:true})),clubs_nrw_calendar:events,clubs_nrw_league_rows:leagues,clubs_nrw_members:[{user_id:'qa-user',club_id:'qa-bochum'}],clubs_nrw_room_links:window.nrwNoClubDetails?[]:[{club_id:'qa-bochum',room_id:'qa-room'}],clubs_nrw_duels:window.nrwNoClubDetails?[]:[{id:'qa-duel',home_club_id:'qa-bochum',away_club_id:'qa-essen',title:'QA duel',status:'proposed'}]};let rows=window.nrwEmpty||window.nrwNoClubDetails&&['clubs_nrw_calendar','clubs_nrw_league_rows'].includes(table)?[]:(tables[table]||[]).filter(r=>filters.every(f=>f(r)));return new Promise(r=>setTimeout(r,window.nrwClubDelay||0)).then(()=>({data:single?(rows[0]||null):rows,error:window.nrwFailure?{message:'synthetic unavailable'}:null})).then(resolve,reject)}};return q}};
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
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(captureRoot)await mkdir(captureRoot,{recursive:true});
  const capture=async name=>{if(captureRoot){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(captureRoot,phase+'-'+name+'.png'),Buffer.from(shot.data,'base64'));}};
  for(const [width,height] of [[1280,720],[1920,950],[375,844]]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===375});
   await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});
   await wait("document.querySelectorAll('.nrw-news .nrw-items a').length===3");
   for(const lang of (verify?['de','en','az','tr','ua','ru']:['de','ru'])){
    await evaluate('window.fixtureLanguage('+JSON.stringify(lang)+')');await evaluate('document.fonts.ready');await pause(60);
    if(lang==='de'||lang==='ru')await capture('nrw-'+lang+'-'+width+'x'+height);
    const metric=await evaluate(`(()=> {
     const root=document.querySelector('.nrw-overview');
     const bounds=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const links=selector=>[...root.querySelectorAll(selector)].map(a=>({
      href:a.getAttribute('href'),text:a.innerText,target:a.target,rel:a.rel,icon:!!a.querySelector('svg[aria-hidden="true"]'),
      ...bounds(a),
     }));
     const title=root.querySelector('h1');
     const style=getComputedStyle(title), subtitle=getComputedStyle(root.querySelector('.nrw-header p'));
     const canvas=document.createElement('canvas').getContext('2d');
     const rgb=value=>{canvas.clearRect(0,0,1,1);canvas.fillStyle=value;canvas.fillRect(0,0,1,1);return [...canvas.getImageData(0,0,1,1).data].slice(0,3);};
     const luminance=value=>rgb(value).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
      .reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
     const colors=style.backgroundImage.match(/(?:rgb|color)\\([^)]*\\)/g)||[];
     const contrast=Math.min(...colors.map(color=>(luminance(color)+.05)/(luminance(getComputedStyle(root).backgroundColor)+.05)));
     return {
      width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      cards:[...root.querySelectorAll('.nrw-grid>.nrw-card')].map(bounds),
      official:links('.nrw-official-links a'),headlines:links('.nrw-news .nrw-items a'),actions:links('.nrw-header .nrw-links a'),
      removed:root.querySelectorAll('.nrw-header-top,.nrw-kicker,.nrw-region-code,.nrw-signin,.section-info,.nrw-count,.nrw-footer,.nrw-chat-rail,select,details,[href="/spieltag"],[href^="/profile"],[href^="/clubs-nrw"],[href="/region/nrw/turniere"],[href="/region/nrw/ligen"],[href="/region/nrw/vereine"],iframe').length,
      newsLinks:links('.nrw-news-links a').map(a=>a.href),gradient:style.backgroundImage,contrast,
      subtitle:[subtitle.fontSize,subtitle.fontWeight,subtitle.color,subtitle.maxWidth,subtitle.marginTop,subtitle.marginBottom],
      dbReads:window.nrwDbReads||0,
     };
    })()`);
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
      const bronzeLabels=await evaluate(`(()=>{const labels=[...document.querySelectorAll('aside .site-nav-label')].filter(e=>e.getClientRects().length);return labels.map(el=>({label:el.textContent,metal:el.classList.contains('site-nav-label--bronze'),gradient:getComputedStyle(el).backgroundImage.includes('linear-gradient')}));})()`);
      assert.deepEqual(bronzeLabels.filter(v=>v.metal).map(v=>v.label).sort(),['NRW – Schach','Schach-Treff'],'only NRW and Schach-Treff receive bronze lettering');
      assert.ok(bronzeLabels.filter(v=>v.metal).every(v=>v.gradient),'metallic gradient rendered');
      assert.ok(bronzeLabels.filter(v=>!v.metal).every(v=>!v.gradient),'other menu labels unchanged');
      const nrwHeadings=await evaluate(`(()=>[...document.querySelectorAll('.nrw-card-head h2')].map(el=>getComputedStyle(el).backgroundImage.includes('linear-gradient')))()`);
      assert.ok(nrwHeadings.length===3 && nrwHeadings.every(Boolean),'three metallic NRW headings');
     }
    }
    if(verify){
     assert.equal(metric.documentWidth,width,'no horizontal overflow '+lang);
     assert.equal(metric.cards.length,3,'three core panels');
     assert.equal(metric.removed,0,'legacy controls and metadata stay outside the overview');
     assert.equal(metric.dbReads,0,'landing never queries the database');
     assert.deepEqual(metric.official.map(link=>link.href),officialUrls);
     assert.equal(metric.headlines.length,3,'three headlines visible without interaction');
     assert.deepEqual(metric.headlines.map(link=>link.href),[0,1,2].map(index=>'https://example.org/news-'+index));
     assert.ok(metric.headlines.every(link=>link.text.includes(newsSource[lang])),'all headlines keep their localized source');
     for(const link of [...metric.official,...metric.headlines]){
      assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.ok(link.icon);
      assert.ok(link.x>=0&&link.right<=width+1,'external link fits: '+link.href);
     }
     assert.deepEqual(metric.newsLinks,['/region/nrw/news','/region/nrw/live']);
     assert.deepEqual(metric.actions.map(link=>link.href),['/vorbereitung','/chat']);
     assert.ok(metric.actions.every(link=>link.icon&&link.height>=44));
     assert.equal(metric.actions[0].width,metric.actions[1].width,'equal top actions');
     assert.ok(metric.gradient.startsWith('linear-gradient')&&Number.isFinite(metric.contrast)&&metric.contrast>=4.5,'heading gradient contrast: '+JSON.stringify({gradient:metric.gradient,contrast:metric.contrast}));
     assert.deepEqual(metric.subtitle,['17px','400','rgb(216, 211, 200)','640px','12px','28px']);
     if(width>=1280){
      assert.ok(metric.cards.every(card=>Math.abs(card.y-metric.cards[0].y)<1&&Math.abs(card.height-metric.cards[0].height)<1&&Math.abs(card.width-metric.cards[0].width)<1),'equal desktop cards');
      assert.equal(metric.actions[0].y,metric.actions[1].y,'top actions share a row');
     }else{
      assert.ok(metric.cards.every((card,i)=>!i||card.y>=metric.cards[i-1].bottom),'mobile cards stack');
      assert.ok(metric.actions[1].y>=metric.actions[0].bottom,'mobile actions wrap without clipping');
     }
    }
   }
   if(!verify)continue;
   await evaluate("window.fixtureLanguage('de')");await pause(50);
   await evaluate("document.querySelector('.nrw-news a[href=\"/region/nrw/news\"]').click()");await wait("document.querySelector('.nrw-grid--detail .nrw-card--news')");
   await wait("document.querySelectorAll('.nrw-card--news .nrw-items a').length===5");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-card').length"),1,'news details route retains one focused panel');
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'news details overflow');
   for(const section of ['turniere','ligen','vereine','live']){
    await evaluate('window.fixtureNavigate('+JSON.stringify('/region/nrw/'+section)+')');await wait('document.querySelector('+JSON.stringify('.nrw-grid--detail .nrw-card--'+section)+')');
    assert.equal(await evaluate("document.querySelectorAll('.nrw-card').length"),1,'legacy route '+section);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'details overflow '+section);
    await evaluate("document.querySelector('.nrw-back a').click()");await wait("document.querySelectorAll('.nrw-grid>.nrw-card').length===3");
   }
   await evaluate("window.fixtureNavigate('/region/nrw/vereine')");await wait("document.querySelector('.nrw-select select option[value=\"\"]')");
   await wait("document.querySelector('.nrw-card--vereine .nrw-items a')");
   await evaluate(`(()=>{const el=document.querySelector('.nrw-select select');el.value='Essen';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await wait("document.querySelector('.nrw-card--vereine .nrw-items')?.innerText.includes('Essen')");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-card--vereine .nrw-items li').length"),1,'legacy city filter still works');
   await evaluate("window.fixtureNavigate('/region/nrw/vereine')");await wait("document.querySelector('.nrw-card--vereine a[href=\"/clubs-nrw\"]')");
   await evaluate("document.querySelector('.nrw-card--vereine a[href=\"/clubs-nrw\"]').click()");await wait("document.querySelector('.nrw-club-page a[href=\"/clubs-nrw/qa-bochum\"]')");
   await evaluate("window.nrwClubDelay=350;document.querySelector('.nrw-club-page a[href=\"/clubs-nrw/qa-bochum\"]').click()");
   await wait("document.querySelector('.nrw-club-page [role=status]')");assert.doesNotMatch(await evaluate("document.querySelector('.nrw-club-page').innerText"),/Verein nicht gefunden/);
   await wait("document.querySelector('.nrw-club-page a[href=\"/chat?club=qa-room\"]')");
   assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'club detail overflow');
   assert.match(await evaluate("document.querySelector('.nrw-club-page').innerText"),/QA duel · Vorschlag/);
   await evaluate("document.querySelector('.nrw-club-page a[href=\"/chat?club=qa-room\"]').click()");await wait("document.body.innerText.includes('Chat destination')");
   await evaluate("window.nrwNoClubDetails=true;window.nrwClubDelay=0;window.fixtureNavigate('/clubs-nrw/qa-bochum')");
   await wait("document.querySelector('.nrw-club-page')?.innerText.includes('Noch keine Turniertermine eingetragen.')");
   for(const phrase of ['Noch keine Tabellen eingetragen.','Kein Vereinsraum verfügbar.','Noch keine Duelle vorgeschlagen.'])assert.ok(await evaluate("document.querySelector('.nrw-club-page').innerText.includes("+JSON.stringify(phrase)+")"),phrase);
   await evaluate("window.fixtureLanguage('ru')");await wait("document.querySelector('.nrw-club-page')?.innerText.includes('Турниры пока не запланированы.')");
   for(const [locale,copy] of [['en','No tournaments scheduled yet.'],['az','Hələ turnir tarixi qeyd edilməyib.'],['tr','Henüz turnuva planlanmadı.'],['ua','Турнірів ще не заплановано.']]){
    await evaluate('window.fixtureLanguage('+JSON.stringify(locale)+')');
    await wait("document.querySelector('.nrw-club-page')?.innerText.includes("+JSON.stringify(copy)+")");
   }
   await evaluate("window.nrwNoClubDetails=false;window.fixtureLanguage('de');window.fixtureNavigate('/profile?returnTo=%2Fregion%2Fnrw%2Fturniere')");
   await wait("document.querySelector('.nrw-grid--detail .nrw-card--turniere')");
   assert.ok(!await evaluate("document.querySelector('.nrw-card--turniere .nrw-signin')"),'authenticated NRW return destination');
   await evaluate("window.nrwGuest=true;window.nrwEmpty=true;window.fixtureNavigate('/region/invalid')");
   await wait("!document.querySelector('[data-region-overview]')");
   await evaluate("window.fixtureNavigate('/region/nrw')");
   await wait("document.querySelector('.nrw-news [role=status]')?.innerText.includes('Keine aktuellen Meldungen verfügbar.')");
   for(const [locale,phrase] of Object.entries(emptyNews)){
    await evaluate('window.fixtureLanguage('+JSON.stringify(locale)+')');
    await wait("document.querySelector('.nrw-news [role=status]')?.innerText==="+JSON.stringify(phrase));
   }
   await evaluate("window.nrwGuest=false;window.fixtureLanguage('de');window.nrwNewsFailure=true;window.fixtureNavigate('/region/invalid')");
   await wait("!document.querySelector('[data-region-overview]')");
   await evaluate("window.fixtureNavigate('/region/nrw')");
   await wait("document.querySelector('.nrw-news [role=status]')?.innerText==='Nachrichten derzeit nicht verfügbar.'");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-news [role=status]').length"),1);
   await evaluate("window.nrwNewsFailure=false");
   if(width===375){
    await evaluate("window.fixtureNavigate('/')");
    await wait("document.querySelector('.home-screen-root a[href=\"/region/nrw\"]')?.getBoundingClientRect().height>=44");
    await evaluate("document.querySelector('.home-screen-root a[href=\"/region/nrw\"]').click()");
    await wait("document.querySelector('[data-region-overview]')");
   }
   for(const [section,phrase] of [['turniere','Keine bestätigten kommenden Termine'],['ligen','Noch keine Tabellen'],['vereine','Keine veröffentlichten Vereine'],['news','Keine aktuellen Meldungen'],['live','Derzeit keine für NRW']]){
    await evaluate('window.fixtureNavigate('+JSON.stringify('/region/nrw/'+section)+')');
    await wait('document.querySelector('+JSON.stringify('.nrw-card--'+section)+')?.innerText.includes('+JSON.stringify(phrase)+')');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'empty detail overflow '+section);
   }
   await evaluate("window.nrwEmpty=false;window.nrwFailure=true;window.fixtureNavigate('/region/invalid')");await wait("!document.querySelector('[data-region-overview]')");await evaluate("window.fixtureNavigate('/region/nrw/vereine')");await wait("document.querySelector('.nrw-error[role=alert]')");assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'failure state overflow');
  }
  if(captureRoot)await writeFile(join(captureRoot,phase+'-measurements.json'),JSON.stringify(measurements,null,2));
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));console.log(verify?'PASS NRW design: six locales; 1280px, 1920px and 375px; official links, heading contrast, open news, legacy routes, guest, empty and error states':'Captured NRW baseline in DE and RU');
 }finally{for(const p of pending.values())clearTimeout(p.timer);try{ws?.close();}catch{}chrome?.kill('SIGKILL');await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkNRWDesign({captureRoot:process.env.NRW_CAPTURE,phase:process.env.NRW_PHASE||'after',verify:process.env.NRW_PHASE!=='before'});
