'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {assertTarget,importFideGer}=require('./scripts/importFideGer');
const row=(id,country,name='Huseynov, Sabir')=>`<player><fideid>${id}</fideid><name>${name}</name><country>${country}</country><title>FM</title><rating>2379</rating></player>`;
test('import guards reject production and disguised targets before any write',()=>{
 for(const url of ['https://kmwfvvliundhuovoakoa.supabase.co','https://iukmpcytsuofqhxsumbu.supabase.co.evil.test','https://evil@iukmpcytsuofqhxsumbu.supabase.co','http://iukmpcytsuofqhxsumbu.supabase.co','https://iukmpcytsuofqhxsumbu.supabase.co/path'])assert.throws(()=>assertTarget('qa',url));
 assertTarget('qa','https://iukmpcytsuofqhxsumbu.supabase.co');assertTarget('local','http://127.0.0.1:54321');
});
test('official GER XML import includes explicit AZE acceptance ID and voluntary club without DSB data',async()=>{
 const xml='<playerslist>'+row('13404431','AZE')+row('999','GER','Test, German')+row('998','AZE','Other, Player')+'</playerslist>';
 const writes=[];const players=await importFideGer({stream:Readable.from([...xml]),target:'qa',url:'https://iukmpcytsuofqhxsumbu.supabase.co',date:'2026-10-25',include:['13404431'],clubs:{13404431:'Bochumer SV 02'},client:{from:table=>({upsert:async rows=>{writes.push({table,rows});return {};}})}});
 assert.equal(players.length,2);assert.equal(players[0].title,'FM');assert.equal(players[0].fide_rating,2379);assert.equal(players[0].club,'Bochumer SV 02');assert.equal(players[0].federation,'AZE');assert.equal(writes[0].table,'spieler_players');assert.equal('dwz' in players[0],false);
});
test('XML entity declarations, invalid records and truncation fail closed',async()=>{
 for(const xml of ['<!DOCTYPE x>'+row('1','GER'),row('evil','GER'),'<player><fideid>1'])await assert.rejects(importFideGer({stream:Readable.from([xml]),target:'local',url:'http://localhost:54321',date:'2026-10-25'}));
});
