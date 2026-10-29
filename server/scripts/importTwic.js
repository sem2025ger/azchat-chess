#!/usr/bin/env node
'use strict';
// Import an operator-supplied official TWIC PGN download. No HTML or ChessBase.
const {assertTarget}=require('./importFideGer');
const {normalizeGame,splitPgn}=require('../spielerGamesProvider');
function twicRows(text,source){
 if(!/^twic\d{1,5}$/.test(source)||Buffer.byteLength(text)>32*1024*1024)throw Error('Invalid TWIC input');
 return splitPgn(text).map(pgn=>{const g=normalizeGame(pgn,'twic');return {id:g.id,pgn:g.pgn,white_fide_id:g.whiteFideId,black_fide_id:g.blackFideId,source};}).filter(g=>g.white_fide_id||g.black_fide_id);
}
if(require.main===module)(async()=>{
 const args=Object.fromEntries(process.argv.slice(2).map(x=>{const m=x.match(/^--(file|source|target)=(.+)$/);if(!m)throw Error('Invalid arguments');return [m[1],m[2]];}));
 assertTarget(args.target,process.env.SUPABASE_URL||'');if(!process.env.SUPABASE_SERVICE_KEY)throw Error('Server credential required');
 const rows=twicRows(require('node:fs').readFileSync(args.file,'utf8'),args.source);
 const client=require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(let i=0;i<rows.length;i+=100){const r=await client.from('spieler_twic_games').upsert(rows.slice(i,i+100),{onConflict:'id'});if(r.error)throw Error('TWIC import failed');}
 console.log(JSON.stringify({target:args.target,games:rows.length}));
})().catch(()=>{console.error('TWIC import failed; verify approved local/QA input and target.');process.exitCode=1;});
module.exports={twicRows};
