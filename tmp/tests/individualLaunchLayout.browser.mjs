import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';
import { tournamentCopy } from '../src/components/teamTournaments/copy.ts';

const entry = '/__individual_launch_fixture.tsx';
const authModule = '\0individual-launch-auth';
const supabaseModule = '\0individual-launch-supabase';
const preloadModule = '\0individual-launch-preload';
const fixtureOrigin = 'https://individual-launch-fixture.invalid';
const fixture = `
import '/src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { LanguageProvider, useLanguage } from '/src/context/LanguageContext.tsx';
import { ThemeProvider } from '/src/context/ThemeContext.tsx';
import Layout from '/src/components/Layout.tsx';
import SpieltagScreen from '/src/screens/SpieltagScreen.tsx';

const nativeFetch = window.fetch;
window.fetch = async (input,options) => {
  const url = new URL(String(input), location.href);
  if (url.origin === 'https://individual-launch-fixture.invalid' && url.pathname === '/api/individual-tournaments') return Response.json([]);
  if (url.origin === location.origin) return nativeFetch(input,options);
  throw new Error('Unexpected external request in individual launch fixture');
};
function Controls(){
  const { setLanguage } = useLanguage();
  window.fixtureLocale = lang => flushSync(()=>setLanguage(lang));
  return <Routes><Route element={<Layout/>}><Route path="/spieltag" element={<SpieltagScreen/>}/></Route></Routes>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter initialEntries={['/spieltag']}><Controls/></MemoryRouter></LanguageProvider></ThemeProvider>);
`;

const plugin = {
  name: 'individual-launch-fixture',
  enforce: 'pre',
  resolveId(id) {
    if (id === entry) return entry;
    if (id.endsWith('/context/AuthContext') || id.endsWith('/context/AuthContext.tsx')) return authModule;
    if (id.endsWith('/supabase') || id.endsWith('/supabase.ts')) return supabaseModule;
    if (id.endsWith('/routeLoaders') || id.endsWith('/routeLoaders.ts')) return preloadModule;
  },
  load(id) {
    if (id === entry) return fixture;
    if (id === authModule) return `
      import {useSyncExternalStore} from 'react';
      const member={access_token:'fixture-only',user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:false}};
      let session=null;
      const subscribe=cb=>{window.addEventListener('launch-auth',cb);return()=>window.removeEventListener('launch-auth',cb);};
      window.fixtureAuth=signed=>{session=signed?member:null;window.dispatchEvent(new Event('launch-auth'));};
      export function useAuth(){return{session:useSyncExternalStore(subscribe,()=>session),isLoading:false};}
    `;
    if (id === supabaseModule) return `
      export const supabase={from(){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,abortSignal:async()=>({data:[],error:null})};return q;}};
    `;
    if (id === preloadModule) return 'export const prefetchRoute=()=>{}; export const scheduleNavigationPreload=()=>()=>{};';
  },
  configureServer(server) {
    server.middlewares.use(async(req,res,next)=>{
      if(req.url!=='/individual-launch-fixture')return next();
      res.setHeader('content-type','text/html');
      res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="'+entry+'"></script></body></html>'));
    });
  }
};

