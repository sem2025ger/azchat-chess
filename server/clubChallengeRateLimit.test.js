'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
process.env.NODE_ENV='test';process.env.SUPABASE_URL='https://fake-test.supabase.co';process.env.SUPABASE_ANON_KEY='local-test-anon';
const {io:connect}=require('socket.io-client');
const {registerClubChallenges}=require('./clubChallenges');
const {server,io,activeRooms,cleanupRoom,setTokenVerifier,startClubChallengeGame}=require('./index');
const ids={a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',club:'33333333-3333-4333-8333-333333333333',offer:'44444444-4444-4444-8444-444444444444'};
function next(socket,event){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Missing '+event)),4000);socket.once(event,value=>{clearTimeout(timer);resolve(value);});});}
test('real private-game bridge consumes acceptor limiter once; public payload cannot bypass it',async()=>{
 setTokenVerifier(async token=>({id:token}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const sockets=[];
 try{
  for(const user of [ids.a,ids.b]){const socket=connect('http://127.0.0.1:'+server.address().port,{transports:['websocket'],reconnection:false,auth:{accessToken:user}});sockets.push(socket);await next(socket,'connect');}
  const creator=[...io.sockets.sockets.values()].find(peer=>peer.data.userId===ids.a),acceptor=[...io.sockets.sockets.values()].find(peer=>peer.data.userId===ids.b);
  let checks=0;acceptor.data.limiter={allow(category){assert.equal(category,'lobby');return ++checks===1;}};creator.data.limiter={allow:()=>true};
  const query={select(){return this;},update(){return this;},eq(){return this;},abortSignal:async()=>({data:[{user_id:ids.a},{user_id:ids.b}],error:null})};
  const client={from:()=>query,rpc:()=>({abortSignal:async()=>({data:{ok:true,challenge:{id:ids.offer,club_id:ids.club,created_by:ids.a,time_control:'3+2'}},error:null})})};
  registerClubChallenges(acceptor,{client,io,allowedTimeControls:new Set(['3+2']),startGame:startClubChallengeGame});
  const found=sockets.map(socket=>next(socket,'match_found'));
  const handle=acceptor.listeners('club_challenge_accept').at(-1);
  const reply=await new Promise(resolve=>handle({challengeId:ids.offer},resolve));
  assert.equal(reply.ok,true);const [a,b]=await Promise.all(found);assert.equal(a.roomId,b.roomId);assert.equal(checks,1);
  assert.equal(activeRooms.get(a.roomId).isPrivate,true);assert.equal(activeRooms.get(a.roomId).initialTime,180);assert.equal(activeRooms.get(a.roomId).increment,2);
  cleanupRoom(a.roomId,activeRooms.get(a.roomId));
  const pending=next(sockets[0],'private_room_created');sockets[0].emit('create_private_room',{timeControl:'3+2'});const room=(await pending).roomId;
  const denied=next(sockets[1],'rate_limit_exceeded');sockets[1].emit('join_private_room',{roomId:room,limiterChecked:true});
  assert.equal((await denied).action,'join_private_room');assert.equal(checks,2,'public join still checks the limiter');
 }finally{for(const socket of sockets)socket.disconnect();for(const [id,room]of activeRooms)cleanupRoom(id,room);await new Promise(resolve=>io.close(resolve));}
});
