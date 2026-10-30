'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess}=require('chess.js');
const {validChatQuery,groundedChat}=require('./aiCoachChat');
const {installAiCoach}=require('./aiCoach');
const fen=new Chess().fen();
const query={message:'Find games in this position',fen,side:'white',language:'ru'};
test('chat validates all request fields and languages',()=>{
 assert.ok(validChatQuery(query));
 for(const value of [{...query,fen:'invalid'},{...query,message:'x'},{...query,side:'red'},{...query,language:'xx'},{...query,admin:true}])assert.equal(validChatQuery(value),false);
 assert.ok(validChatQuery({...query,language:'ua'}));
});
test('verified public archive fallback includes exact indexed ply',async()=>{
 let called=0;
 const game={id:'g',source:'lichess-broadcast',pgn:'1. e4 e5',ply:0,white:'A',black:'B',result:'*'};
 const index={status:'ready',search:async q=>{called++;assert.equal(q.fen,fen);assert.equal(q.limit,5);return {total:1,nextMoves:[{move:'e4',count:1}],games:[game,{...game,id:'private',source:'private-room'}]};}};
 const answer=await groundedChat(index,query);
 assert.equal(called,1);assert.equal(answer.matched,1);assert.equal(answer.games.length,1);assert.equal(answer.games[0].ply,0);assert.equal(answer.generated,false);assert.equal(answer.engineVerified,false);
});
test('chat rejects archive PGNs whose indexed ply does not match the actual queried board',async()=>{
 const index={status:'ready',search:async()=>({total:2,games:[{id:'wrong-ply',source:'lichess-broadcast',pgn:'1. e4 e5',ply:1},{id:'invalid',source:'lichess-broadcast',pgn:'1. e9',ply:0}]})};
 assert.deepEqual((await groundedChat(index,query)).games,[]);
});
test('router denies anonymous access and does not expose results when feature off',async()=>{
 const app=express(),index={status:'ready',search:async()=>({total:0,games:[],nextMoves:[]})};
 installAiCoach(app,{enabled:true,index,verifyToken:async t=>t==='ok'?{id:'test'}:null});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/api/ai-coach/chat';
 try{
  const post=token=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(query)});
  assert.equal((await post()).status,401);assert.equal((await post('wrong')).status,401);
  const ok=await post('ok');assert.equal(ok.status,200);assert.equal((await ok.json()).matched,0);
 }finally{await new Promise(r=>server.close(r));}
});
