// Real Chromium geometry and pixel-diff regression. Requires npm ci, git and Chromium.
// Owner-reviewed reference: 8a2f0f2. Both mobile screens must be pixel-identical. Synthetic authenticated Supabase session only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

const snapshot='87d40deb4dc09a4dc0816efafbd5da9e204d5d9d';
const page=[
 "import '/src/index.css';",
 "import React from 'react';import{createRoot}from'react-dom/client';",
 "import{MemoryRouter,Routes,Route,useNavigate}from'react-router-dom';",
 "import{ThemeProvider}from'/src/context/ThemeContext.tsx';",
 "import{LanguageProvider}from'/src/context/LanguageContext.tsx';",
 "import Layout from'/src/components/Layout.tsx';",
 "import Settings from'/src/screens/SettingsScreen.tsx';",
 "import Profile from'/src/screens/ProfileScreen.tsx';",
 "localStorage.setItem('app-language','ru');",
 "function Shell(){window.qaNavigate=useNavigate();return <Routes><Route element={<Layout/>}><Route path='/settings' element={<Settings/>}/><Route path='/profile' element={<Profile/>}/></Route></Routes>}",
 "createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter initialEntries={['/settings']}><Shell/></MemoryRouter></LanguageProvider></ThemeProvider>);"
].join('\n');
function fixturePlugin(){
 return {name:'settings-profile-qa',enforce:'pre',
  resolveId(id){
   if(id==='/__polish_qa.tsx')return id;
   if(/(?:^|\/)context\/AuthContext(?:\.tsx)?$/.test(id))return '\0qa-auth';
   if(/(?:^|\/)services\/supabase(?:\.ts)?$/.test(id))return '\0qa-db';
   if(/(?:^|\/)routeLoaders(?:\.ts)?$/.test(id))return '\0qa-preload';
  },
  load(id){
   if(id==='/__polish_qa.tsx')return page;
   if(id==='\0qa-auth')return "export function useAuth(){return{user:{id:'11111111-1111-4111-8111-111111111111',user_metadata:{username:'QA Player'}},profile:{username:'QA Player',ratingBlitz:1200,ratingRapid:1300,ratingBullet:1100,createdAt:'2025-01-01'},session:{access_token:'fixture-only'},isLoading:false,signOut:async()=>{}}}";
   if(id==='\0qa-db')return "export const supabase={from(){const q={select(){return q},or(){return q},eq(){return q},order(){return q},limit(){return q},then(ok,err){return Promise.resolve({data:[],error:null}).then(ok,err)}};return q}}";
   if(id==='\0qa-preload')return 'export const prefetchRoute=()=>{};export const scheduleNavigationPreload=()=>()=>{};';
  },
  configureServer(server){server.middlewares.use(async(req,res,next)=>{
   if(req.url!=='/polish-qa')return next();
   res.setHeader('content-type','text/html');
   res.end(await server.transformIndexHtml('/polish-qa','<html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/__polish_qa.tsx"></script></body></html>'));
  });}
 };
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const dimensions=[[1366,768],[1440,900],[1920,1080],[1920,880]];
test('Settings/Profile browser geometry and mobile Settings baseline pixel identity',{timeout:420000},async t=>{
 let oldDir,chromeDir,chrome,ws,server;const pending=new Map();
 try{
  assert.ok(existsSync(resolve('node_modules')),'npm ci required');
  oldDir=await mkdtemp(join(tmpdir(),'chessaz-polish-before-'));
  execFileSync('bash',['-c','git archive '+snapshot+' tmp | tar -xf - -C '+JSON.stringify(oldDir)],{cwd:resolve('..'),timeout:40000});
  const oldRoot=join(oldDir,'tmp');
  await symlink(resolve('node_modules'),join(oldRoot,'node_modules'),'dir');
  const binary=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(binary,'Chromium is required');
  chromeDir=await mkdtemp(join(tmpdir(),'chessaz-polish-chrome-'));
  chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--disable-background-networking','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+chromeDir,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let errorLog='';chrome.stderr.on('data',v=>errorLog=(errorLog+v).slice(-5000));
  let port;
  for(let i=0;i<200;i++){if(chrome.exitCode!==null)throw Error(errorLog);try{port=Number((await readFile(join(chromeDir,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break}catch{}await pause(50)}
  assert.ok(port,errorLog);
  const target=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(target.find(x=>x.type==='page').webSocketDebuggerUrl);
  await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true})});
  let serial=0;
  ws.addEventListener('message',({data})=>{const msg=JSON.parse(data),job=pending.get(msg.id);if(!job)return;pending.delete(msg.id);clearTimeout(job.timer);msg.error?job.reject(Error(JSON.stringify(msg.error))):job.resolve(msg.result)});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP '+method+' timeout'))},60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
  const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value};
  const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(50)}throw Error('UI timeout '+expression+' '+String(await evaluate('document.body.innerText')).slice(0,500))};
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('app-language','ru');document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.appendChild(s)});"});
  const capture=process.env.SECTIONS_CAPTURE;if(capture)await mkdir(capture,{recursive:true});
  const results={before:{},after:{}};let baselineMobile,baselineProfileMobile;
  for(const phase of ['before','after']){
   const root=phase==='before'?oldRoot:process.cwd();
   server=await createServer({root,configFile:false,cacheDir:join(tmpdir(),'chessaz-polish-cache-'+process.pid+phase),optimizeDeps:{include:['react','react-dom/client','react-router-dom','chess.js','lucide-react'],noDiscovery:true},plugins:[fixturePlugin(),react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}},define:{'import.meta.env.VITE_SERVER_URL':JSON.stringify('https://fixture.invalid')}});
   await server.listen();
   const url=server.resolvedUrls.local[0]+'polish-qa';
   for(const [width,height] of (phase==='before'?[[1366,768],[1920,880],[390,844]]:[...dimensions,[390,844]])){
    // Unmount the previous React screen before Chrome changes the viewport.
    // Profile can keep the renderer busy when resized directly.
    await cdp('Page.navigate',{url:'about:blank'});
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1024});
    await cdp('Page.navigate',{url});
    await wait("typeof window.qaNavigate==='function'&&!!document.querySelector('.settings-fixed-workspace')");
    await evaluate('document.fonts.ready');await pause(150);
    if(width>=1024){
     const geom=await evaluate("(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const a=r('.settings-fixed-workspace'),b=r('#settings-section-board'),mid=r('.settings-options-column > div:nth-child(2)'),last=r('#settings-section-background'),p=r('.settings-preview-column'),left=r('.settings-options-column'),pieces=r('#settings-section-pieces'),sound=r('#settings-section-sound'),board=r('#settings-preview-board'),stage=r('.settings-preview-stage');const gap=id=>{const s=document.querySelector('#settings-section-'+id+' section');return s.getBoundingClientRect().bottom-s.querySelector('.grid').getBoundingClientRect().bottom};return{top:b.top-a.top,bottom:a.bottom-last.bottom,gap1:mid.top-b.bottom,gap2:last.top-mid.bottom,previewTop:p.top-b.top,previewBottom:p.bottom-last.bottom,previewHeight:p.height,leftHeight:left.height,boardCardHeight:b.height,middleHeight:mid.height,backgroundHeight:last.height,piecesHeight:pieces.height,soundHeight:sound.height,configuredGap:parseFloat(getComputedStyle(document.querySelector('.settings-desktop-grid')).getPropertyValue('--settings-card-gap')),boardHeight:board.height,boardWidth:board.width,boardWithinStage:board.top>=stage.top-2&&board.bottom<=stage.bottom+2,boardGap:gap('board'),piecesGap:gap('pieces'),soundGap:gap('sound'),documentOverflow:document.documentElement.scrollHeight-innerHeight}})()");
     results[phase]['settings-'+width+'x'+height]=geom;
     if(phase==='after'){
      for(const name of ['boardGap','piecesGap','soundGap'])assert.ok(geom[name]>=0,name+' negative content padding: '+JSON.stringify(geom));
      for(const name of ['gap1','gap2']) assert.ok(geom[name]>=geom.configuredGap-2&&geom[name]<=geom.configuredGap+2,'oversized left gap '+JSON.stringify(geom));
      assert.ok(Math.abs(geom.piecesHeight-geom.soundHeight)<=2,'Pieces and Sound heights differ '+JSON.stringify(geom));
      assert.ok(Math.abs(geom.previewTop)<=2&&Math.abs(geom.previewBottom)<=2,'Preview alignment '+JSON.stringify(geom));
      assert.ok(geom.top>=16&&geom.top<=40&&geom.bottom>=16&&geom.bottom<=40&&Math.abs(geom.top-geom.bottom)<=4,'outer breathing room '+JSON.stringify(geom));
      assert.ok(Math.max(geom.boardCardHeight,geom.middleHeight,geom.backgroundHeight)-Math.min(geom.boardCardHeight,geom.middleHeight,geom.backgroundHeight)<=2,'Settings rows unequal '+JSON.stringify(geom));
      assert.ok(Math.abs(geom.previewHeight-geom.leftHeight)<=2,'Preview and options heights differ '+JSON.stringify(geom));
      assert.ok(Math.abs(geom.boardHeight-geom.boardWidth)<=2&&geom.boardWithinStage&&geom.boardWidth>=geom.previewHeight*.60,'preview chessboard clipped or not square '+JSON.stringify(geom));
      assert.ok(geom.documentOverflow<=1,'Settings page scroll '+JSON.stringify(geom));
     }
    }
    if(width===1366||width===1920&&height===880||width===390){
     const image=(await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data;
     if(capture)await writeFile(join(capture,phase+'-settings-'+width+'x'+height+'.png'),Buffer.from(image,'base64'));
     if(width===390){if(phase==='before')baselineMobile=image;else assert.equal(image,baselineMobile,'mobile Settings differs from baseline');}
    }
    if(width>=1024||width===390){
     await evaluate("window.qaNavigate('/profile')");
     await wait("!!document.querySelector('.passport-rating')");
     await evaluate('document.fonts.ready');await pause(100);
     const profile=await evaluate("(()=>{const p=document.querySelector('.desktop-player-passport')||document.querySelector('.passport-identity').parentElement;const main=document.querySelector('main');return{signature:!!document.querySelector('.passport-signature'),copy:/ШАХМАТНЫЙ ПОЧЕРК|CHESS SIGNATURE/.test(document.body.innerText),scroll:main.scrollHeight-main.clientHeight,bottom:p.getBoundingClientRect().bottom,bottomFree:innerHeight-p.getBoundingClientRect().bottom,identityHeight:document.querySelector('.passport-identity').getBoundingClientRect().height,ratingHeight:document.querySelector('.passport-rating').getBoundingClientRect().height,nextHeight:document.querySelector('.passport-next').getBoundingClientRect().height,performanceHeight:document.querySelector('.passport-performance').getBoundingClientRect().height,rowGap1:document.querySelector('.passport-next').getBoundingClientRect().top-document.querySelector('.passport-identity').getBoundingClientRect().bottom,rowGap2:document.querySelector('.passport-achievements').getBoundingClientRect().top-document.querySelector('.passport-next').getBoundingClientRect().bottom,identityBlank:Math.max(0,document.querySelector('.passport-identity').getBoundingClientRect().bottom-document.querySelector('.passport-identity > .relative + div').getBoundingClientRect().bottom),sections:[...p.querySelectorAll(':scope > section')].map(s=>s.className.match(/passport-[a-z]+/)?.[0])}})()");
     results[phase]['profile-'+width+'x'+height]=profile;
     if(phase==='after'){
      assert.equal(profile.signature,false,'signature mounted at '+width);
      assert.equal(profile.copy,false,'signature shown at '+width);
      if(width>=1024){assert.ok(profile.scroll<=1,'Profile scrolled '+JSON.stringify(profile));assert.ok(profile.bottom<=height,'Profile clipped '+JSON.stringify(profile));assert.ok(profile.bottomFree>=16&&profile.bottomFree<=40,'Profile bottom margin '+JSON.stringify(profile));assert.ok(Math.abs(profile.identityHeight-profile.ratingHeight)<=2&&Math.abs(profile.nextHeight-profile.performanceHeight)<=2,'Profile paired heights '+JSON.stringify(profile));assert.ok(profile.rowGap1>=0&&profile.rowGap1<=16&&profile.rowGap2>=0&&profile.rowGap2<=16,'Profile rows gaps '+JSON.stringify(profile));}
     }
     if(width===390){
      const image=(await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data;
      if(phase==='before') baselineProfileMobile=image;
      else assert.equal(image,baselineProfileMobile,'mobile Profile differs from 8a2f0f2');
      if(capture) await writeFile(join(capture,phase+'-profile-390.png'),Buffer.from(image,'base64'));
     }
     if((width===1366||width===1920&&height===880)&&capture){
      const image=(await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data;
      await writeFile(join(capture,phase+'-profile-'+width+'x'+height+'.png'),Buffer.from(image,'base64'));
     }
    }
   }
   if (phase === 'after') await t.test('one reachable language control across Settings breakpoints', async () => {
    const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
    const visibleGroups = `[...document.querySelectorAll('aside [role=group][aria-label]')].filter(${visible})`;
    const visibleSettingsLinks = `[...document.querySelectorAll('.settings-mobile-view button')].filter(button => (${visible})(button) && button.textContent.includes('Изменить язык'))`;
    for (const width of [320, 390, 768, 1023, 1024, 1279, 1280, 1920]) {
     await cdp('Page.navigate', { url: 'about:blank' });
     await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
     await cdp('Page.navigate', { url });
     await wait("document.documentElement?.lang === 'ru' && !!document.querySelector('.settings-fixed-workspace')");
     assert.equal(await evaluate(`(${visibleGroups}).length + (${visibleSettingsLinks}).length`), 1, `${width}px`);
     if (width < 1024) continue;
     const controls = await evaluate(`(${visibleGroups})[0] && [...(${visibleGroups})[0].querySelectorAll('button')].map(button => {
      const rect = button.getBoundingClientRect();
      const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { name: button.getAttribute('aria-label'), pressed: button.getAttribute('aria-pressed'),
        reachable: button.tabIndex === 0 && button.contains(center) };
     })`);
     assert.deepEqual(controls.map(button => button.name), ['English', 'Deutsch', 'Azərbaycan', 'Türkçe', 'Українська', 'Русский']);
     assert.ok(controls.every(button => button.reachable), `language buttons at ${width}px`);
     assert.deepEqual(controls.map(button => button.pressed), ['false', 'false', 'false', 'false', 'false', 'true']);
     await evaluate(`(${visibleGroups})[0].querySelector('button[aria-label="English"]').click()`);
     await wait("document.documentElement.lang === 'en'");
     assert.equal(await evaluate(`(${visibleGroups})[0].querySelector('[aria-pressed=true]').getAttribute('aria-label')`), 'English');
    }
   });
   await server.close();server=null;
  }
  if(capture)await writeFile(join(capture,'settings-profile-polish-metrics.json'),JSON.stringify(results,null,2));
  console.log('SETTINGS_PROFILE_QA_MEASUREMENTS '+JSON.stringify(results));
 }finally{
  try{ws?.close()}catch{}chrome?.kill('SIGKILL');for(const p of pending.values())clearTimeout(p.timer);
  if(server)await server.close();
  if(chromeDir)await rm(chromeDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  if(oldDir)await rm(oldDir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
});
