import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';

const fixture=`import '/src/index.css';import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,BrowserRouter,Routes,Route}from'react-router-dom';import{LanguageProvider,useLanguage}from'/src/context/LanguageContext.tsx';import Chat from'/src/screens/ChessAZCommunityScreen.tsx';import Invite from'/src/screens/ClubInviteScreen.tsx';localStorage.setItem('app-language','ru');function Probe(){const {setLanguage}=useLanguage();window.setFixtureLanguage=setLanguage;return null}createRoot(document.getElementById('root')).render(<LanguageProvider>{location.pathname==='/room-fixture'?<MemoryRouter><Probe/><Chat/></MemoryRouter>:<BrowserRouter><Probe/><Routes><Route path='/schach-treff/einladung/:token' element={<Invite/>}/><Route path='/chat' element={<Chat/>}/></Routes></BrowserRouter>}</LanguageProvider>);`;
const db=`const uid='11111111-1111-4111-8111-111111111111', room='22222222-2222-4222-8222-222222222222', guest='33333333-3333-4333-8333-333333333333';
const feed = Array.from({length:28}, (_, index) => ({
  id:'message-'+index, author_id:index===20 ? uid : index>=21 && index<=24 || index>=26 ? guest : index%2 ? uid : guest,
  body:['Добро пожаловать в Schach-Treff!','Кто хочет сыграть тренировочную партию?','Я буду онлайн после восьми.','Отлично, давайте обсудим дебют после партии.'][index%4],
  created_at:new Date(Date.UTC(2026,10,4,12,0,0)+(index+(index>=24?6:0))*60000).toISOString()
}));
export const supabase = {
  rpc(name, payload) {
    if(name==='club_player_summary') return {abortSignal(){return Promise.resolve({data:{completed_games:0,last_games:[]},error:null})}};
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
    const q={select(v){columns=v;return q},eq(k,v){filters.set(k,v);return q},in(){return q},gte(){return q},order(){return q},limit(){return q},
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
            ? [{id:room,name:'Schachverein'},...(new URLSearchParams(location.search).has('duplicate') ? [{id:guest,name:'Schachverein'}] : [])]
            : [{id:uid,name:'ChessAZ Deutsch'}];
          if(columns==='pinned_body,pinned_by' && filters.get('id')===room) rows=[{pinned_by:guest,pinned_body:('В пятницу тренировка по эндшпилю. Присоединяйтесь к разбору партий. ').repeat(6)}];
        } else if(table==='chess_club_members') {
          const params=new URLSearchParams(location.search);
          rows=[{user_id:uid,role:params.get('role') || (params.has('club')?'admin':'member')},{user_id:guest,role:'member'}];
        } else if(table==='profiles') {
          rows=[{id:uid,username:'Sofia'},{id:guest,username:'Maksim'}];
        } else if(table==='chess_club_messages') rows=feed.slice().reverse();
        else if(table==='chess_club_challenges') rows=[{
          id:'challenge-26',message_id:'message-26',created_by:guest,target_user_id:uid,
          time_control:'3+2',status:'open',expires_at:'2099-12-31T23:59:59Z',room_id:null
        }];
        return Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(resolve,reject);
      }
    };return q;
  }
};`;
const plugin={name:'schach-treff-fixture',enforce:'pre',resolveId(id){if(id==='/__room_fixture.tsx')return id;if(/context\/AuthContext(?:\.tsx)?$/.test(id))return '\0room-auth';if(/context\/SocketContext(?:\.tsx)?$/.test(id))return '\0room-socket';if(/services\/supabase(?:\.ts)?$/.test(id))return '\0room-db';},load(id){if(id==='/__room_fixture.tsx')return fixture;if(id==='\0room-auth')return `const user={id:'11111111-1111-4111-8111-111111111111'};export function useAuth(){return {user:new URLSearchParams(location.search).has('guest')?null:user,isLoading:false}}`;if(id==='\0room-socket')return `const socket={on(){},off(){},emit(){},timeout(){return {emit(_event,_payload,cb){cb?.(null,{ok:true})}}}};export function useSocket(){return {socket,isConnected:true}}`;if(id==='\0room-db')return db},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!/^\/(?:room-fixture(?:\?|$)|schach-treff\/einladung\/|chat(?:\?|$))/.test(req.url))return next();res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/room-fixture','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/__room_fixture.tsx"></script></body></html>'));});}};
export async function checkRoomLayout(){
 const server=await createServer({configFile:false,cacheDir:join(tmpdir(),'room-vite-'+process.pid),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react-router-dom','lucide-react']},plugins:[plugin,react()],server:{host:'127.0.0.1',port:0,hmr:false,fs:{strict:false}}});let chrome,ws,profile;const pending=new Map();
 try{await server.listen();const bin=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(bin,'Chromium required for Schach-Treff layout');profile=await mkdtemp(join(tmpdir(),'schach-rooms-'));chrome=spawn(bin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';chrome.stderr.on('data',c=>stderr=(stderr+c).slice(-4000));const pause=ms=>new Promise(r=>setTimeout(r,ms));let port;for(let i=0;i<300;i++){if(chrome.exitCode!==null)throw Error(stderr);try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break}catch{}await pause(50)}assert.ok(port,stderr);const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});let seq=0;ws.addEventListener('message',({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});const evaluate=async expression=>{let x=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value};const wait=async expression=>{for(let i=0;i<240;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(50)}throw Error('Fixture did not load '+expression)};await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.bringToFront');await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});if(process.env.SECTIONS_CAPTURE)await mkdir(process.env.SECTIONS_CAPTURE,{recursive:true});
 for(const width of [1280,1920,375]){const height=width===375?844:1080;await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===375});await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'room-fixture'});await wait("document.querySelector('.st-room-list>a') && document.querySelector('.st-create-room') && document.querySelector('.st-composer')");await evaluate('document.fonts.ready');const x=await evaluate(`(()=>{const mobile=innerWidth<1024;const panel=document.querySelector(mobile?'.st-mobile-rooms':'.st-rooms');const general=panel.querySelector(mobile?'.st-mobile-general':'.st-general-link');const chat=document.querySelector('.st-chat');const heading=panel.querySelector('.st-club-heading');const button=panel.querySelector('.st-create-room');const club=panel.querySelector('.st-room-list>a');const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,scroll:e.scrollWidth,client:e.clientWidth}};return{width:document.documentElement.scrollWidth,panel:rect(panel),general:rect(general),chat:chat?rect(chat):null,club:rect(club),button:rect(button),sizes:[general,heading,button,club].map(e=>getComputedStyle(e).fontSize),weights:[general,heading,button,club].map(e=>getComputedStyle(e).fontWeight),current:general.getAttribute('aria-current'),visible:document.body.innerText}})()`);assert.ok(x.width<=width+1,JSON.stringify(x));assert.deepEqual(x.sizes,['17px','16px','16px','15px']);assert.deepEqual(x.weights,['600','600','600','400']);assert.equal(x.current,'page');assert.ok(x.general.left>=x.panel.left&&x.general.right<=x.panel.right,JSON.stringify(x));assert.ok(x.button.right<=x.panel.right&&x.club.right<=x.panel.right,JSON.stringify(x));if(width!==375){assert.ok(x.panel.right<=x.chat.left,JSON.stringify(x));assert.ok(await evaluate("!document.querySelector('.st-right') && Math.abs(document.querySelector('.schach-treff').getBoundingClientRect().right - document.querySelector('.st-chat').getBoundingClientRect().right - 24) <= 1"));assert.ok(!x.visible.includes('ChessAZ Deutsch'),'general chat should not show the old room title');const form=await evaluate(`(()=>{const f=document.querySelector('.st-composer');const button=f.querySelector('button');return {whiteSpace:getComputedStyle(button).whiteSpace,input:f.querySelector('input').getBoundingClientRect().width,scroll:f.scrollWidth,client:f.clientWidth}})()`);assert.equal(form.whiteSpace,'nowrap');assert.ok(form.input>0&&form.scroll<=form.client+1,JSON.stringify(form));}if(process.env.SECTIONS_CAPTURE && width===1920){let image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(process.env.SECTIONS_CAPTURE,'schach-treff-desktop-general-1920.png'),Buffer.from(image.data,'base64'))}for(const lang of ['de','en','az','tr','ua','ru']){await evaluate(`window.setFixtureLanguage('${lang}')`);await wait(`document.documentElement.lang==='${lang==='ua'?'uk':lang}'`);const t=await evaluate(`(()=>{const p=document.querySelector(innerWidth<1024?'.st-mobile-rooms':'.st-rooms'),b=p.querySelector('.st-create-room'),h=p.querySelector('.st-club-heading'),g=p.querySelector(innerWidth<1024?'.st-mobile-general':'.st-general-link');let range=document.createRange();range.selectNodeContents(b);return {width:document.documentElement.scrollWidth,panel:p.getBoundingClientRect().right,button:b.getBoundingClientRect().right,scroll:b.scrollWidth,client:b.clientWidth,rects:[...range.getClientRects()].map(r=>({top:r.top,left:r.left,right:r.right})),text:b.textContent,lines:range.getClientRects().length,sizes:[g,h,b].map(e=>getComputedStyle(e).fontSize)}})()`);assert.ok(t.width<=width+1&&t.button<=t.panel,lang+' '+JSON.stringify(t));assert.deepEqual(t.sizes,['17px','16px','16px']);if(width>=1280&&['de','ru'].includes(lang)){assert.equal(t.lines,1,lang+' button wraps '+JSON.stringify(t));assert.ok(t.scroll<=t.client,lang+' button overflows '+JSON.stringify(t))}}}
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
