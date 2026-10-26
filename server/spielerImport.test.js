'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {assertTarget,importFideGer}=require('./scripts/importFideGer');
const {readFileSync}=require('node:fs');const {join}=require('node:path');
const fixture=readFileSync(join(__dirname,'test-support/spieler-fide-sample.xml'),'utf8');
const sample=require('./test-support/spielerFixture.cjs').acceptance();
test('import guards reject production and disguised targets before any write',()=>{
 for(const url of ['https://kmwfvvliundhuovoakoa.supabase.co','https://iukmpcytsuofqhxsumbu.supabase.co.evil.test','https://evil@iukmpcytsuofqhxsumbu.supabase.co','http://iukmpcytsuofqhxsumbu.supabase.co','https://iukmpcytsuofqhxsumbu.supabase.co/path'])assert.throws(()=>assertTarget('qa',url));
 assertTarget('qa','https://iukmpcytsuofqhxsumbu.supabase.co');assertTarget('local','http://127.0.0.1:54321');
});
test('official GER XML import preserves list rating/date and never imports club fields',async()=>{
 const writes=[];const players=await importFideGer({stream:Readable.from([...fixture]),target:'qa',url:'https://iukmpcytsuofqhxsumbu.supabase.co',date:sample.source_date,include:[sample.fide_id],client:{from:table=>({upsert:async rows=>{writes.push({table,rows});return {};}})}});
 const actual=players.find(p=>p.fide_id===sample.fide_id);assert.deepEqual(actual,sample);assert.equal(players.length,2);
 assert.equal(writes[0].table,'spieler_players');for(const p of players){assert.equal('dwz' in p,false);assert.equal('club' in p,false);}
});
test('XML entity declarations, invalid records and truncation fail closed',async()=>{
 for(const xml of ['<!DOCTYPE x>'+fixture,fixture.replace('<fideid>','<fideid>evil'),'<player><fideid>1'])await assert.rejects(importFideGer({stream:Readable.from([xml]),target:'local',url:'http://localhost:54321',date:'2026-10-25'}));
});
