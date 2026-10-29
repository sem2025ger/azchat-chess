'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess}=require('chess.js');
const {NAJDORF_LINE,NAJDORF_FEN,prepareNajdorf,safeGame,generateBriefing}=require('./aiCoachCore');
const {installAiCoach}=require('./aiCoach');
const pgn=(reply='Bg5',black='e6')=>{
 const game=new Chess();
 for(const san of [...NAJDORF_LINE,reply,black,'f4'])game.move(san);
 game.header('White','Sample White','Black','Sample Black','Result','1-0');
 return game.pgn();
};
const record=(id,reply='Bg5',rating=2350)=>({id,pgn:pgn(reply),ply:10,white:'Player A',black:'Player B',whiteRating:rating,blackRating:rating,date:'2026-10-10',event:'Fixture',result:'1-0'});
test('Najdorf anchor and records are verified, first 25 full moves only',()=>{
 const board=new Chess(NAJDORF_FEN);assert.equal(board.turn(),'w');
 const entry=safeGame(record('a'));assert.equal(entry.move,'Bg5');assert.equal(entry.first25[10],'Bg5');
 assert.equal(safeGame({...record('a'),ply:9}),null);
 assert.equal(safeGame({...record('a'),pgn:'bad'}),null);
 assert.equal(safeGame({...record('a'),pgn:pgn('Be3'),ply:10}).move,'Be3');
});
test('deduplicates strongest/newest and selects no more than 5 verified games per White sixth move',async()=>{
 const entries=[...Array.from({length:7},(_,i)=>record('bg'+i,'Bg5',2200+i)),record('be','Be3',2550)];
 const calls=[];const index={status:'ready',search:async q=>{calls.push(q);return {total:346,games:q.sort==='strongest'?entries:entries.slice(1)};}};
 const lesson=await prepareNajdorf(index);
 assert.equal(lesson.matched,346);assert.equal(lesson.inspected,8);assert.deepEqual(lesson.groups.map(g=>g.move),['6.Bg5','6.Be3']);
 assert.equal(lesson.groups[0].games.length,5);assert.equal(new Set(lesson.groups[0].games.map(g=>g.id)).size,5);
 assert.ok(calls.every(q=>q.fen===NAJDORF_FEN&&q.side==='black'&&q.limit===50&&q.scope==='all'));
});
test('Gemini only receives bounded, anonymized candidate move lines; invalid provider response falls back',async()=>{
 const index={status:'ready',search:async()=>({total:1,games:[record('a')]})},lesson=await prepareNajdorf(index);
 let called=false;
 const text=await generateBriefing(lesson,'de',{apiKey:'secret',fetchImpl:async(url,options)=>{
  called=true;assert.match(url,/^https:\/\/generativelanguage\.googleapis\.com\//);
  const request=JSON.parse(options.body);assert.ok(!JSON.stringify(request).includes('Sample White'));
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"briefing":"Prüfe die Pläne in den Partien."}'}]}}]}),{status:200});
 }});
 assert.ok(called);assert.equal(text,'Prüfe die Pläne in den Partien.');
 assert.equal(await generateBriefing(lesson,'de',{apiKey:null}),null);
});
async function serve(config,check){
 const app=express();installAiCoach(app,config);
 const listener=app.listen(0,'127.0.0.1');await new Promise(r=>listener.once('listening',r));
 try{await check('http://127.0.0.1:'+listener.address().port);}
 finally{await new Promise(r=>listener.close(r));}
}
test('route defaults off; rejects anonymous/invalid requests, serves source-backed lesson without key',async()=>{
 await serve({},async url=>assert.equal((await fetch(url+'/api/ai-coach/preparation',{method:'POST'})).status,404));
 const index={status:'ready',search:async()=>({total:1,games:[record('a')]})};
 await serve({enabled:true,index,verifyToken:async()=>({id:'member'})},async url=>{
  const send=(body,token='valid')=>fetch(url+'/api/ai-coach/preparation',{method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  assert.equal((await send({opening:'najdorf',color:'black',language:'de'},'invalid')).status,200);
  assert.equal((await fetch(url+'/api/ai-coach/preparation',{method:'POST'})).status,401);
  assert.equal((await send({opening:'najdorf',color:'white',language:'ru'})).status,400);
  assert.equal((await send({opening:'najdorf',color:'black',language:'ru',extra:true})).status,400);
  const response=await send({opening:'najdorf',color:'black',language:'ru'}),json=await response.json();
  assert.equal(response.status,200);assert.equal(json.generated,false);assert.equal(json.briefing,null);
  assert.equal(json.groups[0].games[0].first25[10],'Bg5');
 });
});
test('index is unavailable before readiness, no speculative answer',async()=>{
 await assert.rejects(prepareNajdorf({status:'warming'}),{code:'index_warming'});
});
