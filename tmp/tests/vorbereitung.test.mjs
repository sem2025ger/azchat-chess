import test from 'node:test';import assert from 'node:assert/strict';
import {createVorbereitungApi,vorbereitungEnabled} from '../src/services/vorbereitung.ts';
import {analysePreparation} from '../../shared/vorbereitung.mjs';
import {createServer} from 'vite';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';
const games=[{id:'one',color:'white',speed:'blitz',timeControl:'300+0',opening:'Sicilian Defense: Najdorf Variation',eco:'B90',white:'target',black:'guest',result:'1-0',pgn:'1. e4 c5 *',date:'2026.10.25'},
 {id:'two',color:'black',speed:'rapid',timeControl:'600+0',opening:'Sicilian Defense: Najdorf Variation',eco:'B90',white:'guest',black:'target',result:'1-0',pgn:'1. e4 c5 *',date:'2026.10.25'}];
test('Vorbereitung name/ECO/colour/time filters share server logic, including no matches and black losses',()=>{
 assert.deepEqual(analysePreparation(games,{variation:'Najdorf'}),analysePreparation(games,{variation:'b90'}));
 assert.equal(analysePreparation(games,{color:'black'}).byColor.black.lossPct,100);
 assert.equal(analysePreparation(games,{color:'white',speed:'blitz',timeControl:'300+0'}).games.length,1);
 assert.equal(analysePreparation(games,{variation:'B99'}).games.length,0);
});
test('Vorbereitung API rejects absent login/unsafe username, uses header token, propagates cooldown and AbortSignal',async()=>{
 for(const value of [undefined,true,false,'false','1'])assert.equal(vorbereitungEnabled(value),false);assert.equal(vorbereitungEnabled('true'),true);
 const calls=[],signal=new AbortController().signal;
 const api=createVorbereitungApi('https://qa.example',async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({nickname:'target',games,rejected:0}));});
 await api.load('target','private-token',signal);assert.equal(calls[0].options.headers.Authorization,'Bearer private-token');assert.equal(calls[0].options.signal,signal);assert.ok(!calls[0].url.includes('private-token'));assert.equal(calls[0].options.cache,'no-store');
 await assert.rejects(api.load('target','',signal));await assert.rejects(api.load('../evil','token',signal));assert.equal(calls.length,1);
 const cooldown=createVorbereitungApi('https://qa.example',async()=>new Response(JSON.stringify({code:'lichess_rate_limit',retryAfter:60}),{status:429}));
 await assert.rejects(cooldown.load('target','token',signal),e=>e.code==='lichess_rate_limit'&&e.retryAfter===60);
});
test('Vorbereitung UI empty variant message, WDL table, optional links and team-only non-verified nickname rendering',async()=>{
 const server=await createServer({define:{'import.meta.env.VITE_VORBEREITUNG_ENABLED':JSON.stringify('true')},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {default:Results}=await server.ssrLoadModule('/src/components/spieler/VorbereitungResults.tsx');
  const empty=renderToStaticMarkup(createElement(Results,{games,filters:{variation:'B99'},onAnalyse(){}}));assert.ok(empty.includes('Keine Partien in dieser Variante'));
  const html=renderToStaticMarkup(createElement(Results,{games,filters:{variation:'Najdorf'},onAnalyse(){}}));assert.ok(html.includes('Mit Weiß'));assert.ok(html.includes('Mit Schwarz'));assert.ok(html.includes('B90'));assert.ok(html.includes('In ChessAZ analysieren'));
  const {default:Opponent}=await server.ssrLoadModule('/src/components/spieltag/OpponentPreparation.tsx');
  const member=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(Opponent,{username:'target',captain:false,busy:false,onSave(){}})));
  assert.ok(member.includes('(nicht verifiziert)'));assert.ok(member.includes('href="/vorbereitung"'));assert.ok(!member.includes('?username'));assert.doesNotMatch(member,/<form|<input/);
  const captain=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(Opponent,{username:null,captain:true,busy:false,onSave(){}})));assert.match(captain,/<input/);
  const {default:Card}=await server.ssrLoadModule('/src/components/spieler/SpielerCard.tsx');
  const card=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(Card,{player:{fide_id:1,name:'Fixture',federation:'GER',club:null,title:null,fide_rating:2100,source_date:'2026-10-25'}})));assert.ok(card.includes('href="/vorbereitung"'));
 }finally{await server.close();}
});
