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
const bochumTitles = {
 de:'Schach in Bochum',en:'Chess in Bochum',az:'Bochumda şahmat',tr:"Bochum'da satranç",
 ua:'Шахи в Бохумі',ru:'Шахматы в Бохуме',
};
const bochumBadges = {
 de:'Unsere Stadt',en:'Our city',az:'Bizim şəhər',tr:'Bizim şehir',ua:'Наше місто',ru:'Наш город',
};
const directoryHeadings = {
 de:'Schachleben in Bochum',en:'Chess life in Bochum',az:'Bochumda şahmat həyatı',
 tr:"Bochum'da satranç hayatı",ua:'Шахове життя Бохума',ru:'Шахматная жизнь Бохума',
};
const directoryTitles = [
 'Schachbezirk Bochum','Bochumer Schachverein 02','SC Gerthe 46 – Werne','SG Bochum 31',
 'SV Günnigfeld 1922','SV Linden-Dahlhausen 1922','SV Wattenscheid 1930','Stadt Bochum',
];
const localeIds = {de:'de-DE',en:'en-GB',az:'az-AZ',tr:'tr-TR',ua:'uk-UA',ru:'ru-RU'};
const fullRegionNames = {
 de:['Niederrhein','Münsterland','Ostwestfalen-Lippe','Ruhrgebiet','Mittelrhein','Südwestfalen'],
 en:['Lower Rhine','Münsterland','East Westphalia-Lippe','Ruhr region','Middle Rhine','South Westphalia'],
 az:['Aşağı Reyn','Münsterland','Şərqi Vestfaliya-Lippe','Rur bölgəsi','Orta Reyn','Cənubi Vestfaliya'],
 tr:['Aşağı Ren','Münsterland','Doğu Vestfalya-Lippe','Ruhr Bölgesi','Orta Ren','Güney Vestfalya'],
 ua:['Нижній Рейн','Мюнстерланд','Східна Вестфалія-Ліппе','Рурський регіон','Середній Рейн','Південна Вестфалія'],
 ru:['Нижний Рейн','Мюнстерланд','Восточная Вестфалия-Липпе','Рурский регион','Средний Рейн','Южная Вестфалия'],
};
const sourceUrls = [
 'https://schach-nrw.de/', 'https://www.sjnrw.de/news/news.html', 'https://schulschach-nrw.org/news',
 'https://www.schachbund.de/nachrichten-der-lv.html', 'https://www.schachbundesliga.de/', 'https://de.chessbase.com/',
 'https://svr-schach.de/', 'https://www.nsv1901.de/', 'https://ergebnisportal.sv-mittelrhein.de/',
 'https://schachverband-owl.de/', 'https://www.svmuensterland.de/', 'https://schach-swf.de/',
];

export async function checkNRWDesign(options={}){
 await checkLayout({...options,mapEnabled:true});
 if(options.verify!==false)await checkLayout({...options,captureRoot:undefined,phase:'map-off',mapEnabled:false});
}

