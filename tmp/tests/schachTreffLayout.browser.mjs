import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';

const fixture=`import '/src/index.css';import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,BrowserRouter,Routes,Route}from'react-router-dom';import{LanguageProvider,useLanguage}from'/src/context/LanguageContext.tsx';import Chat from'/src/screens/ChessAZCommunityScreen.tsx';import Invite from'/src/screens/ClubInviteScreen.tsx';import Layout from'/src/components/Layout.tsx';import{ClubUnreadProvider}from'/src/components/schachTreff/unread.tsx';import{ThemeProvider}from'/src/context/ThemeContext.tsx';localStorage.setItem('app-language','ru');function Probe(){const {setLanguage}=useLanguage();window.setFixtureLanguage=setLanguage;return null}createRoot(document.getElementById('root')).render(<LanguageProvider>{import.meta.env.VITE_SCHACH_TREFF_MODERATION_ENABLED==='true'?<ThemeProvider><ClubUnreadProvider userId={new URLSearchParams(location.search).has('guest')?undefined:'11111111-1111-4111-8111-111111111111'}><BrowserRouter><Probe/><Routes><Route element={<Layout/>}><Route path='/chat' element={<Chat/>}/></Route></Routes></BrowserRouter></ClubUnreadProvider></ThemeProvider>:location.pathname==='/room-fixture'?<MemoryRouter><Probe/><Chat/></MemoryRouter>:<BrowserRouter><Probe/><Routes><Route path='/schach-treff/einladung/:token' element={<Invite/>}/><Route path='/chat' element={<Chat/>}/></Routes></BrowserRouter>}</LanguageProvider>);`;
const db=`const uid='11111111-1111-4111-8111-111111111111', room='22222222-2222-4222-8222-222222222222', guest='33333333-3333-4333-8333-333333333333', dm='44444444-4444-4444-8444-444444444444';
const mobileFixture = new URLSearchParams(location.search).has('mobileFixture');
const feed = Array.from({length:28}, (_, index) => ({
  id:'message-'+index, author_id:index===20 ? uid : index>=21 && index<=24 || index>=26 ? guest : index%2 ? uid : guest,
  body:['Добро пожаловать в Schach-Treff!','Кто хочет сыграть тренировочную партию?','Я буду онлайн после восьми.','Отлично, давайте обсудим дебют после партии.'][index%4],
  created_at:new Date(Date.UTC(2026,10,4,12,0,0)+(index+(index>=24?6:0))*60000).toISOString()
}));
const counts = { [uid]: 4, [room]: 2 };
window.fixtureKeepBadges = true;
const reports = [{message_id:'message-25',body:'Сообщение, на которое пожаловались',kind:'text',hidden:true,reasons:['spam','abuse','other']}];
export const supabase = {
  channel(){let sync;const channel={on(type,event,callback){if(type==='presence')sync=callback;return channel},subscribe(callback){if(mobileFixture){callback?.('SUBSCRIBED');sync?.()}return channel},presenceState(){return mobileFixture&&!new URLSearchParams(location.search).has('emptyOnline') ? {[guest]:[{}]} : {}},track(){return Promise.resolve('ok')}};return channel},removeChannel(){return Promise.resolve()},
  rpc(name, payload) {
    const ok = data => Promise.resolve({data,error:null});
    if(name==='get_club_unread_counts') return ok(Object.entries(counts).map(([id,count])=>({club_id:id,is_general:id===uid,unread_count:count})));
    if(name==='mark_club_read') {
      if(!window.fixtureKeepBadges) counts[payload.p_club_id]=0;
      window.fixtureMarked=payload;
      return ok(null);
    }
    if(name==='list_club_message_reports') return ok(reports);
    if(name==='report_club_message') {window.fixtureReport=payload;return ok(null)}
    if(name==='restore_club_message') {
      window.fixtureRestore=payload;
      reports.splice(reports.findIndex(row=>row.message_id===payload.p_message_id),1);
      return ok(null);
    }
    if(name==='delete_club_message' || name==='clear_club_chat') {
      for(const row of feed) if(name==='clear_club_chat' || row.id===payload.p_message_id) {
        row.body=null;row.deleted_at=new Date().toISOString();
      }
      window.fixtureDelete=payload;
      return ok(null);
    }
    if(name==='revoke_club_invites') {window.fixtureRevoked=payload;return ok(null)}
    if(name==='club_player_summary') return {abortSignal(){return Promise.resolve({data:new URLSearchParams(location.search).has('polish') ? {completed_games:24,last_games:[{opponent:'LongPlayerNameWithoutSpaces0123456789',time_control:'5+0',result:'1-0'},{opponent:'nar',time_control:'3+2',result:'1/2-1/2'}]} : {completed_games:0,last_games:[]},error:null})}};
    if(name==='club_chat_game_results') return ok([]);
    if(name==='create_club_invite' && payload.p_club_id===room) {
      window.fixtureInvites = (window.fixtureInvites || 0) + 1;
      if(window.fixtureInviteLimit) return {data:null,error:{message:'invite_limit'}};
      return {data:'a'.repeat(32),error:null};
    }
    if(name==='join_club_by_invite'){
      sessionStorage.setItem('fixtureJoinCalls',String(Number(sessionStorage.getItem('fixtureJoinCalls')||0)+1));
      sessionStorage.setItem('fixtureInviteToken',payload.p_token);
      const q=new URLSearchParams(location.search).get('scenario');
      if(q==='slow')return new Promise(resolve=>setTimeout(()=>resolve({data:room,error:null}),750));
      if(q==='expired')return Promise.resolve({data:null,error:{message:'invite_expired'}});
      if(q==='unexpected')return Promise.resolve({data:null,error:{message:'unknown_error'}});
      if(q==='badroom')return Promise.resolve({data:'bad-room-id',error:null});
      if(q==='rejected')return Promise.reject(Error('fixture denied'));
      sessionStorage.setItem('fixtureJoinedRoom',room);
      return Promise.resolve({data:room,error:null});
    }
    throw Error('Unexpected RPC '+name);
  },
  from(table) {
    let single=false, columns='';
    const filters=new Map();
    const q={not(){return q},is(){return q},select(v){columns=v;return q},eq(k,v){filters.set(k,v);return q},in(){return q},gte(){return q},order(){return q},limit(){return q},
      maybeSingle(){single=true;return q},
      insert(row) {
        if(table!=='chess_club_messages') throw Error('Unexpected write');
        feed.push({...row,id:'message-'+feed.length,created_at:new Date().toISOString()});
        return Promise.resolve({error:null});
      },
      then(resolve,reject) {
        let rows=[];
        if(table==='chess_clubs') {
          rows=filters.get('kind')==='room'||filters.get('id')===room
            ? [{id:room,name:'Schachverein',kind:'room',is_open:false,slug:'room-schachverein'},...(new URLSearchParams(location.search).has('duplicate') ? [{id:guest,name:'Schachverein'}] : [])]
            : [{id:uid,name:'ChessAZ Deutsch',kind:'community',is_open:true,slug:'chessaz-deutsch'}];
          if(mobileFixture && (filters.get('kind')==='dm' || filters.get('id')===dm)) rows=[{id:dm,name:'Direct message',kind:'dm',dm_key:uid+':'+guest}];
          if(columns==='pinned_body,pinned_by' && filters.get('id')===room) rows=[{pinned_by:guest,pinned_body:('В пятницу тренировка по эндшпилю. Присоединяйтесь к разбору партий. ').repeat(6)}];
        } else if(table==='chess_club_members') {
          const params=new URLSearchParams(location.search);
          rows=[{user_id:uid,role:params.get('role') || (params.has('club')?'admin':'member')},{user_id:guest,role:'member'}];
        } else if(table==='profiles') {
          rows=[{id:uid,username:'Sofia'},{id:guest,username:'Maksim'}];
        } else if(table==='chess_club_messages') rows=columns==='parent_id' ? (mobileFixture ? [{parent_id:'message-27'}] : []) : feed.slice().reverse();
        else if(mobileFixture && table==='chess_club_message_reactions') rows=[{message_id:'message-27',user_id:guest,reaction:'!'}];
        else if(table==='chess_club_challenges') rows=[{
          id:'challenge-26',message_id:'message-26',created_by:guest,target_user_id:uid,
          time_control:'3+2',status:'open',expires_at:'2099-12-31T23:59:59Z',room_id:null
        }];
        if(mobileFixture && table==='chess_club_challenges') rows.push(...['cancelled','expired','accepted'].map((status,index)=>({id:'status-'+status,message_id:'message-'+(23+index),created_by:guest,target_user_id:uid,time_control:'5+0',status,expires_at:'2099-12-31T23:59:59Z',room_id:null}))); 
        return Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(resolve,reject);
      }
    };return q;
  }
};`;
const plugin={name:'schach-treff-fixture',enforce:'pre',resolveId(id){if(id==='/__room_fixture.tsx')return id;if(/context\/AuthContext(?:\.tsx)?$/.test(id))return '\0room-auth';if(/context\/SocketContext(?:\.tsx)?$/.test(id))return '\0room-socket';if(/services\/supabase(?:\.ts)?$/.test(id))return '\0room-db';},load(id){if(id==='/__room_fixture.tsx')return fixture;if(id==='\0room-auth')return `const user={id:'11111111-1111-4111-8111-111111111111'};export function useAuth(){return {user:new URLSearchParams(location.search).has('guest')?null:user,isLoading:false}}`;if(id==='\0room-socket')return `const socket={on(){},off(){},emit(){},timeout(){return {emit(_event,_payload,cb){cb?.(null,{ok:true})}}}};export function useSocket(){return {socket,isConnected:true}}`;if(id==='\0room-db')return db},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!/^\/(?:room-fixture(?:\?|$)|schach-treff\/einladung\/|chat(?:\?|$))/.test(req.url))return next();res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/room-fixture','<!doctype html><html><head><title>ChessAZ</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/__room_fixture.tsx"></script></body></html>'));});}};
export async function checkRoomLayout(moderation = false, polish = false){
 const server=await createServer({configFile:false,define:{'import.meta.env.VITE_SCHACH_TREFF_V2':JSON.stringify(polish?'true':'false'),'import.meta.env.VITE_CLUBS_NRW_ENABLED':JSON.stringify(polish?'true':'false'),'import.meta.env.VITE_SPIELTAG_ENABLED':JSON.stringify(moderation&&polish?'true':'false'),'import.meta.env.VITE_SCHACH_TREFF_MODERATION_ENABLED':JSON.stringify(moderation?'true':'false')},cacheDir:join(tmpdir(),'room-vite-'+process.pid),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react-router-dom','lucide-react']},plugins:[plugin,react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}}});let chrome,ws,profile;const pending=new Map();
 try{await server.listen();const bin=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(bin,'Chromium required for Schach-Treff layout');profile=await mkdtemp(join(tmpdir(),'schach-rooms-'));chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';chrome.stderr.on('data',c=>stderr=(stderr+c).slice(-4000));const pause=ms=>new Promise(r=>setTimeout(r,ms));let port;for(let i=0;i<600;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break}catch{}await pause(50)}assert.ok(port,stderr);const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});let seq=0;ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});const evaluate=async expression=>{let x=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value};const wait=async expression=>{for(let i=0;i<240;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(50)}throw Error('Fixture did not load '+expression)};await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.bringToFront');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});if(process.env.SECTIONS_CAPTURE)await mkdir(process.env.SECTIONS_CAPTURE,{recursive:true});
 if (moderation && polish) {
   const root=server.resolvedUrls.local[0], base=root+'chat?mobileFixture=1&role=member&polish=1';
   const capture=async name=>{if(process.env.SECTIONS_CAPTURE){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(process.env.SECTIONS_CAPTURE,'schach-treff-mobile-v2-'+name+'.png'),Buffer.from(shot.data,'base64'));}};
   const click=async selector=>{await wait(`document.querySelector(${JSON.stringify(selector)})`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);};
   const closeSheet=async()=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('dialog[open]')");};
   const settle=()=>evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
   const viewportGeometry=()=>evaluate(`(()=>{const page=document.querySelector('.st-mobile-v2'),title=page.querySelector('.st-mobile-v2-title'),more=title.querySelector('button'),composer=page.querySelector('.st-composer'),nav=document.querySelector('[data-mobile-app-nav]'),ancestors=[];for(let e=page;e;e=e.parentElement)ancestors.push({node:e.tagName,id:e.id,overflow:e.scrollHeight-e.clientHeight,scrollTop:e.scrollTop});const r=e=>e.getBoundingClientRect();return {ancestors,scrollTop:document.scrollingElement.scrollTop,top:r(title).top,titleBottom:r(title).bottom,moreTop:r(more).top,moreBottom:r(more).bottom,keyboard:page.hasAttribute('data-st-keyboard'),navHidden:getComputedStyle(nav).display==='none',gap:(getComputedStyle(nav).display==='none'?(visualViewport?.height??innerHeight):r(nav).top)-r(composer).bottom,navBottom:r(nav).bottom,visible:visualViewport?.height??innerHeight,layout:innerHeight,feed:page.querySelector('.st-messages').clientHeight,atEnd:(()=>{const f=page.querySelector('.st-messages');return f.scrollHeight-f.clientHeight-f.scrollTop<=2})()}})()`);
   const viewportFits=async context=>{await settle();const g=await viewportGeometry();assert.ok(g.scrollTop===0&&g.ancestors.every(a=>a.scrollTop===0&&a.overflow<=1)&&g.top>=-1&&g.moreTop>=-1&&g.moreBottom<=g.titleBottom+1&&g.titleBottom<g.visible&&g.keyboard===g.navHidden&&g.gap>=-1&&g.gap<=2&&g.navBottom<=g.visible+1&&g.feed>0,context+' '+JSON.stringify(g));return g;};
   const positionFits=async(width,height,captureName)=>{await click('.st2-position-trigger');await wait("document.querySelector('dialog[open] .st2-position-form .st2-board-play button')");await fitsSheet(width,height);const g=await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),form=d.querySelector('.st2-position-form'),b=form.querySelector('.st2-board'),h=d.querySelector('h2'),r=b.getBoundingClientRect(),hr=h.getBoundingClientRect(),style=getComputedStyle(h);return {w:r.width,h:r.height,available:form.clientWidth,squares:b.querySelectorAll('button').length,scroll:d.scrollWidth-d.clientWidth,verticalScroll:getComputedStyle(d).overflowY,titleHeight:hr.height,lineHeight:parseFloat(style.lineHeight),titleFits:h.scrollWidth<=h.clientWidth+1,wordBreak:style.wordBreak,wrap:style.overflowWrap}})()`);assert.ok(Math.abs(g.w-Math.min(g.available,420))<=1&&Math.abs(g.w-g.h)<=1&&g.squares===64&&g.scroll<=1&&['auto','scroll'].includes(g.verticalScroll)&&g.titleFits&&g.wordBreak==='normal'&&g.wrap==='normal',JSON.stringify(g));if(captureName)await capture(captureName);await closeSheet();};
   const fitsSheet=async(width,height)=>{const box=await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:d.scrollWidth,client:d.clientWidth}})()`);assert.ok(box.left>=-1&&box.right<=width+1&&box.top>=-1&&box.bottom<=height+1&&box.scroll<=box.client+1,JSON.stringify(box));};
   for(const width of [360,390,430]){const height=844;await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await cdp('Page.navigate',{url:base});await wait("document.querySelector('.st-mobile-play:not(:disabled)')&&document.querySelector('.st-composer')&&document.querySelector('.st-mobile-online-list button')");
     for(const zoom of [100,125]){await evaluate(`document.documentElement.style.fontSize=17*${zoom}/100+'px'`);
       for(const lang of ['de','en','ua','az','tr','ru']){await evaluate(`window.setFixtureLanguage('${lang}')`);await wait(`document.documentElement.lang==='${lang==='ua'?'uk':lang}'`);await evaluate('document.fonts.ready.then(()=>true)');
         const geometry=await evaluate(`(()=>{const f=document.querySelector('.st-messages'),c=document.querySelector('.st-composer'),nav=document.querySelector('[data-mobile-app-nav]'),labels=[...nav.querySelectorAll('.site-nav-label')];return {legacy:!!document.querySelector('.st-mobile-legacy,.st-mobile-community,.st-mobile-directory,.st-mobile-members'),menu:[...document.querySelectorAll('.st-mobile-v2 button,.st-mobile-v2 summary')].filter(e=>e.getClientRects().length&&e.textContent.trim()==='⋯').length,feed:f.clientHeight,overflow:f.scrollWidth-f.clientWidth,composerOverflow:c.scrollWidth-c.clientWidth,composerBottom:c.getBoundingClientRect().bottom,navTop:nav.getBoundingClientRect().top,doc:document.documentElement.scrollWidth,title:document.title,labels:labels.map(e=>{const style=getComputedStyle(e),node=e.firstChild,r=e.getBoundingClientRect(),link=e.closest('a').getBoundingClientRect(),lines={};for(let i=0;i<node.textContent.length;i++){const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const rects=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);const char=rects[0]??range.getBoundingClientRect();const key=char.top.toFixed(2);(lines[key]??=[]).push(node.textContent[i]);if(rects.some(rect=>rect.left<link.left-1||rect.right>link.right+1||rect.left<r.left-1||rect.right>r.right+1))return {text:e.textContent,outside:true,char:node.textContent[i],rects:rects.map(rect=>({left:rect.left,right:rect.right,top:rect.top})),label:{left:r.left,right:r.right},link:{left:link.left,right:link.right},font:style.font}}return {whiteSpace:style.whiteSpace,overflowWrap:style.overflowWrap,textOverflow:style.textOverflow,lines:Object.values(lines).map(chars=>chars.join('')),text:e.textContent,left:r.left,right:r.right,scroll:e.scrollWidth,client:e.clientWidth}}),actions:[...document.querySelectorAll('.st-message-actions>summary')].map(e=>{const header=e.closest('.st-message-heading'),r=e.getBoundingClientRect(),h=header?.getBoundingClientRect(),challenge=header?.querySelector('.st-challenge-icon')?.getBoundingClientRect();return !!h&&r.width>=44&&r.height>=44&&r.top>=h.top-1&&r.bottom<=h.bottom+1&&r.right<=h.right+1&&(!challenge||challenge.width>=44&&challenge.height>=44&&challenge.right<=r.left+1&&Math.abs(challenge.top-r.top)<=1)})}})()`);
         assert.ok(!geometry.legacy&&geometry.menu===1&&geometry.feed>0&&geometry.overflow<=1&&geometry.composerOverflow<=1&&geometry.composerBottom<=geometry.navTop+1&&geometry.doc<=width+1&&geometry.title!=='tmp',lang+' '+zoom+' '+width+' '+JSON.stringify(geometry));
         assert.equal(geometry.labels.length,6,'include the optional Spieltag link');
         assert.ok(geometry.labels.every(l=>!l.outside&&l.textOverflow==='clip'&&l.overflowWrap==='normal'&&l.scroll<=l.client+1&&(l.text==='Schach-Treff'?(l.lines.join('')===l.text&&(l.lines.length===1||JSON.stringify(l.lines)===JSON.stringify(['Schach-','Treff']))):l.whiteSpace==='nowrap'&&l.lines.length===1&&l.lines[0]===l.text)),JSON.stringify(geometry.labels));
         assert.ok(geometry.labels.slice(1).every((l,i)=>l.left>=geometry.labels[i].right-1),JSON.stringify(geometry.labels));
         assert.ok(geometry.actions.length>0&&geometry.actions.every(Boolean),'message actions belong to their header and have 44px targets');
         await viewportFits(lang+' '+zoom+' '+width);
         const take=width===390&&zoom===125&&lang==='ru';if(take){await capture('chat');await capture('bottom-nav');}
         if(lang==='ru')await positionFits(width,height,take?'position-125':undefined);
         await click('.st-mobile-room-trigger');await wait("document.querySelector('.st-mobile-sheet[open] .st-room-list>a')");await fitsSheet(width,height);await wait("document.querySelector('.st-mobile-sheet[open] .st-unread-badge')");assert.ok(await evaluate("[...document.querySelectorAll('.st-mobile-sheet[open] .st-unread-badge')].every(e=>{const r=e.getBoundingClientRect();return r.height>0&&r.height<=24&&Math.abs(r.width-r.height)<=1})"),'single-digit unread counts are round');if(take)await capture('rooms');await closeSheet();
         await click('.st-mobile-play');await wait("document.querySelector('.st-mobile-challenge[open]')");await fitsSheet(width,height);
         const challenge=await evaluate(`(()=>{const d=document.querySelector('.st-mobile-challenge[open]'),[a,b]=d.querySelectorAll('.st-mobile-challenge-kind button'),p=d.querySelector('.st-mobile-primary'),s=d.querySelector('.st-mobile-secondary');return {open:a.getAttribute('aria-pressed')==='true',separate:b.getBoundingClientRect().top>=a.getBoundingClientRect().bottom,colors:getComputedStyle(p).backgroundColor!==getComputedStyle(s).backgroundColor,targets:[...d.querySelectorAll('button')].every(e=>e.getBoundingClientRect().height>=44),opponents:!!d.querySelector('.st-mobile-opponents')}})()`);
         assert.ok(challenge.open&&challenge.separate&&challenge.colors&&challenge.targets&&!challenge.opponents,JSON.stringify(challenge));if(take)await capture('challenge-open');
         await click('.st-mobile-challenge-kind button:nth-of-type(2)');await wait("document.querySelector('.st-mobile-opponents button')");await click('.st-mobile-opponents button');await fitsSheet(width,height);if(take)await capture('challenge-personal');await closeSheet();
         await click('.st-mobile-v2-more');await wait("document.querySelector('.st-mobile-sheet[open] .st-mobile-sheet-rows')");await fitsSheet(width,height);if(take)await capture('club-menu');
         await click('.st-mobile-sheet-rows>button:first-child');await wait("document.querySelector('.st-mobile-sheet[open] .st2-members li')");await fitsSheet(width,height);if(take)await capture('members');await closeSheet();
         await click('.st-mobile-v2-more');await click('.st-mobile-sheet-rows>button:nth-child(2)');await wait("document.querySelector('.st-mobile-sheet[open] h2')&&!document.querySelector('.st-mobile-sheet-rows')");await fitsSheet(width,height);if(take)await capture('ranking');await closeSheet();
         assert.equal(await evaluate("[...document.querySelectorAll('.st-challenge-card')].filter(e=>!e.querySelector('.st-challenge-status')&&!e.querySelector('button')).length"),3,'expired, cancelled and accepted statuses are not duplicated');
       }
     }
   }
   // Real-phone regressions: enlarged nav line boxes, shorter visible window and keyboard focus.
   for(const zoom of [125,150])for(const toolbar of [0,56]){
     const width=390,height=844-toolbar,suffix=zoom+(toolbar?'-toolbar':'');
     await cdp('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:844,deviceScaleFactor:1,mobile:true});
     await cdp('Page.navigate',{url:base});
     await wait("document.querySelector('.st-mobile-play:not(:disabled)')&&document.querySelector('.st-mobile-reaction-trigger')");
     await evaluate(`(()=>{document.documentElement.style.fontSize=17*${zoom}/100+'px';const style=document.createElement('style');style.textContent='[data-mobile-app-nav] .site-nav-label{line-height:2.4!important}';document.head.appendChild(style);})()`);
     await evaluate("window.setFixtureLanguage('ru')");
     await wait("document.documentElement.lang==='ru'&&document.querySelector('.st2-reaction-row')");
     assert.ok(await evaluate("(()=>{const form=document.querySelector('.st-composer'),input=form.querySelector('input');return form.autocomplete==='off'&&input.autocomplete==='off'&&input.name==='chat-message'&&input.inputMode==='text'&&input.enterKeyHint==='send'})()"),'mobile chat is identified as plain message input, not a personal-data form');
     const before=await viewportFits('stress '+suffix);
     assert.ok(before.visible<=height+1,'shortened visible viewport is actually applied');
     await evaluate("(()=>{const f=document.querySelector('.st-messages');f.scrollTop=f.scrollHeight;document.querySelector('.st-composer input').focus();})()");
     await viewportFits('focused '+suffix);
     // A focused field alone does not emulate a keyboard. Also exercise a reduced viewport.
     const keyboardHeight=520;
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:keyboardHeight,screenWidth:width,screenHeight:844,deviceScaleFactor:1,mobile:true});
     await wait("document.querySelector('.st-mobile-v2').hasAttribute('data-st-keyboard')");
     const keyboard=await viewportFits('keyboard-sized viewport '+suffix);
     assert.ok(keyboard.visible<=keyboardHeight+1&&keyboard.visible<before.visible-120,'viewport actually shrank');
     assert.ok(keyboard.navHidden&&keyboard.atEnd&&keyboard.feed>before.feed-(before.visible-keyboard.visible),'keyboard hides navigation, recovers feed space and keeps the newest message visible');
     assert.ok(await evaluate("(()=>{const top=document.querySelector('.st-mobile-v2-top'),menu=top.querySelector('.st-mobile-v2-more').getBoundingClientRect(),room=top.querySelector('.st-mobile-room-trigger').getBoundingClientRect(),play=top.querySelector('.st-mobile-play').getBoundingClientRect();return Math.abs(menu.top-room.top)<=2&&Math.abs(menu.top-play.top)<=2&&menu.right<=room.left&&room.right<=play.left&&[menu,room,play].every(r=>r.height>=44&&r.width>=44)})()"),'keyboard toolbar fits in a single row with accessible targets');
     await capture('keyboard-'+suffix);
     assert.ok(await evaluate("document.activeElement===document.querySelector('.st-composer input')&&getComputedStyle(document.querySelector('.st-mobile-online')).display==='none'"),'composer stays focused; presence strip compacts');
     await cdp('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:844,deviceScaleFactor:1,mobile:true});
     await wait("!document.querySelector('.st-mobile-v2').hasAttribute('data-st-keyboard')");
     const restored=await viewportFits('restored viewport '+suffix);
     assert.ok(!restored.navHidden&&restored.atEnd,'navigation and latest message restore after keyboard closes');
     await evaluate("(()=>{const f=document.querySelector('.st-messages');f.scrollTop=0;})()");
     await settle();
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:keyboardHeight,screenWidth:width,screenHeight:844,deviceScaleFactor:1,mobile:true});
     await wait("document.querySelector('.st-mobile-v2').hasAttribute('data-st-keyboard')");
     assert.ok(await evaluate("document.querySelector('.st-messages').scrollTop<=2"),'reading history must not jump to newest message on keyboard open');
     await cdp('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:844,deviceScaleFactor:1,mobile:true});
     await wait("!document.querySelector('.st-mobile-v2').hasAttribute('data-st-keyboard')");
     await evaluate("document.querySelector('.st-composer input').blur();document.querySelector('[data-route-scroll]').scrollTop=100;window.scrollTo(0,100)");
     await viewportFits('blurred '+suffix);
     assert.equal(await evaluate("document.querySelectorAll('.st2-tools').length"),0,'quick reactions start hidden');
     assert.ok(await evaluate("Boolean(document.querySelector('.st2-reaction-row .st2-reaction')&&document.querySelector('.st2-reaction-row .st2-replies'))"),'existing reactions and reply count stay visible');
     assert.ok(await evaluate("Boolean(document.querySelector('.st-message-own .st-message-actions svg.lucide-ellipsis-vertical')&&document.querySelector('.st-message:not(.st-message-own) .st-message-actions svg.lucide-flag'))"),'own/other message actions use distinct icons');
     await capture('viewport-chat-'+suffix);await capture('viewport-nav-'+suffix);
     const tap=async()=>{const p=await evaluate(`(()=>{const e=[...document.querySelectorAll('.st-mobile-reaction-trigger')].at(-1);e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
     await tap();await wait("document.querySelectorAll('.st2-tools').length===1");
     assert.ok(await evaluate("[...document.querySelectorAll('.st2-tools button')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44})"),'44px reaction targets');
     assert.ok(await evaluate("Boolean(document.querySelector('.st2-reaction-row .st2-reaction')&&document.querySelector('.st2-reaction-row .st2-replies'))"),'counts remain visible');
     await evaluate("document.querySelector('.st2-tools').scrollIntoView({block:'nearest'})");await viewportFits('reactions '+suffix);await capture('viewport-reactions-'+suffix);
     await tap();await wait("!document.querySelector('.st2-tools')");
     await tap();await wait("document.querySelector('.st2-tools')");
     await evaluate("document.querySelector('.st-mobile-v2-title h1').click()");await wait("!document.querySelector('.st2-tools')");
     await positionFits(width,height,'viewport-position-'+suffix);
     await click('.st-mobile-v2-more');await wait("document.querySelector('.st-mobile-sheet[open] .st-mobile-sheet-rows')");await fitsSheet(width,height);await capture('viewport-menu-'+suffix);await closeSheet();await viewportFits('closed '+suffix);
   }
   await cdp('Emulation.setDeviceMetricsOverride',{width:430,height:844,deviceScaleFactor:1,mobile:true});
   await cdp('Page.navigate',{url:base+'&club=44444444-4444-4444-8444-444444444444'});await wait("document.querySelector('.st-mobile-room-trigger strong')?.textContent==='Maksim'&&document.querySelector('.st-mobile-play:not(:disabled)')");
   await click('.st-mobile-play');await wait("document.querySelector('.st-mobile-challenge[open] .st-mobile-opponents button[aria-pressed=true]')?.textContent==='Maksim'");
   assert.equal(await evaluate("document.querySelector('.st-mobile-challenge-kind button:nth-of-type(2)').getAttribute('aria-pressed')"),'true');await closeSheet();
   await cdp('Page.navigate',{url:base+'&emptyOnline=1'});await wait("document.querySelector('.st-mobile-play:not(:disabled)')&&document.querySelector('.st-composer')");assert.equal(await evaluate("Boolean(document.querySelector('.st-mobile-online'))"),false,'empty online strip is hidden');
   return;
 }
 if (polish) {
   const fixtureUrl=server.resolvedUrls.local[0]+'room-fixture?club=22222222-2222-4222-8222-222222222222&polish=1';
   for (const width of [375,1366,1920]) {
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===375?844:900,deviceScaleFactor:1,mobile:width===375});
     await cdp('Page.navigate',{url:fixtureUrl});
     await wait("document.querySelector('.st-messages .st-name') && document.querySelector('.st-challenge-icon')");
     assert.equal(await evaluate("Boolean(document.querySelector('.schach-treff>header>.st2-feedback'))"),false);
     if(width===375){
       await evaluate("document.querySelector('.st-mobile-v2-more').click()");
       await wait("document.querySelector('.st-mobile-sheet[open] .st2-feedback')");
       await evaluate("document.querySelector('.st-mobile-sheet[open] .st2-feedback').click()");
       await wait("document.querySelector('.st2-feedback-dialog[open] textarea')");
       await evaluate("document.querySelector('.st2-feedback-dialog .st2-icon-button').click()");
       await wait("!document.querySelector('.st2-feedback-dialog[open]')");
       await evaluate("document.querySelector('.st-mobile-sheet[open] .st-mobile-sheet-head>button').click()");
       await wait("!document.querySelector('.st-mobile-sheet[open]')");
     }else{
     assert.equal(await evaluate("document.querySelector('.st-menu nav').hidden"),true);
     await evaluate("document.querySelector('.st-menu>button').click()");
     await wait("!document.querySelector('.st-menu nav').hidden");
     await evaluate("document.querySelector('.st-menu .st2-feedback').click()");
     await wait("document.querySelector('.st2-feedback-dialog[open] textarea')");
     await evaluate("document.querySelector('.st2-feedback-dialog .st2-icon-button').click()");
     await wait("!document.querySelector('.st2-feedback-dialog[open]')");
     await evaluate("document.querySelector('.st-menu>button').click()");
     }
     if (width>=1024) {
       assert.equal(await evaluate("getComputedStyle(document.querySelector('.st2-side:not(.st2-thread)>.st2-side-title')).color"),'rgb(195, 161, 122)');
       const compact=await evaluate(`(()=>{
         const header=document.querySelector('.schach-treff>header'),title=header.querySelector('h1'),nrw=header.querySelector('.st-region-entry'),menu=header.querySelector('.st-menu>button'),chat=document.querySelector('.st-chat'),style=getComputedStyle(header),r=title.getBoundingClientRect();
         return {titleWidth:r.width,titleHeight:r.height,titleText:title.textContent,nrwHidden:!!nrw&&getComputedStyle(nrw).display==='none',menuHeight:menu.getBoundingClientRect().height,headerHeight:header.getBoundingClientRect().height,margin:style.marginBottom,chatHeight:chat.getBoundingClientRect().height,chatTop:chat.getBoundingClientRect().top,chatBottom:chat.getBoundingClientRect().bottom};
       })()`);
       assert.ok(compact.titleText&&compact.titleWidth<=1&&compact.titleHeight<=1,'duplicate title is visually hidden but accessible');
       assert.ok(compact.nrwHidden,'duplicate NRW link hidden on desktop');
       assert.ok(compact.menuHeight>=44&&compact.headerHeight<=compact.menuHeight+1&&compact.margin==='0px','compact header preserves menu: '+JSON.stringify(compact));
       assert.ok(Math.abs(compact.chatHeight-(900-93))<=1&&compact.chatTop<=53&&compact.chatBottom<=901,'chat gains the reclaimed 52px without bottom clipping: '+JSON.stringify(compact));

     }
     await evaluate("document.querySelector('.st-messages .st-name').click()");
     await wait("document.querySelector('dialog.st2-player-dialog[open] .st-player-history li')");
     assert.equal(await evaluate("document.querySelector('dialog[open]').getAttribute('aria-labelledby')"),'st-player-name');
     assert.equal(await evaluate("document.querySelector('.st-player-total strong').textContent"),'24');
     assert.deepEqual(await evaluate("[...document.querySelectorAll('.st-player-ratings dd')].map(e=>e.textContent)"),['—','—']);
     for (const lang of ['de','en','az','tr','ua','ru']) {
       await evaluate(`window.setFixtureLanguage('${lang}')`);
       await wait(`document.documentElement.lang==='${lang==='ua'?'uk':lang}'`);
       const layout=await evaluate(`(()=>{
         const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect(),name=d.querySelector('h2');
         return {left:r.left,right:r.right,bottom:r.bottom,top:r.top,scroll:d.scrollWidth,client:d.clientWidth,
           font:getComputedStyle(name).fontFamily,size:getComputedStyle(name).fontSize,
           actions:[...d.querySelectorAll('.st-player-actions button')].map(b=>({height:b.getBoundingClientRect().height,scroll:b.scrollWidth,client:b.clientWidth}))};
       })()`);
       assert.ok(layout.left>=0 && layout.right<=width && layout.top>=0 && layout.bottom<=(width===375?844:900),JSON.stringify(layout));
       assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
       assert.ok(layout.font.includes('Inter') && layout.size==='22px',JSON.stringify(layout));
       assert.equal(layout.actions.length,2,'challenge and private-message actions remain available');
       assert.ok(layout.actions.every(a=>a.height>=44 && a.scroll<=a.client+1),JSON.stringify(layout));
     }
     if(process.env.SECTIONS_CAPTURE) {
       const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
       await writeFile(join(process.env.SECTIONS_CAPTURE,'schach-treff-player-polish-'+width+'.png'),Buffer.from(shot.data,'base64'));
     }
     await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
     await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
     await wait("!document.querySelector('dialog[open]')");
     if(width>=1024) {
       await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'room-fixture?polish=1'});
       await wait("document.querySelector('.st-general-link[aria-current=page]') && document.querySelector('.st-composer')");
       assert.equal(await evaluate("getComputedStyle(document.querySelector('.st-general-link')).animationName"),'none');
       for (const lang of ['de','en','az','tr','ua','ru']) {
         await evaluate(`window.setFixtureLanguage('${lang}')`);
         await wait(`document.documentElement.lang==='${lang==='ua'?'uk':lang}'`);
         const layout=await evaluate(`(()=>{
           const chat=document.querySelector('.st-chat'),feed=chat.querySelector('.st-messages'),composer=chat.querySelector('.st-composer'),online=chat.querySelector('.st2-online'),seek=document.querySelector('.st2-rooms-seek .st2-seek-trigger'),settings=document.querySelector('.st-rooms .st2-settings-link'),motto=chat.querySelector('.st2-general-motto'),menu=document.querySelector('.st-menu>button'),nrw=document.querySelector('.st-region-entry'),title=document.querySelector('.schach-treff>header h1');
           return {onlineHidden:!!online&&getComputedStyle(online).display==='none',nrwHidden:!!nrw&&getComputedStyle(nrw).display==='none',titleHidden:title.getBoundingClientRect().width<=1,seekVisible:!!seek&&seek.getBoundingClientRect().width>0,seekUnique:document.querySelectorAll('.st2-seek-trigger').length===1,seekBelowSettings:!!settings&&!!seek&&seek.getBoundingClientRect().top>=settings.getBoundingClientRect().bottom,seekNearComposer:!!seek&&Math.abs(seek.getBoundingClientRect().bottom-composer.getBoundingClientRect().bottom)<=20,mottoCentered:getComputedStyle(motto).textAlign==='center'&&Math.abs((motto.getBoundingClientRect().left+motto.getBoundingClientRect().right-chat.getBoundingClientRect().left-chat.getBoundingClientRect().right)/2)<=2,menuVisible:menu.getBoundingClientRect().height>=44,feedHeight:feed.clientHeight,chatHeight:chat.getBoundingClientRect().height,composerBottom:composer.getBoundingClientRect().bottom,chatBottom:chat.getBoundingClientRect().bottom,docWidth:document.documentElement.scrollWidth};
         })()`);
         assert.ok(layout.onlineHidden&&layout.nrwHidden&&layout.titleHidden&&layout.seekVisible&&layout.seekUnique&&layout.seekBelowSettings&&layout.seekNearComposer&&layout.mottoCentered&&layout.menuVisible,'desktop controls '+lang+' '+JSON.stringify(layout));
         assert.ok(layout.feedHeight>0&&Math.abs(layout.chatHeight-(900-93))<=1&&layout.composerBottom<=layout.chatBottom+1&&layout.chatBottom<=901&&layout.docWidth<=width+1,'chat fits '+lang+' '+JSON.stringify(layout));
       }
       await evaluate("document.querySelector('.st2-rooms-seek .st2-seek-trigger').click()");
       await wait("document.querySelector('.st2-rooms-seek .st2-seek-popover')");
       const popupFits=await evaluate(`(()=>{const p=document.querySelector('.st2-rooms-seek .st2-seek-popover').getBoundingClientRect(),r=document.querySelector('.st-rooms').getBoundingClientRect();return p.left>=r.left&&p.right<=r.right&&p.top>=r.top&&p.bottom<=r.bottom})()`);
       assert.ok(popupFits,'Seek popover fits in room column');
       await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
       await wait("!document.querySelector('.st2-rooms-seek .st2-seek-popover')");
       if(process.env.SECTIONS_CAPTURE) {
         const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
         await writeFile(join(process.env.SECTIONS_CAPTURE,'schach-treff-compact-general-'+width+'.png'),Buffer.from(shot.data,'base64'));

       }
     }
   }
   return;
 }
 if (moderation) {
   const root = server.resolvedUrls.local[0];
   const room = '22222222-2222-4222-8222-222222222222';
   const url = root + 'chat?club=' + room;
   const capture = async (name, width) => {
     if (!process.env.SECTIONS_CAPTURE || width === 1280) return;
     await evaluate('document.fonts.ready.then(()=>true)');
     const image = await cdp('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
     await writeFile(join(process.env.SECTIONS_CAPTURE, 'schach-treff-' + name + '-' + width + '.png'), Buffer.from(image.data,'base64'));
   };
   const clickText = async (scope, label) => {
     await wait(`[...document.querySelectorAll(${JSON.stringify(scope)})].some(el=>el.textContent===${JSON.stringify(label)})`);
     await evaluate(`[...document.querySelectorAll(${JSON.stringify(scope)})].find(el=>el.textContent===${JSON.stringify(label)}).click()`);
   };
   const fits = async (selector, width) => {
     const layout = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,client:el.clientWidth,scroll:el.scrollWidth,page:document.documentElement.scrollWidth}})()`);
     assert.ok(layout.width > 0 && layout.left >= -1 && layout.right <= width + 1
       && layout.scroll <= layout.client + 1 && layout.page <= width + 1, JSON.stringify(layout));
   };
   for (const width of [1280, 1920, 375]) {
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===375?844:1080,deviceScaleFactor:1,mobile:width===375});
     await cdp('Page.navigate',{url});
     await wait("document.querySelector('.st-room-list .st-unread-badge') && document.querySelector('.st-chat-header .st-pin-menu button')");
     await evaluate("window.fixtureKeepBadges=true");
     await wait(`document.documentElement.hasAttribute('data-schach-treff-unread') && [...document.querySelectorAll('.site-nav-link[href="/chat"] > div:first-child')].some(el => el.offsetWidth > 0 && getComputedStyle(el,'::after').backgroundColor === 'rgb(241, 187, 107)')`);
     await wait("document.querySelector('.st-unread-badge[aria-label=\"Непрочитанные сообщения 4\"]')");
     if(width===375) await evaluate("document.querySelector('.st-mobile-directory>summary').click()");
     await fits('.st-room-list a',width);
     if(width===375) assert.ok(await evaluate("document.querySelector('.st-unread-badge').getBoundingClientRect().height<=24"));
     await capture('badges',width);
     if(width===375) await evaluate("document.querySelector('.st-mobile-directory>summary').click()");
     await wait("window.fixtureMarked?.p_club_id === '" + room + "'");
     await evaluate("document.querySelector('.st-pin-menu button').click()");
     await fits('.st-pin-actions',width);
     await clickText('.st-pin-actions button','Жалобы');
     await wait("document.querySelector('dialog.st-moderation-dialog[open] li')?.textContent.includes('Скрыто от участников')");
     await fits('dialog.st-moderation-dialog[open]',width);
     await capture('reports',width);
     await clickText('dialog[open] button','Восстановить сообщение');
     await wait("window.fixtureRestore && document.querySelector('dialog[open]').textContent.includes('Нет открытых жалоб.')");
     await clickText('dialog[open] button','Закрыть');

     await evaluate("Array.from(document.querySelectorAll('.st-message:not(.st-message-own) summary')).at(-1).click()");
     await clickText('.st-message-actions[open] button','Пожаловаться на сообщение');
     await wait("document.querySelector('dialog.st-moderation-dialog[open] select')");
     await fits('dialog.st-moderation-dialog[open]',width);
     await capture('report',width);
     await evaluate("const input = document.querySelector('dialog[open] select'); input.value='abuse';input.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('dialog[open] button[type=submit]').click()");
     await wait("window.fixtureReport?.p_reason==='abuse' && !document.querySelector('dialog[open]')");

     await evaluate("Array.from(document.querySelectorAll('.st-message-own summary')).at(-1).click()");
     await clickText('.st-message-actions[open] button','Удалить сообщение');
     await wait("document.querySelector('dialog.st-moderation-dialog[open]')");
     await fits('dialog.st-moderation-dialog[open]',width);
     await capture('delete',width);
     await clickText('dialog[open] button','Удалить сообщение');
     await wait("window.fixtureDelete?.p_message_id && document.querySelector('.st-moderation-status')?.textContent==='Сообщение удалено'");

     await evaluate("document.querySelector('.st-pin-menu button').click()");
     await clickText('.st-pin-actions button','Очистить чат');
     await wait("document.querySelector('dialog.st-moderation-dialog[open]')");
     await fits('dialog.st-moderation-dialog[open]',width);
     await capture('clear',width);
     await clickText('dialog[open] button','Очистить чат');
     await wait("window.fixtureDelete?.p_club_id === '" + room + "' && !document.querySelector('dialog[open]')");
     await evaluate(`sessionStorage.setItem('schach-treff-invite:${room}','stale');sessionStorage.setItem('schach-treff-invite:other','retain');document.querySelector('.st-pin-menu button').click()`);
     await clickText('.st-pin-actions button','Отозвать все ссылки-приглашения');
     await clickText('dialog[open] button','Отозвать все ссылки-приглашения');
     await wait("window.fixtureRevoked && !document.querySelector('dialog[open]')");
     assert.equal(await evaluate(`sessionStorage.getItem('schach-treff-invite:${room}')`),null);
     assert.equal(await evaluate("sessionStorage.getItem('schach-treff-invite:other')"),'retain');
   }
   for (const [params, allowed] of [['?role=admin',true],['?club='+room+'&role=member',false],['?club='+room+'&role=moderator',true]]) {
     await cdp('Page.navigate',{url:root+'chat'+params});
     await wait("document.querySelector('.st-composer')");
     assert.equal(await evaluate("Boolean(document.querySelector('.st-pin-menu button'))"),allowed);
     if (allowed) {
       await evaluate("document.querySelector('.st-pin-menu button').click()");
       assert.ok(await evaluate("document.querySelector('.st-pin-actions').textContent.includes('Жалобы')"));
       assert.ok(await evaluate("!document.querySelector('.st-pin-actions').textContent.includes('Очистить чат')"));
       assert.ok(await evaluate("!document.querySelector('.st-pin-actions').textContent.includes('Отозвать все ссылки-приглашения')"));
     }
   }
   return;
 }
 for(const width of [1280,1920,375]){const height=width===375?844:1080;await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===375});await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'room-fixture'});await wait("document.querySelector('.st-room-list>a') && document.querySelector('.st-create-room') && document.querySelector('.st-composer')");await evaluate('document.fonts.ready.then(()=>true)');if(width===375){assert.equal(await evaluate("document.querySelector('.st-mobile-directory').open"),false);await evaluate("document.querySelector('.st-mobile-directory>summary').click()")}const x=await evaluate(`(()=>{const mobile=innerWidth<1024;const panel=document.querySelector(mobile?'.st-mobile-rooms':'.st-rooms');const general=panel.querySelector(mobile?'.st-mobile-general':'.st-general-link');const chat=document.querySelector('.st-chat');const heading=panel.querySelector('.st-club-heading');const button=panel.querySelector('.st-create-room');const club=panel.querySelector('.st-room-list>a');const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,scroll:e.scrollWidth,client:e.clientWidth}};return{width:document.documentElement.scrollWidth,panel:rect(panel),general:rect(general),chat:chat?rect(chat):null,club:rect(club),button:rect(button),sizes:[general,heading,button,club].map(e=>getComputedStyle(e).fontSize),weights:[general,heading,button,club].map(e=>getComputedStyle(e).fontWeight),current:general.getAttribute('aria-current'),visible:document.body.innerText}})()`);assert.ok(x.width<=width+1,JSON.stringify(x));assert.deepEqual(x.sizes,['17px','16px','16px','15px']);assert.deepEqual(x.weights,['600','600','600','400']);assert.equal(x.current,'page');assert.ok(await evaluate("!document.querySelector('.st-message-actions,.st-unread-badge,.st-moderation-dialog')"));assert.ok(x.general.left>=x.panel.left&&x.general.right<=x.panel.right,JSON.stringify(x));assert.ok(x.button.right<=x.panel.right&&x.club.right<=x.panel.right,JSON.stringify(x));if(width!==375){assert.ok(x.panel.right<=x.chat.left,JSON.stringify(x));assert.ok(await evaluate("!document.querySelector('.st-right') && Math.abs(document.querySelector('.schach-treff').getBoundingClientRect().right - document.querySelector('.st-chat').getBoundingClientRect().right - 24) <= 1"));assert.ok(!x.visible.includes('ChessAZ Deutsch'),'general chat should not show the old room title');const form=await evaluate(`(()=>{const f=document.querySelector('.st-composer');const button=f.querySelector('button');return {whiteSpace:getComputedStyle(button).whiteSpace,input:f.querySelector('input').getBoundingClientRect().width,scroll:f.scrollWidth,client:f.clientWidth}})()`);assert.equal(form.whiteSpace,'nowrap');assert.ok(form.input>0&&form.scroll<=form.client+1,JSON.stringify(form));}if(process.env.SECTIONS_CAPTURE && width===1920){let image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(process.env.SECTIONS_CAPTURE,'schach-treff-desktop-general-1920.png'),Buffer.from(image.data,'base64'))}for(const lang of ['de','en','az','tr','ua','ru']){await evaluate(`window.setFixtureLanguage('${lang}')`);await wait(`document.documentElement.lang==='${lang==='ua'?'uk':lang}'`);const t=await evaluate(`(()=>{const p=document.querySelector(innerWidth<1024?'.st-mobile-rooms':'.st-rooms'),b=p.querySelector('.st-create-room'),h=p.querySelector('.st-club-heading'),g=p.querySelector(innerWidth<1024?'.st-mobile-general':'.st-general-link');let range=document.createRange();range.selectNodeContents(b);return {width:document.documentElement.scrollWidth,panel:p.getBoundingClientRect().right,button:b.getBoundingClientRect().right,scroll:b.scrollWidth,client:b.clientWidth,rects:[...range.getClientRects()].map(r=>({top:r.top,left:r.left,right:r.right})),text:b.textContent,lines:range.getClientRects().length,sizes:[g,h,b].map(e=>getComputedStyle(e).fontSize)}})()`);assert.ok(t.width<=width+1&&t.button<=t.panel,lang+' '+JSON.stringify(t));assert.deepEqual(t.sizes,['17px','16px','16px']);if(width>=1280&&['de','ru'].includes(lang)){assert.equal(t.lines,1,lang+' button wraps '+JSON.stringify(t));assert.ok(t.scroll<=t.client,lang+' button overflows '+JSON.stringify(t))}}}
 const roomFixture=server.resolvedUrls.local[0]+'room-fixture?club=22222222-2222-4222-8222-222222222222';
 for (const width of [1280,1920,375]) {
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===375?844:1080,deviceScaleFactor:1,mobile:width===375});
   await cdp('Page.navigate',{url:roomFixture});
   await wait("document.querySelector('.st-chat-header h2')?.textContent === 'Schachverein' && document.querySelector('.st-challenge-icon')");
   assert.equal(await evaluate("document.querySelectorAll('article.st-message').length"), 28);
   assert.equal(await evaluate(`(()=>{
     const groups=[...document.querySelectorAll('.st-message-group')];
     const one=groups.find(g=>g.querySelectorAll('.st-message').length>=3);
     if(!one) return false;
     const items=[...one.querySelectorAll('.st-message')].map(e=>e.getBoundingClientRect());
     const gaps=items.slice(1).map((rect,i)=>rect.top-items[i].bottom);
     const own=document.querySelector('.st-message-group-own');
     const ownBackground=getComputedStyle(own).backgroundColor;
     const childBackground=getComputedStyle(own.querySelector('article')).backgroundColor;
     const between=groups[1].getBoundingClientRect().top-groups[0].getBoundingClientRect().bottom;
     return gaps.length>=2 && gaps.every(n=>Math.abs(n-6)<1) && Math.abs(between-14)<1
       && ownBackground !== 'rgba(0, 0, 0, 0)' && childBackground === 'rgba(0, 0, 0, 0)';
   })()`),true,'group spacing / unified background geometry');
   if(width===375) assert.equal(await evaluate(`(()=>{
     const h=document.querySelector('.st-chat-header'),back=h.querySelector('.st-back-general'),
       pin=h.querySelector('.st-pin-menu'),room=h.querySelector('h2'),invite=h.querySelector('.st-invite-trigger'),
       f=document.querySelector('.st-composer'),input=f.querySelector('input'),challenge=f.querySelector('.st-composer-challenge');
     const r=e=>e.getBoundingClientRect();
     return room.textContent.trim()==='Schachverein' && room.scrollWidth<=room.clientWidth+1
       && Math.abs(r(back).top-r(pin).top)<1 && Math.abs((r(room).top+r(room).bottom-r(invite).top-r(invite).bottom)/2)<1
       && parseFloat(getComputedStyle(room).fontSize)===18
       && r(input).width/r(f).width>=0.55 && r(challenge).width===44
       && Boolean(challenge.querySelector('svg'))
       && challenge.getAttribute('aria-label')===challenge.textContent.trim()
       && document.documentElement.scrollWidth<=innerWidth+1;
   })()`),true,'mobile header and composer layout');
   assert.ok(await evaluate("document.querySelectorAll('article.st-message .st-challenge-icon').length >= 10"));
   assert.equal(await evaluate("document.querySelectorAll('article.st-message-own .st-challenge-icon, article.st-message .st-composer-challenge').length"), 0);
   assert.ok(await evaluate("Array.from(document.querySelectorAll('.st-challenge-icon')).every(b=>b.parentElement.classList.contains('st-message-heading') && b.getAttribute('aria-label') && b.querySelector('svg') && b.offsetWidth===32)"));
   assert.equal(await evaluate("document.querySelector('.st-composer .st-send').disabled"), true);
   assert.ok(await evaluate("document.querySelector('.st-messages').scrollTop > 0"));
   assert.equal(await evaluate("getComputedStyle(document.querySelector('.st-challenge-icon')).opacity"), width===375?'1':'0');
   await evaluate("Array.from(document.querySelectorAll('.st-challenge-icon')).at(-1).focus({preventScroll:true})");
   await wait("document.hasFocus() && document.activeElement.matches('.st-challenge-icon:focus') && getComputedStyle(document.activeElement).opacity === '1'");
   assert.equal(await evaluate("document.querySelector('.st-invite-dialog,.st-invite-fields')"), null);
   assert.equal(await evaluate("window.fixtureInvites || 0"), 0);
   await evaluate("window.sessionStorage.removeItem('schach-treff-invite:22222222-2222-4222-8222-222222222222')");
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[21].querySelector('.st-message-heading') !== null"), true);
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[22].querySelector('.st-message-heading')"), null);
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[23].querySelector('.st-message-heading')"), null);
   assert.ok(await evaluate("document.querySelectorAll('.st-messages article.st-message')[22].getAttribute('title')"));
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[24].querySelector('.st-message-heading') !== null"), true);
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[25].querySelector('.st-message-heading') !== null"), true);
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[26].querySelector('.st-challenge-card') !== null"), true);
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[26].querySelector('.st-message-heading') !== null"), true);
   assert.equal(await evaluate("document.querySelectorAll('.st-messages article.st-message')[27].querySelector('.st-message-heading') !== null"), true);
   await evaluate("document.querySelectorAll('.st-messages article.st-message')[21].querySelector('.st-name').click()");
   await wait("document.querySelector('.st-close')?.closest('dialog')?.open === true");
   assert.ok(await evaluate("document.querySelector('.st-close').closest('dialog').textContent.includes('Maksim')"));
   assert.ok(await evaluate("Array.from(document.querySelector('.st-close').closest('dialog').querySelectorAll('button')).some(button=>button.textContent.trim() && !button.classList.contains('st-close'))"));
   await evaluate("document.querySelector('.st-close').click()");
   const collapsed = await evaluate("document.querySelector('.st-pin-text').getBoundingClientRect().height");
   assert.ok(collapsed < 24);
   await evaluate("document.querySelector('.st-pin').click()");
   assert.ok(await evaluate("document.querySelector('.st-pin-text').getBoundingClientRect().height") > collapsed);
   assert.equal(await evaluate("getComputedStyle(document.querySelector('.st-pin-text')).webkitLineClamp"), '4');
   await evaluate("document.querySelector('.st-pin').click()");
   await evaluate("document.querySelector('.st-pin-menu > button').click()");
   assert.equal(await evaluate("document.querySelectorAll('.st-pin-actions button').length"),1);
   await evaluate("document.querySelector('.st-pin-menu > button').click()");
   await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(value){window.copiedInvite=value;window.copyCalls=(window.copyCalls||0)+1;}}});`);
   if(process.env.SECTIONS_CAPTURE && width!==1280) {
     await evaluate("document.querySelector('.st-chat-header').scrollIntoView()");
     const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
     await writeFile(join(process.env.SECTIONS_CAPTURE,width===375?'schach-treff-mobile-header-before-375.png':'schach-treff-desktop-header-before-1920.png'),Buffer.from(image.data,'base64'));
   }
   await evaluate("document.querySelector('.st-invite-trigger').click()");
   await wait("document.querySelector('.st-invite-trigger').textContent.includes('✓')");
   if(width===375) assert.ok(await evaluate(`(()=>{
     const h=document.querySelector('.st-chat-header'),back=h.querySelector('.st-back-general'),
      pin=h.querySelector('.st-pin-menu'),invite=h.querySelector('.st-invite-trigger'),
      room=h.querySelector('h2'),r=e=>e.getBoundingClientRect();
     return Math.abs(r(back).top-r(pin).top)<1 && Math.abs((r(room).top+r(room).bottom-r(invite).top-r(invite).bottom)/2)<1
      && invite.offsetWidth===44 && getComputedStyle(invite.querySelector('.st-invite-label')).position==='absolute'
      && invite.querySelector('svg.lucide-check') && document.documentElement.scrollWidth<=innerWidth+1;
   })()`),true,'mobile copied state / menu row');
   assert.equal(await evaluate("window.fixtureInvites"), 1);
   assert.equal(await evaluate("window.copyCalls"), 1);
   assert.equal(await evaluate("document.querySelector('.st-invite-popover,.st-invite-dialog,.st-invite-fields')"),null);
   assert.ok(await evaluate("window.copiedInvite.endsWith('/schach-treff/einladung/'+'a'.repeat(32))"));
   if(process.env.SECTIONS_CAPTURE && width!==1280) {
     const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
     await writeFile(join(process.env.SECTIONS_CAPTURE,width===375?'schach-treff-mobile-header-copied-375.png':'schach-treff-desktop-header-copied-1920.png'),Buffer.from(image.data,'base64'));
   }
   await evaluate("document.querySelector('.st-invite-trigger').click()");
   await wait("window.copyCalls === 2");
   assert.equal(await evaluate("window.fixtureInvites"),1);
   await wait("!document.querySelector('.st-invite-trigger').textContent.includes('✓')");
   assert.equal(await evaluate("document.querySelector('.st-invite-trigger').textContent.trim()"),'Ссылка-приглашение');
   await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(){throw Error('denied')}}});
     document.querySelector('.st-invite-trigger').click();`);
   await wait("document.querySelector('.st-invite-popover input[readonly]')");
   assert.equal(await evaluate("document.querySelector('.st-invite-popover input').value"),await evaluate("window.copiedInvite"));
   await evaluate("document.querySelector('.st-invite-popover button').click()");
   assert.equal(await evaluate("document.querySelector('.st-invite-popover')"),null);
   assert.equal(await evaluate("window.fixtureInvites"),1);
   if(width===1280) {
     await evaluate("window.sessionStorage.removeItem('schach-treff-invite:22222222-2222-4222-8222-222222222222')");
     await cdp('Page.navigate',{url:roomFixture});
     await wait("document.querySelector('.st-invite-trigger')");
     await evaluate("window.fixtureInviteLimit=true;document.querySelector('.st-invite-trigger').click()");
     await wait("document.querySelector('.st-invite-note')");
     assert.ok(await evaluate("document.querySelector('.st-invite-note').textContent.includes('10 действующих ссылок')"));
     assert.equal(await evaluate("document.querySelector('.st-invite-dialog,.st-invite-popover')"),null);
     await wait("!document.querySelector('.st-invite-note')");
   }
   for(const lang of ['de','en','az','tr','ua','ru']) {
     await evaluate(`window.setFixtureLanguage('${lang}')`);
     await wait(`document.documentElement.lang==='${lang==='ua'?'uk':lang}'`);
     assert.ok(await evaluate(`(()=>{
       const form=document.querySelector('.st-composer'), header=document.querySelector('.st-chat-header');
       const [challenge,send]=form.querySelectorAll('button');
       const input=form.querySelector('input'), style=getComputedStyle(input);
       const canvas=document.createElement('canvas').getContext('2d');
       canvas.font=style.font;
       const placeholderFits=innerWidth>=1024 || canvas.measureText(input.placeholder).width<=input.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)+1;
       return document.documentElement.scrollWidth<=innerWidth+1 && header.scrollWidth<=header.clientWidth+1 &&
         form.scrollWidth<=form.clientWidth+1 && form.querySelector('input').offsetWidth>35 &&
         placeholderFits && [challenge,send].every(b=>getComputedStyle(b).whiteSpace==='nowrap') &&
         challenge.offsetTop===send.offsetTop;
     })()`), 'header and composer fit at '+width+' in '+lang);
   }
   if(process.env.SECTIONS_CAPTURE && width!==1280) {
     await evaluate("document.activeElement?.blur(); document.querySelector('.st-messages').scrollTop = document.querySelector('.st-messages').scrollHeight");
     if(width===375) await evaluate("document.querySelector('.st-chat').scrollIntoView({block:'end'})");
     else await wait("Array.from(document.querySelectorAll('.st-challenge-icon')).every(button=>getComputedStyle(button).opacity==='0')");
     if(width===1920) await evaluate("document.querySelectorAll('.st-messages article.st-message')[21].scrollIntoView({block:'center'})");
     const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
     await writeFile(join(process.env.SECTIONS_CAPTURE,width===375?'schach-treff-mobile-club-375.png':'schach-treff-desktop-club-1920.png'),Buffer.from(image.data,'base64'));
     if(width===375) {
       await evaluate("document.querySelector('.st-composer').scrollIntoView({block:'center'})");
       const composer=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
       await writeFile(join(process.env.SECTIONS_CAPTURE,'schach-treff-mobile-composer-375.png'),Buffer.from(composer.data,'base64'));
     }
   }
   if(width===375 || width===1920) {
     await cdp('Page.navigate',{url:roomFixture+'&duplicate=1'});
     await wait("document.querySelectorAll('.st-room-list>a').length===2 && document.querySelector('.st-chat-header h2')?.textContent.includes('#222222')");
     assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.st-room-list>a')).map(a=>a.textContent)"),
       ['Schachverein · #222222','Schachverein · #333333']);
     assert.equal(await evaluate("document.querySelector('.st-chat-header h2')?.textContent"),'Schachverein · #222222');
     assert.equal(await evaluate("document.querySelector('.st-room-list>a').getAttribute('href')"),'/chat?club=22222222-2222-4222-8222-222222222222');
     assert.equal(await evaluate("document.querySelectorAll('.st-room-list>a')[1].getAttribute('href')"),'/chat?club=33333333-3333-4333-8333-333333333333');
     assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'duplicate room names must not overflow at '+width);
   }
   if(width===1280) {
     const isAtBottom = "(() => {const e=document.querySelector('.st-messages');return e.scrollHeight-e.clientHeight-e.scrollTop<=2;})()";
     const setFeedPosition = (position) => evaluate(`new Promise(resolve=>{
       const feed=document.querySelector('.st-messages');
       feed.scrollTop=${position};feed.dispatchEvent(new Event('scroll'));
       requestAnimationFrame(()=>resolve());
     })`);
     const sendMessage = async (body) => {
       await evaluate(`(()=>{
         const form=document.querySelector('.st-composer'), input=form.querySelector('input');
         Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(body)});
         input.dispatchEvent(new Event('input',{bubbles:true}));
       })()`);
       await wait("!document.querySelector('.st-send').disabled");
       await evaluate("document.querySelector('.st-composer').requestSubmit()");
       await wait(`Array.from(document.querySelectorAll('.st-messages article.st-message')).at(-1)?.querySelector('p')?.textContent === ${JSON.stringify(body)}`);
     };
     await setFeedPosition("feed.scrollHeight");
     await sendMessage('followed message');
     assert.equal(await evaluate(isAtBottom),true);
     await setFeedPosition("0");
     await sendMessage('unfollowed message');
     assert.equal(await evaluate("document.querySelector('.st-messages').scrollTop"),0);
     for(const role of ['moderator','member']) {
       await cdp('Page.navigate',{url:roomFixture+'&role='+role});
       await wait("document.querySelector('.st-chat-header h2')?.textContent === 'Schachverein'");
       assert.equal(await evaluate("Boolean(document.querySelector('.st-pin-menu, .st-invite-trigger'))"), role==='moderator');
     }
   }
 }

  // Validate invite route on both desktop and 375 px with an isolated fake RPC.
  const inviteToken='a'.repeat(32),root=server.resolvedUrls.local[0],roomId='22222222-2222-4222-8222-222222222222';
  for(const width of [1920,375]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===375?844:1080,deviceScaleFactor:1,mobile:width===375});
    const reset=async()=>{
      await cdp('Page.navigate',{url:root+'room-fixture'});
      await wait("document.querySelector('.st-composer')");
      await evaluate("sessionStorage.removeItem('fixtureJoinCalls');sessionStorage.removeItem('fixtureInviteToken');sessionStorage.removeItem('fixtureJoinedRoom')");
    };
    await reset();
    await cdp('Page.navigate',{url:root+'schach-treff/einladung/'+inviteToken});
    await wait("location.pathname==='/chat' && new URLSearchParams(location.search).get('club')==='22222222-2222-4222-8222-222222222222' && document.querySelector('.st-chat-header h2')?.textContent==='Schachverein'");
    assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinCalls')"),'1','join called once at '+width);
    assert.equal(await evaluate("sessionStorage.getItem('fixtureInviteToken')"),inviteToken);
    assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinedRoom')"),roomId);
    assert.ok(await evaluate("document.querySelector('.st-composer input') && document.documentElement.scrollWidth<=innerWidth+1"),'invited room opened at '+width);

    await reset();
    await cdp('Page.navigate',{url:root+'schach-treff/einladung/'+inviteToken+'?scenario=slow'});
    await wait("location.pathname.startsWith('/schach-treff/einladung/') && sessionStorage.getItem('fixtureJoinCalls')==='1'");
    assert.equal(await evaluate("Boolean(document.querySelector('h1')) || document.querySelector('[role=status]')?.getBoundingClientRect().width>2"),false,'invite waiting screen must not flash visible text at '+width);
    await wait("location.pathname==='/chat' && new URLSearchParams(location.search).get('club')==='22222222-2222-4222-8222-222222222222' && document.querySelector('.st-chat-header h2')?.textContent==='Schachverein'");
    assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinCalls')"),'1','delayed join still calls RPC once');

    await reset();
    await cdp('Page.navigate',{url:root+'schach-treff/einladung/invalid-token'});
    await wait("document.querySelector('[role=alert]')?.textContent==='Недействительная ссылка-приглашение.'");
    assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinCalls')"),null);
    await evaluate("window.setFixtureLanguage('en')");
    await wait("document.querySelector('[role=alert]')?.textContent==='Invalid invitation link.'");

    await reset();
    await cdp('Page.navigate',{url:root+'schach-treff/einladung/'+inviteToken+'?scenario=expired'});
    await wait("document.querySelector('[role=alert]')?.textContent==='Срок действия приглашения истёк.'");
    assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinCalls')"),'1');
    await evaluate("window.setFixtureLanguage('de')");
    await wait("document.querySelector('[role=alert]')?.textContent==='Dieser Einladungslink ist abgelaufen.'");

    for(const scenario of ['unexpected','badroom','rejected']){
      await reset();
      await cdp('Page.navigate',{url:root+'schach-treff/einladung/'+inviteToken+'?scenario='+scenario});
      await wait("document.querySelector('[role=alert]')?.textContent==='Не удалось загрузить или сохранить данные. Повторите попытку.'");
      assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinCalls')"),'1',scenario);
      assert.ok(await evaluate("location.pathname.startsWith('/schach-treff/einladung/')"));
    }
    await reset();
    await cdp('Page.navigate',{url:root+'schach-treff/einladung/'+inviteToken+'?guest=1'});
    await wait("Boolean(document.querySelector('a[href]'))");
    assert.equal(await evaluate("sessionStorage.getItem('fixtureJoinCalls')"),null);
    assert.equal(await evaluate("new URL(document.querySelector('a[href]').href).searchParams.get('returnTo')"),'/schach-treff/einladung/'+inviteToken);
    await evaluate("window.setFixtureLanguage('en')");
    await wait("document.querySelector('a[href]')?.textContent==='Sign in'");
  }

 }finally{try{ws?.close()}catch{}chrome?.kill('SIGKILL');for(const p of pending.values())clearTimeout(p.timer);await server.close();if(profile)await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
}
