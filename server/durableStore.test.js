'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Chess } = require('chess.js');
const { createDurableStore } = require('./durableStore');
const { snapshot, restore, clocks, createDurableGames } = require('./durableGames');
const { createSocketRateLimiter } = require('./rateLimiter');
const { classifyPersistenceError } = require('./matchPersistence');

function room() {
  return { roomId: randomUUID(), game: new Chess(), userIds: { w: randomUUID(), b: randomUUID() },
    initialFen: new Chess().fen(), status: 'active', startedAt: new Date().toISOString(),
    timeControl: '10+0', initialTime: 600, increment: 0, whiteTimeMs: 600000,
    blackTimeMs: 600000, lastMoveTimestamp: Date.now(), drawOfferBy: null,
    disconnects: { w: { disconnectedAt: null, deadline: null, timer: {} }, b: { disconnectedAt: null, deadline: null } },
    players: { w: 'white-socket', b: 'black-socket' }, socketIds: new Set(), token: 'never persist' };
}

test('durable snapshot excludes transient credentials and replays complete repetition history', () => {
  const original = room();
  for (const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) original.game.move(move);
  const state = snapshot(original);
  assert.equal(state.token, undefined); assert.equal(state.players, undefined);
  assert.equal(state.disconnects.w.timer, undefined);
  const recovered = restore({ room_id: original.roomId, match_id: randomUUID(), state, result_saved: false });
  assert.equal(recovered.game.fen(), original.game.fen());
  assert.equal(recovered.game.isThreefoldRepetition(), true);
  assert.deepEqual(recovered.players, { w: null, b: null });
});

test('durable replay preserves castling, en passant and promotion', () => {
  for (const [fen, moves, next] of [
    [new Chess().fen(), ['e4','e5','Nf3','Nc6','Bc4','Nf6'], 'O-O'],
    [new Chess().fen(), ['e4','a6','e5','d5'], 'exd6'],
    ['7k/P7/8/8/8/8/8/7K w - - 0 1', [], 'a8=Q+'],
  ]) {
    const original = room(); original.initialFen = fen; original.game = new Chess(fen);
    for (const m of moves) original.game.move(m);
    const recovered = restore({ room_id: original.roomId, state: snapshot(original) });
    assert.equal(recovered.game.move(next).san, next);
  }
});

test('wall-clock snapshots count downtime once and leave the reference unchanged', () => {
  const original = room(); original.lastMoveTimestamp = 1000;
  assert.deepEqual(clocks(original, 6100), { whiteTime: 595, blackTime: 600 });
  assert.deepEqual(clocks(original, 6100), { whiteTime: 595, blackTime: 600 });
  assert.equal(original.whiteTimeMs, 600000); assert.equal(original.lastMoveTimestamp, 1000);
});

test('RPC transition is one request; an ambiguous acknowledgement is checked without replay', async () => {
  const owner = randomUUID(), calls = [];
  let committed;
  const client = { rpc(name, args) {
    calls.push(args.p_operation);
    return { abortSignal: async () => {
      if (args.p_operation === 'read') return { data: { ok: true, row: committed } };
      committed = { room_id: args.p_room_id, revision: 5, fence: 2, owner_id: owner,
        last_request: args.p_request_id, lease_until: new Date(Date.now() + 15000).toISOString() };
      throw new Error('lost acknowledgement');
    } };
  } };
  const store = createDurableStore(client, owner);
  const result = await store.write('commit', { room_id: randomUUID(), revision: 4, fence: 2 }, {});
  assert.equal(result, committed); assert.deepEqual(calls, ['commit','read']);
  calls.length = 0;
  client.rpc = (_, args) => { calls.push(args.p_operation); return { abortSignal: async () => ({ data: { ok: true, row: committed } }) }; };
  await store.write('commit', { room_id: randomUUID(), revision: 4, fence: 2 }, {});
  assert.deepEqual(calls, ['commit']);
});

test('startup failure is rejected, and disabling new durable starts never writes a volatile room', async () => {
  const rooms = new Map();
  const options = { rooms, socketToRoom: new Map(), io: {}, getMatchPersistence: () => ({}), log: () => {} };
  const enabled = createDurableGames({ ...options, enabled: true, store: null });
  await enabled.recover(); assert.equal(enabled.ready(), false);
  await assert.rejects(enabled.start(room()));
  const disabled = createDurableGames({ ...options, enabled: false, store: null });
  await disabled.recover(); assert.equal(disabled.ready(), true);
  const volatile = room(); await disabled.start(volatile); assert.equal(volatile.durable, undefined);
});

test('failed commit leaves chess state unchanged and blocks further acceptance', async () => {
  const original = room(); original.durable = true; original.durableRow = { room_id: original.roomId, state: snapshot(original) };
  const rooms = new Map([[original.roomId, original]]), events = [];
  const socket = { id: 'white-socket', data: { userId: original.userIds.w, limiter: { allow: () => true } }, emit: (name, data) => events.push({ name, data }) };
  const manager = createDurableGames({ rooms, socketToRoom: new Map([[socket.id,original.roomId]]), io: {},
    store: { write: async () => { throw new Error('offline'); } }, getMatchPersistence: () => ({}),
    naturalGameOver: () => null, log: () => {} });
  await manager.action(socket, 'make_move', { roomId: original.roomId, move: 'e4' });
  assert.deepEqual(original.game.history(), []); assert.equal(original.blocked, true);
  assert.equal(events[0].data.reason, 'storage_unavailable');
});

