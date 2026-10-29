#!/usr/bin/env node
'use strict';
// Official, manually downloaded/unzipped FIDE XML only. No page scraping.
const fs=require('node:fs');
const QA='iukmpcytsuofqhxsumbu';
function assertTarget(target,url){
 let u;try{u=new URL(url);}catch{throw Error('Local or QA Supabase URL required');}
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Unsafe import target');
 if(target==='qa'&&u.protocol==='https:'&&u.hostname===QA+'.supabase.co'&&!u.port)return;
 if(target==='local'&&u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))return;
 throw Error('Import restricted to local/QA; production forbidden');
}
function decodeXml(s){return s.replace(/&(?:amp|lt|gt|quot|apos);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]));}
function parsePlayer(xml,date){
 const value=tag=>decodeXml(xml.match(new RegExp('<'+tag+'>\\s*([^<]*)\\s*</'+tag+'>'))?.[1]?.trim()||'');
 const id=value('fideid'),name=value('name'),federation=value('country'),title=value('title'),rating=value('rating');
 if(!/^[1-9]\d{0,9}$/.test(id)||name.length<2||name.length>150||!/^[A-Z]{3}$/.test(federation))throw Error('Invalid official FIDE record');
 if(title&&!['GM','IM','FM','CM','WGM','WIM','WFM','WCM'].includes(title))throw Error('Invalid FIDE title');
 if(rating&&(!/^\d{3,4}$/.test(rating)||+rating<100||+rating>4000))throw Error('Invalid FIDE rating');
 return {fide_id:id,name,surname:name.split(',')[0].trim(),federation,title:title||null,fide_rating:rating?+rating:null,
  source_date:date,source_url:'https://ratings.fide.com/profile/'+id};
}
async function* officialPlayers(stream,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw Error('Source date required');
 let buffer='';for await(const chunk of stream){buffer+=chunk;if(/<!DOCTYPE|<!ENTITY/i.test(buffer))throw Error('XML entities forbidden');
  let end;while((end=buffer.indexOf('</player>'))!==-1){const block=buffer.slice(0,end+9);buffer=buffer.slice(end+9);const start=block.lastIndexOf('<player>');
   if(start<0||block.length-start>16384)throw Error('Invalid XML record');yield parsePlayer(block.slice(start),date);}
  if(buffer.length>65536)throw Error('Invalid or oversized XML');
 }
 if(buffer.includes('<player>'))throw Error('Truncated XML');
}
async function importFideGer({stream,target,url,date,include=[],client=null}){
 assertTarget(target,url);const ids=new Set(include.map(String));if([...ids].some(id=>! /^[1-9]\d{0,9}$/.test(id)))throw Error('Invalid included FIDE ID');
 const players=[];for await(const p of officialPlayers(stream,date)){if(p.federation!=='GER'&&!ids.has(p.fide_id))continue;
  players.push(p);}
 if(!players.length)throw Error('No matching official FIDE records');
 if(client)for(let i=0;i<players.length;i+=500){const r=await client.from('spieler_players').upsert(players.slice(i,i+500),{onConflict:'fide_id'});if(r.error)throw Error('QA import write failed');}
 return players;
}
async function main(){
 const options={};for(const arg of process.argv.slice(2)){const m=arg.match(/^--([a-z-]+)=(.+)$/);if(m&&['file','target','date','include','out'].includes(m[1]))options[m[1]]=m[2];else if(arg==='--apply')options.apply=true;else throw Error('Use --file=XML --target=local|qa --date=YYYY-MM-DD [--include=ID,...] [--out=JSON] [--apply]');}
 const url=process.env.SUPABASE_URL||'';assertTarget(options.target,url);
 if(options.apply&&!process.env.SUPABASE_SERVICE_KEY)throw Error('Server-only import credential required');
 const client=options.apply?require('@supabase/supabase-js').createClient(url,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
 const players=await importFideGer({stream:fs.createReadStream(options.file,{encoding:'utf8'}),target:options.target,url,date:options.date,include:(options.include||'').split(',').filter(Boolean),client});
 if(options.out)fs.writeFileSync(options.out,JSON.stringify(players));
 console.log(JSON.stringify({target:options.target,project_ref:options.target==='qa'?QA:'local',records:players.length,applied:!!client}));
}
if(require.main===module)main().catch(()=>{console.error('FIDE import failed; check local/QA target, source file and server-only credential.');process.exitCode=1;});
module.exports={assertTarget,parsePlayer,officialPlayers,importFideGer};
