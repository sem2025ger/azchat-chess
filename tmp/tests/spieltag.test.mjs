import test from 'node:test';import assert from 'node:assert/strict';
import {createSpieltagApi,spieltagEnabled,scheduleFromMatch,boardInput,berlinDateTime,berlinDateTimeToIso} from '../src/services/spieltag.ts';
import {createServer} from 'vite';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const team='11111111-1111-4111-8111-111111111111',match='22222222-2222-4222-8222-222222222222';
test('Spieltag default-off flag and Bearer-only API, bounded identifiers, explicit write payloads',async()=>{
 for(const value of [undefined,false,true,'false','1'])assert.equal(spieltagEnabled(value),false);assert.equal(spieltagEnabled('true'),true);
 const calls=[],api=createSpieltagApi('https://qa.example','private-token',async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({teams:[],matches:[],boards:[]}));});
 const signal=new AbortController().signal;
 await api.teams(signal);await api.matches(team,signal);await api.boards(match,signal);
 const schedule={round_label:'Runde 1',opponent_name:'Guests',opponent_club_id:null,starts_at:'2026-11-08T10:00:00Z',venue:'Bochum',notes:'Short note'};
 await api.saveMatch(team,null,schedule,signal);await api.saveMatch(team,match,schedule,signal);
 for(const c of calls){assert.equal(c.options.headers.Authorization,'Bearer private-token');assert.ok(!c.url.includes('private-token'));assert.equal(c.options.cache,'no-store');assert.equal(c.options.signal,signal);}
 assert.equal(calls[3].options.method,'POST');assert.equal(calls[4].options.method,'PATCH');
 await assert.rejects(api.matches('../foreign',signal));await assert.rejects(api.saveBoard(match,33,false,{home_name:'Name'},signal));assert.equal(calls.length,5);
 const empty=createSpieltagApi('https://qa.example','',async()=>{throw Error('should not fetch');});await assert.rejects(empty.teams(signal),e=>e.code==='authentication_required');
 assert.deepEqual(scheduleFromMatch({...schedule,id:match,team_id:team,created_by:'must not copy'}),schedule);
 assert.deepEqual(boardInput({match_id:match,board_number:1,home_name:'Home',home_fide_id:null,opponent_name:'Guest',opponent_fide_id:13404431,result:'1-0'}),{home_name:'Home',home_fide_id:null,opponent_name:'Guest',opponent_fide_id:13404431,result:'1-0'});
});
test('captain schedules use Europe/Berlin independently of device timezone, rejecting clock-change ambiguity',()=>{
 assert.equal(berlinDateTimeToIso('2026-11-08T11:00'),'2026-11-08T10:00:00.000Z');
 assert.equal(berlinDateTimeToIso('2026-07-08T11:00'),'2026-07-08T09:00:00.000Z');
 assert.equal(berlinDateTime('2026-11-08T10:00:00Z'),'2026-11-08T11:00');
 for(const value of ['2026-03-29T02:30','2026-10-25T02:30','2026-02-30T11:00','not-a-date'])assert.throws(()=>berlinDateTimeToIso(value));
});
test('three Spieltag tabs render correct private content; member cannot edit, notes escaped and Spieler links optional',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {default:View}=await server.ssrLoadModule('/src/components/spieltag/SpieltagMatchView.tsx');
  const data={id:match,team_id:team,round_label:'Runde 1',opponent_name:'Gastmannschaft',starts_at:'2026-11-08T10:00:00Z',venue:'Bochum',notes:'<script>private</script>'};
  const board={match_id:match,board_number:1,home_name:'Home player',home_fide_id:null,opponent_name:'Guest player',opponent_fide_id:13404431,result:'1-0'};
  const base={match:data,boards:[board],captain:false,busy:false,spielerAvailable:true,onCard(){},onEdit(){},onDelete(){},onResult(){},onNotes(){}};
  for(const initialTab of ['lineup','opponent','round']){
   const html=renderToStaticMarkup(createElement(View,{...base,initialTab}));
   for(const label of ['Aufstellung','Gegner','Nach der Runde'])assert.ok(html.includes(label));
   assert.doesNotMatch(html,/<(?:form|textarea|select)/);assert.doesNotMatch(html,/<script>/);
   if(initialTab==='opponent'){assert.ok(html.includes('Guest player'));assert.ok(html.includes('Spielerkarte'));assert.ok(html.includes('13404431'));}
   if(initialTab==='round'){assert.ok(html.includes('1-0'));assert.ok(html.includes('&lt;script&gt;private&lt;/script&gt;'));}
  }
  const captain=renderToStaticMarkup(createElement(View,{...base,captain:true,initialTab:'round'}));assert.match(captain,/<textarea/);assert.match(captain,/<select/);
  const disabled=renderToStaticMarkup(createElement(View,{...base,spielerAvailable:false,initialTab:'opponent'}));assert.ok(!disabled.includes('Spielerkarte'));
 }finally{await server.close();}
});
