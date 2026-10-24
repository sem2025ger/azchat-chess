'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Chess } = require('chess.js');
const { createCache } = require('./src/games/cache');
const { createLichessClient } = require('./src/games/lichessClient');
const { createGamesRouter } = require('./src/games/routes');
const v = require('./src/games/validate');
const { masters } = require('./src/games/normalize');
const fen = new Chess().fen();
test('FEN, username, query and game id validation', () => {
  assert.equal(v.fen(fen), fen.split(' ').slice(0,4).join(' '));
  for (const bad of ['bad','',null]) assert.throws(()=>v.fen(bad),{code:'INVALID_FEN'});
  for (const bad of ['a','../user','a b',['Alice']]) assert.throws(()=>v.username(bad),{code:'INVALID_USERNAME'});
  assert.equal(v.username('Example_A'),'example_a');
  for(const bad of ['51','1.2','-1']) assert.throws(()=>v.integer(bad,30,50),{code:'INVALID_QUERY'});
  assert.throws(()=>v.gameId('../abcde'),{code:'INVALID_QUERY'});
});
test('Masters normalization maps documented fields and rejects invalid upstream',()=>{
  const data={white:2,draws:1,black:0,moves:[{uci:'e2e4',san:'e4',white:2,draws:1,black:0}],topGames:[{id:'aAbqI4ey',white:{name:'Example A',rating:2500},black:{name:'Example B',rating:2400},year:2025,winner:null}]};
  const value=masters(JSON.stringify(data),fen);
  assert.equal(value.moves[0].games,3); assert.equal(value.topGames[0].result,'1/2-1/2');assert.deepEqual(value.recentGames,[]);
  assert.throws(()=>masters('{}',fen),{code:'UPSTREAM_UNAVAILABLE'});
});
test('cache TTL, LRU eviction, single-flight and no error caching',async()=>{
  let time=0,calls=0;const cache=createCache({maxEntries:2,now:()=>time});const load=async()=>++calls;
  assert.deepEqual(await Promise.all(Array.from({length:12},()=>cache.get('a',10,load))),Array(12).fill(1));
  await cache.get('b',10,load);await cache.get('a',10,load);await cache.get('c',10,load);assert.equal(await cache.get('b',10,load),4);
  time=20;assert.equal(await cache.get('b',10,load),5);
  await assert.rejects(cache.get('x',10,async()=>{throw new Error('test');}));assert.equal(await cache.get('x',10,load),6);
});
test('Lichess queue serializes requests with ChessAZ User-Agent',async()=>{
  let active=0,peak=0;
  const client=createLichessClient({token:'test-only',fetchImpl:async(url,options)=>{
    assert.match(url,/^https:\/\/(explorer\.)?lichess\.org\//);assert.match(options.headers['User-Agent'],/ChessAZ/);
    active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return new Response('{}');
  }});
  await Promise.all(Array.from({length:10},()=>client.request('/masters',{explorer:true})));assert.equal(peak,1);
});
test('429 sets shared 60 second cooldown, then queue recovers',async()=>{
  let now=0,calls=0;const client=createLichessClient({now:()=>now,fetchImpl:async()=>new Response('{}',{status:++calls===1?429:200})});
  await assert.rejects(client.request('/one'),{code:'UPSTREAM_RATE_LIMITED',retryAfter:60});now=59000;
  await assert.rejects(client.request('/two'),{code:'UPSTREAM_RATE_LIMITED',retryAfter:1});assert.equal(calls,1);now=60000;
  assert.equal(await client.request('/three'),'{}');assert.equal(calls,2);
});
test('OAuth requirement, upstream auth and timeout errors',async()=>{
  const client=createLichessClient({fetchImpl:()=>{throw new Error('must not call');}});
  await assert.rejects(client.request('/masters',{explorer:true}),{code:'UPSTREAM_AUTH_REQUIRED'});
  await assert.rejects(createLichessClient({fetchImpl:async()=>new Response('',{status:401})}).request('/user'),{code:'UPSTREAM_AUTH_REQUIRED'});
  const slow=createLichessClient({timeoutMs:5,fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
  await assert.rejects(slow.request('/user'),{code:'UPSTREAM_UNAVAILABLE'});
});
async function withApi(options,fn){
  const app=express();app.use('/api/games',createGamesRouter(options));const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await fn(`http://127.0.0.1:${server.address().port}/api/games`);}finally{await new Promise(r=>server.close(r));}
}
test('HTTP error contract, flags, validation and inbound limiter',async()=>{
  await withApi({env:{GAMES_LICHESS_ENABLED:'false'}},async base=>{
    assert.deepEqual(await(await fetch(base+'/status')).json(),{lichess:false,db:false,sources:[]});
    const disabled=await fetch(base+'/masters?fen='+encodeURIComponent(fen));assert.equal(disabled.status,404);assert.deepEqual(await disabled.json(),{error:{code:'FEATURE_DISABLED',message:'FEATURE_DISABLED'}});
    for(let i=0;i<28;i++)await fetch(base+'/status');const limited=await fetch(base+'/status');assert.equal(limited.status,503);assert.equal(limited.headers.get('retry-after'),'60');
  });
  await withApi({env:{}},async base=>{
    const bad=await fetch(base+'/masters?fen=bad');assert.equal(bad.status,400);assert.equal((await bad.json()).error.code,'INVALID_FEN');
    const noToken=await fetch(base+'/masters?fen='+encodeURIComponent(fen));assert.equal(noToken.status,503);assert.equal((await noToken.json()).error.code,'UPSTREAM_AUTH_REQUIRED');
  });
});
const { userGames } = require('./src/games/userGames');
test('NDJSON and per-colour opening scores use player perspective; malformed input is an error',()=>{
 const make=(id,color,winner)=>({id,createdAt:1700000000000,status:winner?'mate':'draw',winner,speed:'blitz',players:{white:{user:{name:color==='white'?'Alice':'Bob'},rating:1500},black:{user:{name:color==='black'?'Alice':'Bob'},rating:1600}},opening:{eco:'A00',name:'Example opening'},pgn:'1. e4 e5 *'});
 const data=userGames([make('aaaaaaaa','white','white'),make('bbbbbbbb','white',null),make('cccccccc','black','white')].map(JSON.stringify).join('\n')+'\n','alice',30);
 assert.equal(data.games.length,3);assert.equal(data.openings.white[0].scorePct,75);assert.equal(data.openings.black[0].scorePct,0);
 assert.deepEqual(userGames('','alice',30).games,[]);
 assert.throws(()=>userGames('{bad}\n','alice',30),{code:'UPSTREAM_UNAVAILABLE'});
});
test('unknown player upstream 404 stays NOT_FOUND',async()=>{
 await assert.rejects(createLichessClient({fetchImpl:async()=>new Response('',{status:404})}).request('/api/games/user/unknown'),{code:'NOT_FOUND'});
});
test('database flag hides routes; enabled search forwards only validated parameters',async()=>{
 await withApi({env:{}},async base=>{const r=await fetch(base+'/db/search?player=example');assert.equal(r.status,404);assert.equal((await r.json()).error.code,'FEATURE_DISABLED');});
 let received;
 await withApi({env:{GAMES_DB_ENABLED:'true'},store:{async search(args){received=args;return{source:'chessaz-db',total:0,games:[]};},async pgn(){return{pgn:'1. e4 e5 *'};}}},async base=>{
  assert.equal((await(await fetch(base+'/status')).json()).db,true);
  assert.equal((await fetch(base+'/db/search')).status,400);
  const result=await fetch(base+'/db/search?player=M%C3%BCller&limit=20&offset=0');assert.equal(result.status,200);assert.deepEqual(received,{p_player:'muller',p_hash:null,p_limit:20,p_offset:0});
  assert.equal((await fetch(base+'/db/search?player=ab')).status,400);assert.equal((await fetch(base+'/db/0/pgn')).status,400);
 });
});
test('public PGN request does not require a token when upstream accepts anonymous access',async()=>{
 const client=createLichessClient({fetchImpl:async()=>new Response('1. e4 e5 *')});
 assert.equal(await client.request('/masters/pgn/aAbqI4ey',{explorer:true,requiresAuth:false}),'1. e4 e5 *');
});
test('rate-limit identity trusts only explicitly configured proxy hops',()=>{
 const {clientIp}=require('./src/games/clientIp');
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'192.0.2.99, 198.51.100.12'}};
 assert.equal(clientIp(req),'127.0.0.1');assert.equal(clientIp(req,'1'),'198.51.100.12');assert.equal(clientIp(req,'2'),'192.0.2.99');assert.equal(clientIp(req,'-1'),'127.0.0.1');
});
