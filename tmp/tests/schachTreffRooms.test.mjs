import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
test('general room link marks only the current general chat', async () => {
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try { const {default:Link}=await server.ssrLoadModule('/src/components/schachTreff/GeneralRoomLink.tsx');
  for(const search of ['', '?club=11111111-1111-4111-8111-111111111111']) {
   const html=renderToStaticMarkup(createElement(Link,{label:'Общий чат',search,className:'room'}));
   assert.match(html,/href="\/chat"/); assert.equal(html.includes('aria-current="page"'),search==='');
  }
 } finally { await server.close(); }
});
test('logged-out visitors do not receive the club rooms heading', async () => {
 const plugin={name:'guest-auth-fixture',enforce:'pre',resolveId(id){if(/context\/AuthContext(?:\.tsx)?$/.test(id))return '\0guest-auth';},load(id){if(id==='\0guest-auth')return 'export function useAuth(){return {user:null}}';}};
 const server=await createServer({plugins:[plugin],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try {const {default:Rooms}=await server.ssrLoadModule('/src/components/schachTreff/ClubRooms.tsx');assert.equal(renderToStaticMarkup(createElement(Rooms,{currentClubId:null})), '');} finally {await server.close();}
});
test('mobile club view mounts the desktop chat without a second room list', () => {
 const mobile=readFileSync(new URL('../src/screens/ChessAZCommunityScreen.tsx',import.meta.url),'utf8');
 const desktop=readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx',import.meta.url),'utf8');
 assert.match(mobile,/<SchachTreffDesktop hideRooms\s*\/>/);assert.match(desktop,/\{!hideRooms && <aside className="st-surface st-rooms">/);assert.match(mobile,/<ClubRooms currentClubId=\{club\}/);
});

test('rooms with duplicate names show stable distinct public identifiers without changing URLs', async () => {
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try {
  const {roomDisplayLabel}=await server.ssrLoadModule('/src/components/schachTreff/roomIdentity.ts');
  const first={id:'22222222-2222-4222-8222-222222222222',name:'baku'};
  const second={id:'33333333-3333-4333-8333-333333333333',name:'Baku'};
  const only={id:'44444444-4444-4444-8444-444444444444',name:'Hamburg'};
  assert.equal(roomDisplayLabel(only,[first,second,only]),'Hamburg');
  assert.equal(roomDisplayLabel(first,[first,second]),'baku · #222222');
  assert.equal(roomDisplayLabel(second,[first,second]),'Baku · #333333');
  const near={id:'222222FF-2222-4222-8222-222222222222',name:'baku'};
  assert.equal(roomDisplayLabel(first,[first,near]),'baku · #22222222');
  assert.equal(roomDisplayLabel(near,[first,near]),'baku · #222222FF');
  assert.equal(roomDisplayLabel(first,[second,first]),'baku · #222222');
 } finally {await server.close();}
});