async function checkLayout({root=process.cwd(),captureRoot,phase='after',verify=true,mapEnabled}){
 const plugin=sectionsFixturePlugin(),load=plugin.load;
 plugin.load=id=>{
  let code=load(id);
  if(id==='/__sections_fixture.tsx'){
   code=["400","500","600","700"].map(weight=>`import '@fontsource/inter/${weight}.css';`).join('')+code;
   code=code.replace('import{LanguageProvider}', 'import{LanguageProvider,useLanguage}').replace('<LanguageProvider><MemoryRouter>', '<LanguageProvider><LanguageProbe/><MemoryRouter initialEntries={["/region/nrw"]}>').replace("<Route path='/region/:regionId' element={<NRW/>}/>","<Route path='/region/:regionId' element={<NRW/>}/><Route path='/region/:regionId/:section' element={<NRW/>}/>");
   code=code.replace("import NRW from", "import Clubs from '/src/screens/ClubsNRWScreen.tsx';import Profile from '/src/screens/ProfileScreen.tsx';import NRW from")
    .replace("<Route path='/region/:regionId' element={<NRW/>}/>", "<Route path='/clubs-nrw' element={<Clubs/>}/><Route path='/clubs-nrw/:slug' element={<Clubs/>}/><Route path='/profile' element={<Profile/>}/><Route path='/chat' element={<h1>Chat destination</h1>}/><Route path='/region/:regionId' element={<NRW/>}/>");
   code+=`function LanguageProbe(){const {setLanguage}=useLanguage();window.fixtureLanguage=setLanguage;return null;}`;
   code=code.replace("else if(path==='/api/clubs-nrw/news')data={items:[]};",`else if(path==='/api/clubs-nrw/news'){
    window.nrwNewsRequests=(window.nrwNewsRequests||0)+1;
    if(window.nrwNewsDelay)await new Promise(resolve=>setTimeout(resolve,window.nrwNewsDelay));
    if(window.nrwNewsFailure)return new Response('fixture error',{status:503});
    const now=Date.now();
    const updatedAt=new Date(now).toISOString();
    const regions=['nrw','bochum','ruhrgebiet','nrw','bochum','bochum','ruhrgebiet','bochum',
     ...Array.from({length:19},(_,index)=>['niederrhein','owl','muensterland','suedwestfalen','nrw'][index%5])];
    const titles=['NRW-Pokal','Stadtmeisterschaft Bochum','Schach im Revier','Schulschach-Finale',
     'Blitzturnier in Bochum','Jugendturnier in Bochum','Ruhr-Liga','Vereinsabend in Bochum'];
    const items=window.nrwEmpty?[]:regions.map((region,index)=>({
     title:titles[index]||'QA Turnierbericht '+index,url:'https://example.org/news-'+index,
     source:region==='bochum'?'QA Schachbezirk Bochum':'QA NRW',shortName:region==='bochum'?'QA Bochum':'QA NRW',
     region,category:index===0?'landesverband':index===3?'jugend_schule':'region',
     publishedAt:new Date(now-(index<5 ? 630+index*60 : index*1440+30)*60_000).toISOString()
    }));
    data=window.nrwLegacy
     ?{items:items.filter(x=>x.region==='bochum').map(({title,url})=>({title,url}))}
     :{items,updatedAt,sourcesOk:3};
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
  ['VITE_SERVER_URL','https://sections-fixture.invalid'],...['VITE_SPIELER_V1_ENABLED','VITE_CLUBS_NRW_ENABLED','VITE_SPIELTAG_ENABLED','VITE_VORBEREITUNG_ENABLED','VITE_POSITION_SEARCH_ENABLED'].map(k=>[k,'true']),
  ...(mapEnabled?[['VITE_NRW_REGION_MAP_ENABLED','true']]:[])
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
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Network.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(captureRoot)await mkdir(captureRoot,{recursive:true});
  const capture=async name=>{if(captureRoot){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(captureRoot,phase+'-'+name+'.png'),Buffer.from(shot.data,'base64'));}};
  const directorySelector='.nrw-bochum-directory a';
  const viewports=mapEnabled?[[1280,720],[1440,900],[1920,950],[390,844]]:[[1440,900],[390,844]];
  for(const [width,height] of viewports){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
   await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'sections-fixture'});
   await wait("document.querySelector('.nrw-news-feed .nrw-news-row')");
   const mapControl=region=>`[data-nrw-map-region="${region}"]`;
   const filterControl=region=>`[data-nrw-filter-region="${region}"]`;
   const pressed=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')`);
   const clickMap=async(region,target='.nrw-region-map-count')=>{
    const selector=JSON.stringify(mapControl(region)+' '+target);
    const {x,y}=await evaluate(`(()=>{const el=document.querySelector(${selector});
     el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();
     return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
   };
   let germanDescriptions;
   for(const lang of (verify?['de','en','az','tr','ua','ru']:['de','ru'])){
    await evaluate('window.fixtureLanguage('+JSON.stringify(lang)+')');await evaluate('document.fonts.ready');await pause(60);
    if(lang==='de'||lang==='ru'||lang==='az'&&[1440,390].includes(width)){
     await capture('nrw-'+lang+'-'+width+'x'+height);
    }
    const metric=await evaluate(`(()=> {
     const root=document.querySelector('.nrw-overview');
     const bounds=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const links=selector=>[...root.querySelectorAll(selector)].map(a=>({
      href:a.getAttribute('href'),text:a.innerText,target:a.target,rel:a.rel,icon:!!a.querySelector('svg[aria-hidden="true"]'),
      ...bounds(a),
     }));
     const title=root.querySelector('h1');
     const subtitleNode=root.querySelector('.nrw-header p');
     const style=getComputedStyle(title), subtitle=getComputedStyle(subtitleNode), dash=getComputedStyle(subtitleNode,'::before');
     const canvas=document.createElement('canvas').getContext('2d');
     const rgb=value=>{canvas.clearRect(0,0,1,1);canvas.fillStyle=value;canvas.fillRect(0,0,1,1);return [...canvas.getImageData(0,0,1,1).data].slice(0,3);};
     const luminance=value=>rgb(value).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
      .reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
     const colors=style.backgroundImage.match(/(?:rgb|color)\\([^)]*\\)/g)||[];
     const contrast=Math.min(...colors.map(color=>(luminance(color)+.05)/(luminance(getComputedStyle(root).backgroundColor)+.05)));
     const feed=root.querySelector('.nrw-news-feed');
     const heading=feed.querySelector('h2');
     const headingCopy=heading.querySelector('span');
     const headingStyle=getComputedStyle(heading), headingInk=getComputedStyle(headingCopy);
     const updated=feed.querySelector('.nrw-news-heading time');
     const headingRange=document.createRange();
     headingRange.selectNodeContents(headingCopy);
     const headingLines=[...headingRange.getClientRects()].map(rect=>({x:rect.x,right:rect.right}));
     const feedBackground=luminance(getComputedStyle(feed).backgroundColor);
     const headingStops=headingInk.backgroundImage.match(/rgb\\([^)]*\\)/g)||[];
     const headingContrast=Math.min(...[headingStyle.color,...headingStops].map(color=>(luminance(color)+.05)/(feedBackground+.05)));
     const directory=root.querySelector('.nrw-bochum-directory');
     const directoryCards=links('${directorySelector}').map((link,index)=>{
      const card=directory.querySelectorAll('a')[index];
      const description=card.querySelector('.nrw-bochum-directory-copy span');
      return {...link,title:card.querySelector('strong').textContent,description:description.textContent,
       inert:Boolean(card.closest('[inert]')),
       fits:card.scrollWidth<=card.clientWidth+1,
       contrast:(luminance(getComputedStyle(description).color)+.05)/(luminance('#302E2B')+.05)};
     });
     const map=root.querySelector('.nrw-region-map');
     const badge=root.querySelector('.nrw-bochum-badge');
     const marker=map?.querySelector('.nrw-region-map-bochum-pill');
     const featured=root.querySelector('.nrw-news-featured');
     const featuredCopy=featured&&bounds(featured.querySelector('.nrw-news-headline'));
     const filters=root.querySelector('.nrw-news-filters');
     const largestGap=selector=>{
      const panel=root.querySelector(selector);
      const elements=[...panel.children].map(bounds);
      return Math.max(elements[0].y-bounds(panel).y,bounds(panel).bottom-elements.at(-1).bottom,
       ...elements.slice(1).map((rect,index)=>rect.y-elements[index].bottom));
     };
     return {
      width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      cards:[...root.querySelectorAll('.nrw-grid>.nrw-card')].map(bounds),
      cardBorders:[...root.querySelectorAll('.nrw-grid>.nrw-card')].map(card=>getComputedStyle(card).borderTopColor),
      official:links('.nrw-official-links a'),headlines:links('.nrw-news-feed .nrw-news-row'),sources:links('.nrw-news-sources a'),actions:links('.nrw-header a'),
      removed:root.querySelectorAll('.nrw-header-top,.nrw-kicker,.nrw-region-code,.nrw-signin,.section-info,.nrw-count,.nrw-footer,.nrw-chat-rail,select,details,[href="/spieltag"],[href^="/profile"],[href^="/clubs-nrw"],[href="/region/nrw/turniere"],[href="/region/nrw/ligen"],[href="/region/nrw/vereine"],iframe').length,
      newsLinks:links('.nrw-news-links a,.nrw-news-disclosure a').map(a=>a.href),
      sourceGroups:root.querySelectorAll('.nrw-news-source-groups h3').length,gradient:style.backgroundImage,contrast,
      feed:bounds(feed),
      feedHeading:{font:headingStyle.fontFamily,size:headingStyle.fontSize,weight:headingStyle.fontWeight,
       fallback:headingStyle.color,gradient:headingInk.backgroundImage,clip:headingInk.backgroundClip,
       icon:[getComputedStyle(heading.querySelector('svg')).color,bounds(heading.querySelector('svg')).width],
       contrast:headingContrast,lines:headingLines,box:bounds(heading),updated:bounds(updated)},
      bochum:bounds(root.querySelector('.nrw-bochum')),
      badge:bounds(root.querySelector('.nrw-bochum-badge')),badgeText:root.querySelector('.nrw-bochum-badge').textContent,
      badgeMotion:getComputedStyle(root.querySelector('.nrw-bochum-badge')).animationName,
      badgeContrast:Math.min(...['#4E3D2D','#6B5540','#5E4F86','#6A5A92'].map(fill=>(luminance(getComputedStyle(root.querySelector('.nrw-bochum-badge')).color)+.05)/(luminance(fill)+.05))),
      bochumBorder:getComputedStyle(root.querySelector('.nrw-bochum')).borderTopColor,
      bochumFont:getComputedStyle(root.querySelector('.nrw-bochum h2')).fontFamily,
      bodoniLoaded:[...document.fonts].some(font=>font.family.includes('Bodoni Moda')&&font.weight==='700'&&font.status==='loaded'),
      bochumTitle:root.querySelector('.nrw-bochum h2').textContent,
      bochumSubtitle:root.querySelector('.nrw-bochum > p')!==null,
      bochumRows:links('.nrw-bochum .nrw-news-row'),
      directoryCards,
      directoryHeading:directory?.querySelector('h3').textContent,
      directoryColumns:directory&&getComputedStyle(directory.querySelector('ul')).gridTemplateColumns.split(' ').length,
      directoryBetweenNewsAndFooter:directory?.previousElementSibling?.matches('.nrw-news-rows')&&directory.nextElementSibling?.matches('.nrw-bochum-footer'),
      directoryTransition:directory?.querySelector('.nrw-bochum-directory-extra')&&getComputedStyle(directory.querySelector('.nrw-bochum-directory-extra')).transitionDuration,
      map:map&&{visible:getComputedStyle(map).display!=='none',height:bounds(map).height,
       areaCount:map.querySelectorAll('.nrw-region-map-area').length,
       aboveFilters:bounds(map).bottom<=bounds(filters).y+1,
       pulse:getComputedStyle(map.querySelector('.nrw-region-map-pulse')).animationName,
       corners:map.querySelectorAll('.nrw-region-map-corner[aria-hidden="true"]').length,
       panel:[getComputedStyle(map).borderRadius,getComputedStyle(map).backgroundColor,getComputedStyle(map).backgroundSize],
       stroke:[...map.querySelectorAll('.nrw-region-map-area path')].map(path=>{
        const style=getComputedStyle(path);
        return [style.stroke,style.strokeWidth];
       }),
       count:[...map.querySelectorAll('.nrw-region-map-count')].map(node=>[node.width.baseVal.value,node.height.baseVal.value]),
       countSize:getComputedStyle(map.querySelector('.nrw-region-map-count-text')).fontSize,
       dotRadius:map.querySelector('.nrw-region-map-dot').r.baseVal.value,
       ringRadius:map.querySelector('.nrw-region-map-ring')?.r.baseVal.value,
       hit:bounds(map.querySelector('.nrw-region-map-bochum-hit')),
       labels:bounds(map).width?[...map.querySelectorAll('.nrw-region-map-area')].map(area=>{
        const region=area.dataset.nrwMapRegion;
        const name=area.querySelector('.nrw-region-map-name');
        const path=area.querySelector('path');
        const count=area.querySelector('.nrw-region-map-count');
        const inverse=path.getScreenCTM().inverse();
        const lines=[...name.querySelectorAll('tspan')];
        const insideRegion=node=>{
         const {x,y,right,bottom}=bounds(node);
         return [x,(x+right)/2,right].every(px=>[y,(y+bottom)/2,bottom].every(py=>
          path.isPointInFill(new DOMPoint(px,py).matrixTransform(inverse))));
        };
        return {region,name:bounds(name),count:bounds(count),path:bounds(path),
         lines:lines.map(line=>line.textContent),fontSize:parseFloat(getComputedStyle(name).fontSize),
         inside:lines.every(insideRegion),aria:area.getAttribute('aria-label'),title:area.querySelector('title').textContent,
         chip:root.querySelector('[data-nrw-filter-region="'+region+'"]')?.firstChild.textContent};
       }):[],
       dot:bounds(map.querySelector('.nrw-region-map-dot')),
       pill:bounds(marker),
       marker:marker&&{color:getComputedStyle(marker).color,sheen:getComputedStyle(marker).animationName,
        gradientMatches:["backgroundImage","backgroundSize","backgroundClip"].every(key=>getComputedStyle(marker)[key]===getComputedStyle(badge)[key])},
       contrast:(luminance(getComputedStyle(map.querySelector('.nrw-region-map-name')).fill)+.05)/(luminance('#33363B')+.05)},
      featured:featured&&{...links('.nrw-news-featured')[0],dates:[...featured.querySelectorAll('time span')].map(span=>span.textContent),
       gap:Math.max(featuredCopy.y-bounds(featured).y,bounds(featured).bottom-featuredCopy.bottom,
        bounds(featured.parentElement).bottom-bounds(featured).bottom)},
      largestGap:Math.max(largestGap('.nrw-news-feed'),largestGap('.nrw-bochum'),
       ...(featured?[largestGap('.nrw-news-content')]:[])),
      dateTooltip:root.querySelector('.nrw-news-row time').title,
      timeTexts:[...root.querySelectorAll('time')].map(time=>time.innerText.trim()),
      absoluteDates:[...root.querySelectorAll('.nrw-news-row time')].map(time=>time.title),
      bochumDay:root.querySelector('.nrw-bochum .nrw-news-row[href$="/news-5"] time').innerText,
      updatedClock:root.querySelector('.nrw-news-heading time').innerText,
      rowHeight:bounds(root.querySelector('.nrw-news-row[href$="/news-2"]')).height,
      categoryClasses:[...root.querySelectorAll('.nrw-news-legend .nrw-news-tag')].map(tag=>tag.className),
      activeTargets:[...root.querySelectorAll('.nrw-news-filters button,.nrw-sources-heading button')].map(bounds),
      requestCount:window.nrwNewsRequests,
      subtitle:{style:[subtitle.fontSize,subtitle.fontWeight,subtitle.letterSpacing,subtitle.color,subtitle.columnGap,subtitle.alignItems],
       dash:[dash.width,dash.height,dash.backgroundColor],
       contrast:(luminance(subtitle.color)+.05)/(luminance(getComputedStyle(root).backgroundColor)+.05),
       titleGap:bounds(subtitleNode).y-bounds(title).bottom,
       newsGap:bounds(root.querySelector('.nrw-news-grid')).y-bounds(subtitleNode).bottom},
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
      assert.ok(navMetrics.every(v=>!v.wrap&&!v.clipped&&(v.name==='Schach-Treff'?v.fontSize===18:v.fontSize>=15&&v.fontSize<=16)&&v.weight>=500&&v.weight<=600),'readable one-line navigation: '+JSON.stringify(navMetrics));
      assert.ok(new Set(navMetrics.map(v=>Math.round(v.height))).size===1,'equal menu heights');
      assert.equal(navMetrics.find(v=>v.name==='Schach-Treff')?.name,'Schach-Treff','no subtitle');
       const chatAccent=await evaluate(`(()=>{const link=document.querySelector('aside .site-nav-link--schach-treff'),icon=link?.querySelector('.schach-treff-chat-icon'),path=icon?.querySelector('path'),dot=icon?.querySelector('.schach-treff-chat-dot'),label=link?.querySelector('.site-nav-label');return {count:document.querySelectorAll('.schach-treff-chat-icon').length,fill:path?getComputedStyle(path).fill:'',dotCount:icon?.querySelectorAll('.schach-treff-chat-dot').length??0,dotFill:dot?getComputedStyle(dot).fill:'',dotStroke:dot?getComputedStyle(dot).stroke:'',dotRadius:dot?.getAttribute('r'),dotAnimation:dot?getComputedStyle(dot).animationName:'',motion:matchMedia('(prefers-reduced-motion:no-preference) and (prefers-contrast:no-preference)').matches,contrast:matchMedia('(prefers-contrast:more)').matches,stops:icon?.querySelectorAll('linearGradient stop').length??0,fits:!!label&&label.getBoundingClientRect().right<=link.getBoundingClientRect().right-20};})()`);
       assert.equal(chatAccent.count,1,'chat accent is exclusive to desktop Schach-Treff');
       assert.equal(chatAccent.fill,'none','chat bubble remains unfilled');
       assert.equal(chatAccent.dotCount,1,'one decorative center dot');
       assert.equal(chatAccent.dotRadius,'3','small dot radius');
       assert.equal(chatAccent.dotStroke,'none','dot has no outline');
       assert.ok(chatAccent.stops===4&&(chatAccent.contrast||chatAccent.dotFill.includes('sidebar-chat-dot-gradient')),'metallic gradient confined to dot');
       assert.equal(chatAccent.dotAnimation,chatAccent.motion?'schachTreffChatDotPulse':'none','pulse respects motion and contrast preferences');
       assert.ok(chatAccent.fits,'enlarged Schach-Treff label stays clear of the active indicator');
      const bronzeLabels=await evaluate(`(()=>{const labels=[...document.querySelectorAll('aside .site-nav-label')].filter(e=>e.getClientRects().length);return labels.map(el=>({label:el.textContent,metal:el.classList.contains('site-nav-label--bronze'),gradient:getComputedStyle(el).backgroundImage.includes('linear-gradient')}));})()`);
      assert.deepEqual(bronzeLabels.filter(v=>v.metal).map(v=>v.label).sort(),['NRW – Schach','Schach-Treff'],'only NRW and Schach-Treff receive bronze lettering');
      assert.ok(bronzeLabels.filter(v=>v.metal).every(v=>v.gradient),'metallic gradient rendered');
      assert.ok(bronzeLabels.filter(v=>!v.metal).every(v=>!v.gradient),'other menu labels unchanged');
      const nrwHeadings=await evaluate(`(()=>[...document.querySelectorAll('.nrw-card-head h2')].map(el=>getComputedStyle(el).backgroundImage.includes('linear-gradient')))()`);
      assert.ok(nrwHeadings.length===3 && nrwHeadings.every(value=>!value),'three solid headings in the approved cards');
     }
    }
    if(verify){
     assert.equal(metric.documentWidth,width,'no horizontal overflow '+lang);
     assert.equal(metric.cards.length,3,'three core panels');
     assert.ok(metric.cardBorders.every(color=>color==='rgba(255, 255, 255, 0.08)'));
     assert.equal(metric.removed,0,'legacy controls and metadata stay outside the overview');
     assert.equal(metric.dbReads,0,'landing never queries the database');
     assert.deepEqual(metric.official.map(link=>link.href),officialUrls);
     assert.equal(metric.headlines.length,8,'eight headlines including the featured story');
     assert.deepEqual(metric.headlines.map(link=>link.href),Array.from({length:8},(_,index)=>'https://example.org/news-'+index));
     assert.equal(metric.featured.href,metric.headlines[0].href);
     const expectedRelative=lang==='az'?'10 saat əvvəl':
      await evaluate(`new Intl.RelativeTimeFormat('${localeIds[lang]}',{numeric:'auto'}).format(-10,'hour')`);
     assert.equal(metric.featured.dates[0],expectedRelative);
     assert.equal(metric.featured.dates[1],metric.dateTooltip);
     for(const time of metric.timeTexts)assert.doesNotMatch(time,/^[-+]\d/,lang+' visible time');
     for(const absolute of metric.absoluteDates) {
      assert.ok(absolute);
      assert.doesNotMatch(absolute,/ M\d/,lang+' absolute date tooltip');
      if(lang==='az')assert.match(absolute,/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
     }
     if(lang==='az'){
      assert.equal(metric.bochumDay,'5 gün əvvəl');
      assert.match(metric.updatedClock,/\b\d{2}:\d{2}\b/);
      if(mapEnabled&&width===1440)console.log(`NRW AZ at 1440 px: ${[...metric.featured.dates,metric.bochumDay].join(' | ')}`);
     }
     assert.deepEqual(metric.bochumRows.map(link=>link.href),[1,4,5].map(index=>'https://example.org/news-'+index));
     assert.equal(metric.directoryHeading,directoryHeadings[lang]);
     assert.ok(metric.directoryBetweenNewsAndFooter);
     assert.deepEqual(metric.directoryCards.map(card=>card.title),directoryTitles);
     assert.deepEqual(metric.directoryCards.filter(card=>!card.inert).map(card=>card.title),directoryTitles.slice(0,3));
     assert.equal(metric.directoryTransition,'0s');
     const descriptions=metric.directoryCards.map(card=>card.description);
     assert.ok(descriptions.every(description=>description.trim().length>0&&description.length<=70));
     if(lang==='de')germanDescriptions=descriptions;
     else assert.ok(descriptions.every((description,index)=>description!==germanDescriptions[index]),'directory descriptions are translated');
     assert.ok(metric.directoryCards.every(card=>card.fits&&card.contrast>=4.5));
     assert.ok(metric.directoryCards.every(card=>metric.bochumRows.every(row=>row.href!==card.href)));
     assert.equal(metric.requestCount,1,'both cards share one request');
     assert.equal(metric.sourceGroups,0,'secondary source groups are collapsed initially');
     assert.deepEqual(metric.sources.map(link=>link.href),[0,1,2,5].map(index=>sourceUrls[index]));
     assert.equal(metric.bochumTitle,bochumTitles[lang]);
     assert.equal(metric.badgeText,bochumBadges[lang]);
     assert.equal(metric.bochumSubtitle,false);
     assert.equal(metric.badgeMotion,'none');
     assert.ok(metric.badgeContrast>=4.5,JSON.stringify(metric.badgeContrast));
     assert.equal(metric.bochumBorder,'rgba(184, 145, 106, 0.35)');
     assert.match(metric.bochumFont,/Bodoni Moda/);
     assert.ok(metric.bodoniLoaded,'self-hosted 700 weight loads');
     assert.ok(metric.badge.height>=50);
     assert.ok(Math.abs(metric.badge.x+metric.badge.width/2-metric.bochum.x-metric.bochum.width/2)<=2);
     assert.ok(metric.dateTooltip,'absolute time tooltip');
     assert.equal(metric.rowHeight,52,'single-line headlines match the skeleton row height');
     assert.deepEqual(metric.categoryClasses,['landesverband','jugend_schule','region'].map(key=>'nrw-news-tag nrw-news-tag--'+key));
     const heading=metric.feedHeading;
     assert.match(heading.font,/Bodoni Moda.*Georgia/);
     assert.equal(heading.size,'24px');
     assert.equal(heading.weight,'600');
     assert.equal(heading.fallback,'rgb(201, 174, 135)');
     assert.equal(heading.gradient,'linear-gradient(100deg, rgb(217, 195, 162) 0%, rgb(184, 153, 111) 50%, rgb(217, 195, 162) 100%)');
     assert.equal(heading.clip,'text');
     assert.deepEqual(heading.icon,['rgb(201, 164, 106)',22]);
     assert.ok(heading.contrast>=4.5,lang+' bronze feed heading contrast '+heading.contrast);
     assert.ok(heading.lines.length&&heading.lines.every(line=>line.x>=metric.feed.x&&line.right<=metric.feed.right),
      lang+' feed heading fits at '+width);
     if(width===1440){
      assert.equal(heading.lines.length,1,lang+' feed heading stays on one line');
      assert.ok(heading.box.right<=heading.updated.x&&heading.box.y<heading.updated.bottom&&heading.updated.y<heading.box.bottom,
       lang+' update stays next to the feed heading');
     }
     if(width===390){
      assert.ok(metric.feed.bottom<=metric.bochum.y,'Bochum stacks below news');
      assert.ok(metric.activeTargets.every(rect=>rect.height>=44),'mobile buttons reach 44px');
      assert.equal(metric.directoryColumns,1);
      assert.ok(metric.directoryCards.every(card=>card.height>=44),'mobile directory cards reach 44px');
     } else {
      assert.ok(metric.feed.right<=metric.bochum.x,'news sections are side by side');
     }
     if(mapEnabled){
      assert.equal(metric.map.visible,width>640);
      assert.equal(metric.map.areaCount,6);
      assert.equal(metric.map.pulse,'none');
      assert.ok(metric.map.contrast>=4.5);
      if(width>640){
       assert.ok(metric.map.aboveFilters&&metric.map.height>=200);
       assert.equal(metric.map.corners,4);
       assert.deepEqual(metric.map.panel,['12px','rgb(26, 28, 31)','12px 12px']);
       assert.deepEqual(metric.map.stroke,Array.from({length:6},()=>['rgba(184, 145, 106, 0.4)','1px']));
       assert.deepEqual(metric.map.count,Array.from({length:6},()=>[24,16]));
       assert.equal(metric.map.countSize,'11px');
       assert.ok(metric.map.dotRadius>=5&&metric.map.ringRadius>=9);
       assert.ok(metric.map.hit.width>=32&&metric.map.hit.height>=24);
       assert.deepEqual(metric.map.marker,{color:'rgb(240, 223, 196)',sheen:'none',gradientMatches:true});
       if(width===1440){
        const overlaps=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
        const boxes=[{id:'Bochum pill',rect:metric.map.pill},{id:'Bochum dot',rect:metric.map.dot}];
        for(const [index,label] of metric.map.labels.entries()){
         const {region,name,count,path,lines,fontSize,inside,aria,title,chip}=label;
         const fullName=fullRegionNames[lang][index];
         assert.ok(aria.startsWith(fullName+' · '),lang+' '+region+' accessible full name');
         assert.equal(title,aria,lang+' '+region+' full name tooltip');
         if(region!=='mittelrhein')assert.equal(chip?.trim(),fullName,lang+' '+region+' full name filter');
         assert.ok(lines.length>=1&&lines.length<=2&&lines.every(line=>line.trim()),lang+' '+region+' label lines');
         assert.doesNotMatch(lines.join(' '),/…|\.\.\./);
         assert.ok(fontSize>=10.5,lang+' '+region+' readable font size');
         assert.ok(name.x>=path.x+2&&name.right<=path.right-2&&name.y>=path.y+2&&name.bottom<=path.bottom-2,
          lang+' '+region+' name clears its path bounds by 2 px '+JSON.stringify({name,path}));
         assert.ok(inside,lang+' '+region+' text lies inside the drawn region '+JSON.stringify({lines,name}));
         boxes.push({id:region+' name',rect:name},{id:region+' count',rect:count});
         if(region==='suedwestfalen'){
          assert.ok(!overlaps(metric.map.hit,name)&&!overlaps(metric.map.hit,count),lang+' Bochum hit area clears Südwestfalen');
         }
        }
        for(const [index,box] of boxes.entries()){
         for(const other of boxes.slice(index+1)){
          assert.ok(!overlaps(box.rect,other.rect),lang+' overlapping map labels '+JSON.stringify([box,other]));
         }
        }
        if(captureRoot&&['de','en','ru','az'].includes(lang)){
         const clip=await evaluate(`(()=>{const r=document.querySelector('.nrw-region-map').getBoundingClientRect();
          return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
         const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
         await writeFile(join(captureRoot,`nrw-map-${lang}-1440.png`),Buffer.from(shot.data,'base64'));
        }
        await clickMap('bochum','.nrw-region-map-bochum-pill');
        assert.equal(await pressed(filterControl('bochum')),'true',lang+' Bochum pill selects Bochum');
        await clickMap('suedwestfalen','.nrw-region-map-name');
        assert.equal(await pressed(filterControl('suedwestfalen')),'true',lang+' Südwestfalen name selects Südwestfalen');
        await evaluate(`document.activeElement.blur(); document.querySelector(${JSON.stringify(filterControl(''))}).click(); window.scrollTo(0,0)`);
        await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
       }
      }
     }else assert.equal(metric.map,null,'map is absent with no flag');
     if(width===1440){
      const balance={lang,mapEnabled,feed:metric.feed.height,bochum:metric.bochum.height};
      assert.ok(Math.abs(metric.feed.bottom-metric.bochum.bottom)<=40,'desktop panel balance '+JSON.stringify(balance));
      assert.ok(Math.max(metric.largestGap,metric.featured.gap)<=metric.rowHeight,'no blank gap larger than a row '+JSON.stringify(balance));
     }
     for(const link of [...metric.official,...metric.headlines,...metric.bochumRows,...metric.sources,...metric.directoryCards]){
      assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.ok(link.icon);
      assert.ok(link.x>=0&&link.right<=width+1,'external link fits: '+link.href);
     }
     assert.deepEqual(metric.newsLinks,['/region/nrw/news','/region/nrw/live']);
     assert.deepEqual(metric.actions,[],'landing header contains no action links');
     assert.ok(metric.gradient.startsWith('linear-gradient')&&Number.isFinite(metric.contrast)&&metric.contrast>=4.5,'heading gradient contrast: '+JSON.stringify({gradient:metric.gradient,contrast:metric.contrast}));
     assert.deepEqual(metric.subtitle.style,['14px','500','0.84px','rgb(191, 174, 150)','10px','center']);
     assert.deepEqual(metric.subtitle.dash,['24px','1px','rgb(184, 145, 106)']);
     assert.ok(metric.subtitle.contrast>=4.5);
     assert.ok(Math.abs(metric.subtitle.titleGap-14)<=2);
     assert.ok(Math.abs(metric.subtitle.newsGap-28)<=2);
     if(width>=1280){
      assert.ok(metric.cards.every(card=>Math.abs(card.y-metric.cards[0].y)<1&&Math.abs(card.height-metric.cards[0].height)<1&&Math.abs(card.width-metric.cards[0].width)<1),'equal desktop cards');
     }else{
      assert.ok(metric.cards.every((card,i)=>!i||card.y>=metric.cards[i-1].bottom),'mobile cards stack');
     }
    }
   }
   if(!verify)continue;
   await evaluate("window.fixtureLanguage('de')");await pause(50);
   const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
   const countRows=()=>evaluate("document.querySelectorAll('.nrw-news-feed .nrw-news-row').length");
   const visibleDirectory=()=>evaluate(`document.querySelectorAll('${directorySelector}:not([inert] a)').length`);
   if(captureRoot && [390,1440].includes(width)){
    const captureHeight=await evaluate("Math.ceil(document.querySelector('.nrw-overview').getBoundingClientRect().bottom+180)");
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:captureHeight,deviceScaleFactor:1,mobile:width===390});
    for(const [name,selector] of [['overview','.nrw-overview'],['bochum','.nrw-bochum']]){
     const clip=await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();
      return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
     const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
     await writeFile(join(captureRoot,`nrw-${name}-${width}.png`),Buffer.from(shot.data,'base64'));
    }
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
   }
   assert.equal(await visibleDirectory(),3);
   assert.equal(await evaluate("document.querySelector('.nrw-bochum-directory-toggle').textContent.trim()"),'Alle Seiten (8)');
   assert.equal(await evaluate("document.querySelector('.nrw-bochum-directory-extra').getBoundingClientRect().height"),0);
   await click('.nrw-bochum-directory-toggle');
   assert.equal(await visibleDirectory(),8);
   assert.equal(await evaluate("document.querySelector('.nrw-bochum-directory-toggle').getAttribute('aria-expanded')"),'true');
   assert.equal(await evaluate("document.querySelector('.nrw-bochum-directory-toggle').textContent.trim()"),'Weniger anzeigen');
   await click('.nrw-bochum-directory-toggle');
   assert.equal(await visibleDirectory(),3);

   await click('.nrw-news-controls button');
   assert.equal(await countRows(),27);
   assert.equal(await evaluate("document.querySelector('.nrw-news-controls button').getAttribute('aria-expanded')"),'true');
   await click('.nrw-news-controls button');
   assert.equal(await countRows(),8);
   assert.deepEqual(await evaluate("[...document.querySelectorAll('.nrw-news-filters button')].map(button=>button.textContent.trim().replace(/ +/g,' '))"),
    ['Alle 27','Nordrhein-Westfalen 5','Ruhrgebiet 2','Niederrhein 4','Ostwestfalen-Lippe 4','Münsterland 4','Südwestfalen 4','Bochum 4']);
   if(mapEnabled&&width===1440){
    const pressMap=async(region,key,code)=>{
     const selector=JSON.stringify(mapControl(region));
     assert.ok(await evaluate(`(()=>{const el=document.querySelector(${selector});el.focus();return el===document.activeElement;})()`));
     await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code});
     await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code});
    };
    const featuredUrl=()=>evaluate("document.querySelector('.nrw-news-featured').href");
    assert.equal(await evaluate(`document.querySelector('${mapControl('mittelrhein')}').getAttribute('aria-disabled')`),'true');
    await clickMap('mittelrhein');
    assert.equal(await pressed(filterControl('')),'true');
    await clickMap('ruhrgebiet');
    assert.equal(await countRows(),2);
    assert.equal(await pressed(filterControl('ruhrgebiet')),'true');
    assert.equal(await pressed(mapControl('ruhrgebiet')),'true');
    assert.equal(await featuredUrl(),'https://example.org/news-2');
    await pressMap('muensterland','Enter','Enter');
    assert.equal(await pressed(filterControl('muensterland')),'true');
    assert.equal(await featuredUrl(),'https://example.org/news-10');
    await pressMap('niederrhein',' ','Space');
    assert.equal(await pressed(filterControl('niederrhein')),'true');
    await clickMap('bochum','.nrw-region-map-bochum-pill');
    assert.equal(await pressed(filterControl('bochum')),'true');
    assert.equal(await featuredUrl(),'https://example.org/news-1');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.nrw-region-map-ring')).stroke"),'rgb(226, 196, 154)');
    await click(filterControl(''));
    await pressMap('bochum','Enter','Enter');
    assert.equal(await pressed(filterControl('bochum')),'true');
    await click(filterControl('owl'));
    assert.equal(await pressed(mapControl('owl')),'true');
    await click(filterControl(''));
    assert.equal(await pressed(mapControl('owl')),'false');
    assert.equal(await featuredUrl(),'https://example.org/news-0');
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.nrw-region-map-pulse')).animationName"),'nrw-region-map-pulse');
    assert.deepEqual(await evaluate("['.nrw-bochum-badge','.nrw-region-map-bochum-pill'].map(selector=>{const style=getComputedStyle(document.querySelector(selector));return [style.animationName,style.animationDuration,style.animationTimingFunction]})"),
     Array.from({length:2},()=>['nrw-bochum-sheen','6s','ease-in-out']));
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.nrw-bochum-directory-extra')).transitionDuration"),'0s');
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   }
   await click('.nrw-news-filters button:last-child');
   assert.equal(await countRows(),4);
   assert.ok(await evaluate("[...document.querySelectorAll('.nrw-news-feed .nrw-news-row .nrw-news-tag')].every(tag=>tag.textContent==='QA Bochum')"));
   assert.equal(await evaluate('window.nrwNewsRequests'),1,'filtering makes no network request');
   await click('.nrw-sources-heading button');
   assert.deepEqual(await evaluate("[...document.querySelectorAll('.nrw-news-sources a')].map(a=>a.href)"),sourceUrls);
   assert.equal(await evaluate("document.querySelectorAll('.nrw-news-source-groups h3').length"),2);
   await click('.nrw-sources-heading button');
   assert.equal(await evaluate("document.querySelectorAll('.nrw-news-sources a').length"),4);

   await click('.nrw-news a[href="/region/nrw/news"]');
   await wait("document.querySelector('.nrw-grid--detail .nrw-card--news')");
   await wait("document.querySelectorAll('.nrw-news-feed .nrw-news-row').length===27");
   assert.equal(await evaluate("document.querySelector('.nrw-grid--detail').children.length"),1,'news details route retains one focused panel');
   assert.equal(await evaluate("document.querySelectorAll('.nrw-news-sources a').length"),4,'news detail retains official NRW sources');
   const categoryFilters='.nrw-news-filters:not(:has([data-nrw-filter-region]))';
   await click(categoryFilters+' button:nth-child(3)');
   assert.equal(await countRows(),1,'category filter selects youth and schools');
   assert.equal(await evaluate("document.querySelector('.nrw-news-featured').href"),'https://example.org/news-3');
   await evaluate("window.fixtureNavigate('/region/nrw/news?region=bochum')");
   await wait("document.querySelector('.nrw-news-filters button[aria-pressed=true]')?.textContent.includes('Bochum')");
   await click(categoryFilters+' button:first-child');
   assert.equal(await countRows(),4,'Bochum deep link preselects local news');
   await evaluate("window.fixtureNavigate('/region/nrw/news?region=invalid')");
   await wait("document.querySelectorAll('.nrw-news-feed .nrw-news-row').length===27");
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
   await wait("document.querySelector('.nrw-news-status p')?.innerText.includes('Keine aktuellen Meldungen verfügbar.')");
   for(const [locale,phrase] of Object.entries(emptyNews)){
    await evaluate('window.fixtureLanguage('+JSON.stringify(locale)+')');
    await wait("document.querySelector('.nrw-news-status p')?.innerText==="+JSON.stringify(phrase));
   }
   await evaluate("window.nrwGuest=false;window.fixtureLanguage('de');window.nrwNewsFailure=true;window.fixtureNavigate('/region/invalid')");
   await wait("!document.querySelector('[data-region-overview]')");
   await evaluate("window.fixtureNavigate('/region/nrw')");
   await wait("document.querySelector('.nrw-news-status p')?.innerText==='Nachrichten derzeit nicht verfügbar.'");
   assert.equal(await evaluate("document.querySelectorAll('.nrw-news [role=status]').length"),1);
   await evaluate("window.nrwNewsFailure=false;window.nrwEmpty=false;window.nrwLegacy=true;window.nrwNewsDelay=500;window.fixtureNavigate('/region/invalid')");
   await wait("!document.querySelector('[data-region-overview]')");
   await evaluate("window.fixtureNavigate('/region/nrw')");
   await wait("document.querySelectorAll('.nrw-news-skeleton').length===5");
   assert.deepEqual(await evaluate("[...document.querySelectorAll('.nrw-news-skeleton')].map(row=>[row.getBoundingClientRect().height,getComputedStyle(row.firstElementChild).animationName])"),Array.from({length:5},()=>[52,'none']));
   await wait("document.querySelectorAll('.nrw-bochum .nrw-news-row').length===3");
   assert.equal(await visibleDirectory(),3,'directory also appears with the legacy feed');
   assert.ok(await evaluate("document.querySelector('.nrw-bochum .nrw-news-tag').textContent.includes('Schachbezirk Bochum · externe Quelle')"));
   assert.equal(await evaluate("document.querySelectorAll('.nrw-news-row time').length"),0,'legacy items have no fabricated date');
   await evaluate("window.nrwLegacy=false;window.nrwNewsDelay=0;window.nrwEmpty=true");
   if(width===390){
    await evaluate("window.fixtureNavigate('/')");
     await wait("document.querySelector('.home-screen-root')");
     assert.equal(await evaluate(`[...document.querySelectorAll('.home-screen-root a[href="/region/nrw"]')].filter(a=>a.getClientRects().length>0).length`),0,'NRW entry is intentionally hidden on mobile Home');
     await evaluate("window.fixtureNavigate('/region/nrw')");
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
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  if(verify){
   const balance=measurements.find(m=>m.width===1440&&m.lang==='de');
   console.log(`PASS NRW 1440 px DE: map ${balance.map?.height??'off'} px, feed ${balance.feed.height} px, Bochum ${balance.bochum.height} px`);
  }else console.log('Captured NRW baseline in DE and RU');
 }finally{for(const p of pending.values())clearTimeout(p.timer);try{ws?.close();}catch{}chrome?.kill('SIGKILL');await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkNRWDesign({captureRoot:process.env.NRW_CAPTURE,phase:process.env.NRW_PHASE||'after',verify:process.env.NRW_PHASE!=='before'});
