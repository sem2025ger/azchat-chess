'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess}=require('chess.js');
const {DEFAULT_MOVES,parseOpening,prepareOpening,safeGame,generateBriefing}=require('./aiCoachCore');
const {installAiCoach}=require('./aiCoach');
function record(id,line,ply){const board=new Chess();for(const san of line.split(' '))board.move(san);board.header('White','A','Black','B');return {id,pgn:board.pgn(),ply,white:'A',black:'B',whiteRating:2100,blackRating:2300,date:'2026-10-10',event:'Fixture',result:'1-0'};}
test('arbitrary legal opening lines and colors validated',()=>{
 assert.equal(parseOpening('e4 e5 Nf3 Nc6').turn,'white');
 assert.equal(parseOpening('1.d4 d5 2.c4').turn,'black');
 assert.equal(parseOpening('e4 e5 Nf3 bad'),null);
 assert.equal(parseOpening(''),null);
 assert.ok(parseOpening(DEFAULT_MOVES));
});
test('matching position and next move, not hardcoded Najdorf sixth move',async()=>{
 const line='d4 d5 c4 e6 Nc3 Nf6';
 const good=record('a',line+' Bg5 Be7',6),bad=record('b','e4 e5 Nf3 Nc6 Bb5 a6',6);
 const calls=[];const index={status:'ready',search:async q=>{calls.push(q);return {total:2,games:[good,bad]};}};
 const result=await prepareOpening(index,{moves:line,color:'white'});
 assert.deepEqual(result.groups.map(g=>g.move),['Bg5']);
 assert.equal(result.groups[0].games[0].ply,6);
 assert.equal(result.groups[0].blackReplies[0].move,'Be7');
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