export async function checkIndividualLaunchLayout({cdp,evaluate,wait}) {
  const cacheDir=await mkdtemp(join(tmpdir(),'chessaz-individual-launch-'));
  let server;
  const captureRoot=process.env.SPIELTAG_CAPTURE;
  const rows=[];
  try {
    server=await createServer({
      configFile:false,envDir:false,cacheDir,plugins:[plugin,react()],
      server:{host:'127.0.0.1',port:0,hmr:false},
      define:Object.fromEntries(Object.entries({
        VITE_SPIELTAG_LAUNCH_PREVIEW:'true',VITE_INDIVIDUAL_TOURNAMENTS_LIVE_ENABLED:'true',
        VITE_SPIELTAG_ENABLED:'true',VITE_AI_ORGANIZER_ENABLED:'true',VITE_SERVER_URL:fixtureOrigin,
      }).map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)])),
    });
    await server.listen();
    await cdp('Network.enable');
    await cdp('Network.setBlockedURLs',{urls:['https://*']});
    await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'individual-launch-fixture'});
    await wait("typeof window.fixtureAuth==='function' && typeof window.fixtureLocale==='function' && document.querySelector('.individual-create-hub')");
    if(captureRoot)await mkdir(captureRoot,{recursive:true});
    for(const signed of [false,true]){
      await evaluate('window.fixtureAuth('+signed+')');
      await wait(signed?"document.querySelector('.ai-organizer-composer input')":"document.querySelector('.individual-create-private-note a')");
      for(const lang of ['de','en','az','tr','ua','ru']){
        const tr=tournamentCopy(lang);
        await evaluate('window.fixtureLocale('+JSON.stringify(lang)+')');
        await wait("document.querySelector('.spieltag-launch > header h1')?.textContent==="+JSON.stringify(tr('individualIntro')));
        for(const [width,height] of [[1440,900],[1280,720],[390,844]]){
          await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
          await evaluate("document.querySelector('[data-route-scroll]')?.scrollTo(0,0);window.scrollTo(0,0);");
          await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
          const m=await evaluate(`(()=>{
            const q=s=>document.querySelector(s);
            const box=s=>{const el=q(s);if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
            const style=s=>{const el=q(s);const c=getComputedStyle(el);return [c.fontSize,c.fontWeight,c.color];};
            const grid=q('.team-create-hub-grid');
            const note=q('.individual-create-private-note');
            const h2=q('.individual-create-hub > h2');
            const visible=el=>el.getBoundingClientRect().height>0 && getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none';
            return {manual:box('.team-create-manual'),neo:box('.team-create-ai'),save:box('.team-create-manual button.team-create-primary'),
              composer:box('.ai-organizer-composer input'),innerHeight,innerWidth,scrollWidth:document.documentElement.scrollWidth,
              h1:[...document.querySelectorAll('.spieltag-launch h1')].filter(visible).length,
              hiddenH2:!!h2 && getComputedStyle(h2).position==='absolute' && h2.getBoundingClientRect().height<=1,
              note:note?.textContent,noteInside:!!note?.closest('.team-create-manual'),
              noteOutside:[...document.querySelectorAll('.spieltag-launch p')].some(p=>p.textContent===note?.textContent&&!p.closest('.team-create-manual')),
              guestHref:note?.querySelector('a')?.getAttribute('href')??null,
              teaser: !!q('.spieltag-launch-heading > .individual-create-soon') && !grid?.nextElementSibling?.classList.contains('individual-create-soon'),
              teaserText:q('.spieltag-launch-heading > .individual-create-soon')?.textContent,
              teaserBox:box('.spieltag-launch-heading > .individual-create-soon'),
              headerBox:box('.spieltag-launch-heading h1'),
              headingSize:parseFloat(getComputedStyle(q('.spieltag-launch-heading h1')).fontSize),
              headingText:q('.spieltag-launch-heading h1')?.textContent,
              oldBrand:!!q('.team-create-ai .ai-organizer-brand small'),
              badgeSize:q('.team-create-ai .ai-organizer-badge')?parseFloat(getComputedStyle(q('.team-create-ai .ai-organizer-badge')).fontSize):null,
              titleStyles:[style('.team-create-manual h3'),style('.team-create-ai h3')]};
          })()`);
          const tag=lang+'/'+(signed?'member':'guest')+'/'+width+'x'+height;
          const inside=r=>r && r.height>0 && r.top>=0 && r.bottom<=m.innerHeight+0.01;
          const pass=m.h1===1 && m.hiddenH2 && m.noteInside && !m.noteOutside && m.teaser &&
            m.headingText===tr('individualIntro') && m.headingSize>=18 &&
            m.teaserText===tr('teamTournamentsComingSoon') && m.teaserBox.bottom<=m.manual.top &&
            (width===390 || m.teaserBox.left>=m.headerBox.right-1) &&
            !m.oldBrand && (!signed || m.badgeSize>=12) &&
            m.note===tr(signed?'individualPrivate':'createHubSignIn') &&
            (signed?m.guestHref===null:m.guestHref==='/profile?returnTo=%2Fspieltag') &&
            JSON.stringify(m.titleStyles[0])===JSON.stringify(m.titleStyles[1]) &&
            m.scrollWidth<=m.innerWidth+1 &&
            (width===1440?inside(m.manual)&&inside(m.neo)&&Math.abs(m.manual.top-m.neo.top)<=1:
              width===1280?inside(m.save)&&(!signed||inside(m.composer)):m.manual.height>0&&m.neo.height===0);
          const row={locale:lang,auth:signed?'member':'guest',viewport:width+'x'+height,manualTop:m.manual.top,manualBottom:m.manual.bottom,neoTop:m.neo.top,neoBottom:m.neo.bottom,innerHeight:m.innerHeight,pass};
          rows.push(row);
          console.log('INDIVIDUAL_LAUNCH_MEASURE '+JSON.stringify(row));
          if(captureRoot && ['de','ru'].includes(lang)){
            const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
            await writeFile(join(captureRoot,'individual-launch-'+lang+'-'+row.auth+'-'+row.viewport+'.png'),Buffer.from(screenshot.data,'base64'));
          }
          assert.ok(pass,tag+' '+JSON.stringify(m));
          if(width===390){
            await evaluate("document.querySelector('.team-create-mobile-switch button:last-child').click()");
            await wait("document.querySelector('.team-create-hub-grid').dataset.mobileMode==='ai'");
            assert.ok(await evaluate("document.querySelector('.team-create-ai').getBoundingClientRect().height>0 && document.querySelector('.team-create-manual').getBoundingClientRect().height===0 && document.documentElement.scrollWidth<=innerWidth+1"),tag+' Neo mobile');
            await evaluate("document.querySelector('.team-create-mobile-switch button:first-child').click()");
            await wait("document.querySelector('.team-create-hub-grid').dataset.mobileMode==='manual'");
          }
        }
      }
    }
    assert.equal(rows.length,36);
    if(captureRoot)await writeFile(join(captureRoot,'individual-launch-measurements.json'),JSON.stringify(rows,null,2));
  } finally {
    await cdp('Emulation.clearDeviceMetricsOverride');
    await server?.close();
    await rm(cacheDir,{recursive:true,force:true});
  }
}
