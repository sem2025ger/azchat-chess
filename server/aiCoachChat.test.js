'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess}=require('chess.js');
const {validChatQuery,groundedChat,gameRequest}=require('./aiCoachChat');
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
test('model evidence includes only verified public continuations from the exact indexed ply',async()=>{
 const board=new Chess();board.move('e4');
 const game={id:'public',source:'lichess-broadcast',pgn:'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6',ply:1,white:'A',black:'B',result:'*'};
 const index={status:'ready',search:async()=>({total:1,nextMoves:[{move:'e5',count:1}],games:[game,{...game,id:'private',source:'private-room'}]})};
 await groundedChat(index,{...query,fen:board.fen()},{openaiApiKey:'synthetic',fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body),{evidence}=JSON.parse(body.input);assert.equal(evidence.games.length,1);assert.equal(evidence.games[0].hasPgn,true);assert.equal(evidence.games[0].matchedPly,1);assert.deepEqual(evidence.games[0].continuation,['e5','Nf3','Nc6','Bb5','a6']);assert.ok(body.instructions.includes('do not claim provided PGNs are missing'));
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Verified example.'})}]}]});
 }});
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

test('archive-only requests honor exact counts and return original first fifteen moves without model calls',async()=>{
 const longPgn='1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. Nc3 Qc7 13. Be3 Bb7 14. Rc1 Rfe8 15. a3 Bf8 16. Ba2';
 const games=Array.from({length:15},(_,i)=>({id:'public-'+i,source:'lichess-broadcast',pgn:longPgn,ply:0,white:'White',black:'Black',result:'*'}));
 for(const [text,expected] of [['Найди мне за белых три партии на этот вариант',3],['Покажи 10 партий',10],['Найди 15 партий',15],['Find two games',2]]){
  let searched=0;const index={status:'ready',search:async args=>{searched++;assert.equal(args.limit,expected);return {total:games.length,games:games.slice(0,args.limit),nextMoves:[{move:'e4',count:15}]};}};
  const answer=await groundedChat(index,{...query,message:text},{openaiApiKey:'synthetic',fetchImpl:()=>{throw Error('must not call model for archive-only request');}});
  assert.equal(searched,1);assert.equal(answer.archiveOnly,true);assert.equal(answer.generated,true);
  assert.equal(answer.answer,'В партиях встречались такие продолжения:');
  assert.equal(answer.games.length,expected);assert.deepEqual(answer.games[0].moves.slice(0,4),['e4','e5','Nf3','Nc6']);
  assert.equal(answer.games[0].moves.length,30);
 }
 assert.equal(gameRequest('Объясни ход Nf3'),null);
 assert.equal(gameRequest('Найди 50 партий'),null);
});

test('client candidate lines must be bounded, unique and legal from exact FEN',()=>{
 const line={moves:['e4','e5','Nf3','Nc6']};
 assert.equal(validChatQuery({...query,candidateLines:[line]}),true);
 for(const lines of [
  [],Array(4).fill(line),[{moves:['e4','e4']}],
  [{moves:['e4','e5','Nf3','Nc6']},{moves:['e4','e5','Nf3','Nc6']}],
  [{moves:['a1a9']}],[{moves:[]}],[{moves:['e4'],evaluation:99}],
  [{moves:Array(11).fill('e4')}]
 ])assert.equal(validChatQuery({...query,candidateLines:lines}),false);
 const afterE4=new Chess();afterE4.move('e4');
 assert.equal(validChatQuery({...query,fen:afterE4.fen(),candidateLines:[{moves:['e4']}]}),false);
 assert.equal(validChatQuery({...query,fen:afterE4.fen(),candidateLines:[{moves:['c5','Nf3']}]}),true);
});
test('candidate lines reach model only after replay validation and return without engine verification',async()=>{
 const index={status:'ready',search:async()=>({total:0,games:[],nextMoves:[]})};
 const lines=[{moves:['e4','e5','Nf3']}];
 const reply=await groundedChat(index,{...query,message:'Explain the idea behind this line',candidateLines:lines},{openaiApiKey:'synthetic',fetchImpl:async(url,options)=>{
   const data=JSON.parse(JSON.parse(options.body).input);
   assert.deepEqual(data.evidence.candidateLines,lines);
   assert.equal(data.evidence.candidateOrigin,'untrusted_client_legality_checked');
   return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Develop the pieces before launching an attack.'})}]}]});
 }});
 assert.deepEqual(reply.candidateLines,lines);
 assert.equal(reply.engineVerified,false);
});
