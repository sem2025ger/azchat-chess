'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess}=require('chess.js');
const {DEFAULT_MOVES,parseOpening,prepareOpening,safeGame,generateBriefing}=require('./aiCoachCore');
const {installAiCoach}=require('./aiCoach');
const {PositionIndex,supabasePositionSource}=require('./positionIndex');
function record(id,line,ply){const board=new Chess();for(const san of line.split(' '))board.move(san);board.header('White','A','Black','B');return {id,source:'lichess-broadcast',pgn:board.pgn(),ply,white:'A',black:'B',whiteRating:2100,blackRating:2300,date:'2026-10-10',event:'Fixture',result:'1-0'};}
test('arbitrary legal opening lines and colors validated',()=>{
 assert.equal(parseOpening('e4 e5 Nf3 Nc6').turn,'white');
 assert.equal(parseOpening('1.d4 d5 2.c4').turn,'black');
 assert.equal(parseOpening('e4 e5 Nf3 bad'),null);
 assert.equal(parseOpening(''),null);
 assert.ok(parseOpening(DEFAULT_MOVES));
 assert.ok(parseOpening(Array(10).fill('Nf3 Nf6 Ng1 Ng8').join(' ')));
 assert.equal(parseOpening(Array(11).fill('Nf3 Nf6 Ng1 Ng8').join(' ')),null);
});
test('matching position and next move, not a fixed opening or ply',async()=>{
 const line='d4 d5 c4 e6 Nc3 Nf6';
 const good=record('a',line+' Bg5 Be7',6),bad=record('b','e4 e5 Nf3 Nc6 Bb5 a6',6);
 const calls=[];const index={status:'ready',search:async q=>{calls.push(q);return {total:2,games:[good,bad]};}};
 const result=await prepareOpening(index,{moves:line,color:'white'});
 assert.deepEqual(result.groups.map(g=>g.move),['Bg5']);
 assert.equal(result.groups[0].games[0].ply,6);
 assert.equal(result.groups[0].replies[0].move,'Be7');
 assert.ok(calls.every(x=>x.side==='white'&&x.limit===50&&x.scope==='all'));
});
test('verified exact FEN and PGN, rejects misplaced or invalid games',()=>{
 const line='e4 e5 Nf3 Nc6';
 const ref=parseOpening(line),good=record('a',line+' Bb5 a6',4);
 assert.equal(safeGame(good,ref).move,'Bb5');
 assert.equal(safeGame({...good,ply:3},ref),null);
 assert.equal(safeGame({...good,pgn:'bad'},ref),null);
});
test('Gemini receives only bounded SAN evidence; fallback without key',async()=>{
 const index={status:'ready',search:async()=>({total:1,games:[record('a','d4 d5 c4 e6',2)]})};
 const result=await prepareOpening(index,{moves:'d4 d5',color:'white'});
 let called=false;
 const text=await generateBriefing(result,'ru',{apiKey:'key',fetchImpl:async(_url,options)=>{called=true;assert.ok(!options.body.includes('"white":"A"'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"briefing":"Study the central structure."}'}]}}]}),{status:200});}});
 assert.equal(called,true);assert.equal(text,'Study the central structure.');
 assert.equal(await generateBriefing(result,'ru',{apiKey:null}),null);
});
async function serve(config,check){const app=express();installAiCoach(app,config);const listener=app.listen(0,'127.0.0.1');await new Promise(r=>listener.once('listening',r));try{await check('http://127.0.0.1:'+listener.address().port);}finally{await new Promise(r=>listener.close(r));}}
test('API defaults off, requires valid auth and accepts arbitrary legal opening',async()=>{
 await serve({},async u=>assert.equal((await fetch(u+'/api/ai-coach/preparation',{method:'POST'})).status,404));
 const index={status:'ready',search:async()=>({total:1,games:[record('a','d4 d5 c4 e6',2)]})};
 await serve({enabled:true,index,verifyToken:async token=>token==='ok'?{id:'u'}:null},async u=>{
  const send=(body,token='ok')=>fetch(u+'/api/ai-coach/preparation',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await send({moves:'d4 d5',color:'white',language:'ru'},'bad')).status,401);
  assert.equal((await send({moves:'e4 nonsense',color:'white',language:'ru'})).status,400);
  assert.equal((await send({moves:'d4 d5',color:'white',language:'ru',secret:true})).status,400);
  const response=await send({moves:'d4 d5',color:'white',language:'ru'}),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.opening,'custom');assert.equal(data.groups[0].move,'c4');
 });
});
test('not-ready index fails closed',async()=>{await assert.rejects(prepareOpening({status:'warming'},{moves:'e4',color:'black'}),{code:'index_warming'});});
test('real index joins move-order transpositions and repetitions at their own indexed ply',async()=>{
 const rows=[
  archive('a','Nf3 d5 g3 Nf6 Bg2 e6'),
  archive('b','g3 d5 Nf3 Nf6 Bg2 e6'),
  archive('c','Nf3 Nf6 Ng1 Ng8 g3 d5 Nf3 Nf6 Bg2 e6'),
 ];
 const index=await buildArchive(rows);
 for(const color of ['white','black']){
  const lesson=await prepareOpening(index,{moves:'Nf3 d5 g3 Nf6',color});
  assert.equal(lesson.matched,3);assert.equal(lesson.groups[0].move,'Bg2');
  assert.deepEqual(lesson.groups[0].games.map(g=>g.ply).sort(),[4,4,8]);
  assert.equal(lesson.groups[0].replyColor,'black');
 }
 const blackTurn=await prepareOpening(index,{moves:'g3 d5 Nf3 Nf6 Bg2',color:'black'});
 assert.equal(blackTurn.turn,'black');assert.equal(blackTurn.groups[0].replyColor,'white');
 assert.equal(blackTurn.groups[0].move,'e6');
});
test('only public archive source reaches Coach, and opt-outs apply to either player after cache fill',async()=>{
 const hidden=new Set(),reads=[];
 // Identical positions also exist in private stores; the provider must never read them.
 const tables={
  spieler_broadcast_games:[archive('a','d4 d5 c4 e6')],
  chess_club_rooms:[archive('private-room','d4 d5 c4 e6')],
  preparation_games:[archive('private-preparation','d4 d5 c4 e6')],
 };
 const client={from(table){
  reads.push(table);let cursor=null,limit=250;
  const q={select(){return q;},order(){return q;},limit(n){limit=n;return q;},gt(_key,value){cursor=value;return q;},range(){return q;},eq(){return q;},in(){return q;},async abortSignal(){
   return {data:table==='spieler_opt_out'?[...hidden].map(fide_id=>({fide_id})):(tables[table]||[]).filter(row=>!cursor||row.id>cursor).slice(0,limit),error:null};
  }};return q;
 }};
 const provider=supabasePositionSource(client),index=new PositionIndex(provider,{log(){}});await index.start();
 assert.equal(index.status,'ready');
 const query=()=>prepareOpening(index,{moves:'d4 d5',color:'white'});
 const first=await query();assert.deepEqual(first.groups.flatMap(g=>g.games.map(x=>x.id)),['a']);
 assert.deepEqual([...new Set(reads)].sort(),['spieler_broadcast_games','spieler_claims','spieler_opt_out','spieler_players']);
 for(const fide of ['101','202']){
  hidden.add(fide);const lesson=await query();assert.equal(lesson.matched,0);assert.deepEqual(lesson.groups,[]);
  hidden.clear();assert.equal((await query()).matched,1);
 }
 provider.hidden=async()=>{throw Error('privacy unavailable');};await assert.rejects(query());
});
test('Coach rejects private or unknown provenance even if PGN and position match',()=>{
 const game=record('a','d4 d5 c4 e6',2),ref=parseOpening('d4 d5');
 for(const source of [undefined,'private-room','preparation','lichess'])assert.equal(safeGame({...game,source},ref),null);
 assert.ok(safeGame(game,ref));
});
test('canonical Ukrainian uk and legacy ua are accepted; Gemini receives uk',async()=>{
 const index={status:'ready',search:async()=>({total:1,games:[record('a','d4 d5 c4 e6',2)]})};
 await serve({enabled:true,index,verifyToken:async()=>({id:'u'})},async url=>{
  for(const language of ['uk','ua']){
   const response=await fetch(url+'/api/ai-coach/preparation',{method:'POST',headers:{Authorization:'Bearer ok','Content-Type':'application/json'},body:JSON.stringify({moves:'d4 d5',color:'white',language})});
   assert.equal(response.status,200);
  }
 });
 const lesson=await prepareOpening(index,{moves:'d4 d5',color:'white'});
 await generateBriefing(lesson,'ua',{apiKey:'fixture',fetchImpl:async(_url,options)=>{
  const prompt=JSON.parse(options.body).contents[0].parts[0].text;
  assert.ok(prompt.includes('Language: uk.'));assert.ok(prompt.includes('\n'));
  return Response.json({candidates:[]});
 }});
});
function archive(id,line){return {id,pgn:line+' 1-0',white_fide_id:'101',black_fide_id:'202',white_name:'A',black_name:'B',game_date:'2026-10-29',event:'Synthetic',source_url:'https://database.lichess.org/broadcast/lichess_db_broadcast_2026-10.pgn.zst',license_url:'https://creativecommons.org/licenses/by-sa/4.0/'};}
async function buildArchive(rows){
 const index=new PositionIndex({page:async(cursor,limit)=>rows.filter(r=>!cursor||r.id>cursor).slice(0,limit),hidden:async()=>new Set()},{log(){}});
 await index.start();assert.equal(index.status,'ready');return index;
}