test('an unresolved ambiguous RPC is never blindly retried', async () => {
  const calls=[];
  const store=createDurableStore({rpc:(_,args)=>{ calls.push(args.p_operation);
    return {abortSignal:async()=>{throw new Error('network unavailable');}};
  }});
  await assert.rejects(store.write('commit',{room_id:randomUUID(),revision:0,fence:1},{}));
  assert.deepEqual(calls,['commit','read']);
});

test('an expired lease reacquired by the same process installs the new fence', async () => {
  const original=room(), ownerId=randomUUID();
  original.durable=true;
  original.durableRow={room_id:original.roomId,match_id:randomUUID(),owner_id:ownerId,
    revision:0,fence:1,lease_until:new Date(0).toISOString(),state:snapshot(original),result_saved:false};
  const rooms=new Map([[original.roomId,original]]);
  const manager=createDurableGames({store:{ownerId,scan:async()=>[original.durableRow],
    claim:async row=>({...row,fence:2,lease_until:new Date(Date.now()+15000).toISOString()})},
    rooms,socketToRoom:new Map(),io:{to:()=>({emit:()=>{}})},getMatchPersistence:()=>({}),naturalGameOver:()=>null});
  await manager.recover(); assert.equal(rooms.get(original.roomId).durableRow.fence,2);
});

test('an unresolved retention acknowledgement reconciles a tombstone omitted from recovery scan', async () => {
  const original=room(); original.status='ended';original.durable=true;original.blocked=true;
  const saved={room_id:original.roomId,result_saved:true,state:{status:'ended',userIds:original.userIds,outcome:{result:'1-0'}}};
  const rooms=new Map([[original.roomId,original]]);
  const manager=createDurableGames({store:{scan:async()=>[],read:async()=>saved},rooms,
    socketToRoom:new Map(),io:{},getMatchPersistence:()=>({}),naturalGameOver:()=>null});
  await manager.recover();
  assert.equal(manager.ready(),true);assert.equal(original.blocked,false);assert.equal(original.persisted,true);
  assert.equal(original.durableRow.result_saved,true);
});

test('flag off tolerates absent migration only after confirming the durable table is absent', async () => {
  const options={enabled:false,rooms:new Map(),socketToRoom:new Map(),io:{},log:()=>{},getMatchPersistence:()=>({})};
  for(const absent of [true,false]) {
    const manager=createDurableGames({...options,store:{
      scan:async()=>{throw Object.assign(new Error(),{code:'PGRST202'});},isUninstalled:async()=>absent,
    }});
    await manager.recover(); assert.equal(manager.ready(),absent);
  }
});

test('queued durable mutations enforce the unchanged rate bucket at arrival time', async () => {
  const original=room();original.durable=true;
  original.durableRow={room_id:original.roomId,match_id:randomUUID(),revision:0,fence:1,state:snapshot(original)};
  let release;const gate=new Promise(resolve=>{release=resolve;});const events=[];
  const socket={id:'white-socket',data:{userId:original.userIds.w,limiter:createSocketRateLimiter()},emit:(name,data)=>events.push({name,data})};
  const manager=createDurableGames({rooms:new Map([[original.roomId,original]]),
    socketToRoom:new Map([[socket.id,original.roomId]]),io:{to:()=>({emit:()=>{}})},
    store:{write:async(_,row,state)=>{await gate;return {...row,revision:1,state,result_saved:false};}},
    getMatchPersistence:()=>({}),naturalGameOver:()=>null});
  const actions=Array.from({length:6},()=>manager.action(socket,'draw_offer',{roomId:original.roomId}));
  try {assert.equal(events.filter(e=>e.data.reason==='rate_limit_exceeded').length,1);}
  finally {release();await Promise.all(actions);}
});

test('new database reconnect lookups use the existing lobby budget without charging game actions', async () => {
  let lookups=0;const events=[];
  const socket={data:{userId:randomUUID(),limiter:createSocketRateLimiter()},emit:(name,data)=>events.push({name,data})};
  const manager=createDurableGames({rooms:new Map(),socketToRoom:new Map(),io:{},log:()=>{},getMatchPersistence:()=>({}),
    store:{read:async()=>{lookups++;throw Object.assign(new Error(),{code:'not_found'});}}});
  await Promise.all(Array.from({length:6},()=>manager.reconnect(socket,randomUUID())));
  assert.equal(lookups,5);assert.equal(events.filter(e=>e.data.reason==='rate_limit_exceeded').length,1);
  assert.equal(socket.data.limiter.allow('game_action'),true);
});

test('RPC errors preserve HTTP retry classification without exposing database payloads', async () => {
  for(const [status,code,classification] of [[429,'','transient'],[503,'','transient'],
    [401,'','permanent'],[403,'42501','permanent'],[503,'23505','permanent']]) {
    const store=createDurableStore({rpc:()=>({abortSignal:async()=>({status,error:{code,message:'private database payload'}})})});
    await assert.rejects(store.write('complete',{room_id:randomUUID(),revision:1,fence:1},{}),error=>{
      assert.equal(error.status,status);assert.equal(classifyPersistenceError(error),classification);
      assert.equal(error.message.includes('private database payload'),false);return true;
    });
  }
});
