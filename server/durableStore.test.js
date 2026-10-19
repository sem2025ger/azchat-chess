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

test('flag off keeps volatile availability when the migration is absent or its RPC is broken', async () => {
  let at=0;
  const options={enabled:false,rooms:new Map(),socketToRoom:new Map(),io:{},now:()=>at,log:()=>{},getMatchPersistence:()=>({})};
  for(const absent of [true,false]) {
    at=0; let scans=0;
    const manager=createDurableGames({...options,store:{
      scan:async()=>{scans++;throw Object.assign(new Error(),{code:'PGRST202'});},isUninstalled:async()=>absent,
    }});
    await manager.recover(); assert.equal(manager.ready(),true);
    at=5000; await manager.tick(); await new Promise(setImmediate);
    assert.equal(scans,absent?1:2,'only confirmed absence permits stopping periodic discovery');
  }
});

test('flag off and confirmed missing schema perform no periodic recovery scans', async () => {
  let at = 0, scans = 0, probes = 0;
  const manager = createDurableGames({ enabled: false, rooms: new Map(), socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      scan: async () => { scans++; throw Object.assign(new Error(), { code: 'PGRST202' }); },
      isUninstalled: async () => { probes++; return true; },
      write: async () => assert.fail('disabled starts must not write durable storage'),
    } });
  await manager.recover();
  const volatile = room(); await manager.start(volatile);
  assert.equal(manager.ready(), true); assert.equal(volatile.durable, undefined);
  for (at = 1000; at <= 180000; at += 1000) await manager.tick();
  assert.equal(scans, 1); assert.equal(probes, 1);
});

test('flag off and unknown database state back off to a bounded minute without blocking starts', async () => {
  let at = 0;
  const scannedAt = [];
  const manager = createDurableGames({ enabled: false, rooms: new Map(), socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      scan: async () => { scannedAt.push(at); throw new Error('offline'); },
      write: async () => assert.fail('volatile start must not write'),
    } });
  await manager.recover();
  for (at = 1000; at <= 195000; at += 1000) {
    await manager.tick(); await new Promise(setImmediate);
    assert.equal(manager.ready(), true);
    await manager.start(room());
  }
  assert.deepEqual(scannedAt, [0, 5000, 15000, 35000, 75000, 135000, 195000]);
});

test('flag off uses minute discovery for an installed empty schema and stays available after an outage', async () => {
  let at = 0, scans = 0, offline = false;
  const manager = createDurableGames({ enabled: false, rooms: new Map(), socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      scan: async () => { scans++; if (offline) throw new Error('offline'); return []; },
    } });
  await manager.recover(); offline = true;
  for (at = 1000; at < 60000; at += 1000) await manager.tick();
  assert.equal(scans, 1);
  await manager.tick(); await new Promise(setImmediate);
  assert.equal(scans, 2); assert.equal(manager.ready(), true);
  const volatile = room(); await manager.start(volatile); assert.equal(volatile.durable, undefined);
  offline = false; at = 65000;
  await manager.tick(); await new Promise(setImmediate);
  assert.equal(scans, 3); assert.equal(manager.ready(), true);
});

test('flag on rejects starts and readiness while the database is unavailable', async () => {
  let writes = 0;
  const manager = createDurableGames({ enabled: true, rooms: new Map(), socketToRoom: new Map(),
    io: {}, log: () => {}, getMatchPersistence: () => ({}), store: {
      scan: async () => { throw new Error('offline'); }, write: async () => { writes++; },
    } });
  await manager.recover(); assert.equal(manager.ready(), false);
  await assert.rejects(manager.start(room())); assert.equal(writes, 0);
});

test('flag off recovers an existing game after an initially unknown outage', async () => {
  let at = Date.now(), offline = true, claims = 0;
  const original = room(), ownerId = randomUUID(), rooms = new Map();
  const row = { room_id: original.roomId, match_id: randomUUID(), revision: 1, fence: 1,
    owner_id: randomUUID(), lease_until: new Date(0).toISOString(), state: snapshot(original), result_saved: false };
  const manager = createDurableGames({ enabled: false, rooms, socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      ownerId, scan: async () => { if (offline) throw new Error('offline'); return [row]; },
      claim: async value => { claims++; return { ...value, owner_id: ownerId, fence: 2, lease_until: new Date(at + 15000).toISOString() }; },
    } });
  await manager.recover(); assert.equal(manager.ready(), true); assert.equal(rooms.size, 0);
  offline = false; at += 5000;
  await manager.tick(); await new Promise(setImmediate);
  const recovered = rooms.get(original.roomId);
  assert.equal(claims, 1); assert.equal(recovered.durable, true);
  assert.equal(recovered.durableRow.fence, 2); assert.equal(recovered.status, 'active');
});

test('flag off drains a pending durable result after storage returns, with its stable match ID', async () => {
  let at = Date.now(), offline = true, completions = 0;
  const original = room(), ownerId = randomUUID(), rooms = new Map();
  original.status = 'ended'; original.completedAt = new Date(at).toISOString();
  original.outcome = { reason: 'resignation', result: '0-1', winnerColor: 'b', endedBy: 'w' };
  let row = { room_id: original.roomId, match_id: randomUUID(), revision: 1, fence: 1,
    owner_id: ownerId, lease_until: new Date(at + 15000).toISOString(), state: snapshot(original), result_saved: false };
  const manager = createDurableGames({ enabled: false, rooms, socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      ownerId, scan: async () => { if (offline) throw new Error('offline'); return [row]; },
      write: async (operation, previous) => {
        assert.equal(operation, 'complete'); assert.equal(previous.match_id, row.match_id); completions++;
        row = { ...row, result_saved: true, revision: 2 }; return row;
      },
    } });
  await manager.recover(); offline = false; at += 5000;
  await manager.tick();
  for (let i = 0; i < 10 && !rooms.get(original.roomId)?.persisted; i++) await new Promise(setImmediate);
  assert.equal(completions, 1); assert.equal(rooms.get(original.roomId).persisted, true);
  assert.equal(rooms.get(original.roomId).matchId, row.match_id);
});

test('flag off never abandons known other-owner games on a missing-schema response', async () => {
  let at = Date.now(), missing = false, scans = 0;
  const original = room();
  const manager = createDurableGames({ enabled: false, rooms: new Map(), socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      ownerId: randomUUID(),
      scan: async () => {
        scans++;
        if (missing) throw Object.assign(new Error(), { code: 'PGRST202' });
        return [{ room_id: original.roomId, owner_id: randomUUID(), result_saved: false,
          lease_until: new Date(at + 15000).toISOString() }];
      }, isUninstalled: async () => true,
    } });
  await manager.recover(); missing = true;
  for (let i = 0; i < 3; i++) { at += 5000; await manager.tick(); await new Promise(setImmediate); }
  assert.equal(scans, 4); assert.equal(manager.ready(), true);
});

test('flag off keeps a blocked durable room fenced while new volatile games remain available', async () => {
  const original = room(), events = [];
  original.durable = true; original.blocked = true;
  original.durableRow = { room_id: original.roomId, state: snapshot(original), result_saved: false };
  const socket = { id: 'white-socket', data: { userId: original.userIds.w, limiter: { allow: () => true } },
    emit: (name, data) => events.push({ name, data }) };
  const manager = createDurableGames({ enabled: false, rooms: new Map([[original.roomId, original]]),
    socketToRoom: new Map([[socket.id, original.roomId]]), io: {}, log: () => {},
    getMatchPersistence: () => ({}), store: { write: async () => assert.fail('blocked room must not write') } });
  await manager.action(socket, 'make_move', { roomId: original.roomId, move: 'e4' });
  assert.equal(events[0].data.reason, 'storage_unavailable'); assert.deepEqual(original.game.history(), []);
  assert.equal(manager.ready(), true);
  const volatile = room(); await manager.start(volatile); assert.equal(volatile.durable, undefined);
});

test('an authenticated reconnect wakes recovery for a game discovered during idle scanning', async () => {
  const at = Date.now(), original = room(), ownerId = randomUUID(), rooms = new Map();
  let rows = [], scans = 0;
  const row = { room_id: original.roomId, match_id: randomUUID(), revision: 0, fence: 1,
    owner_id: ownerId, lease_until: new Date(at + 15000).toISOString(), state: snapshot(original), result_saved: false };
  const events = [];
  const manager = createDurableGames({ enabled: false, rooms, socketToRoom: new Map(),
    io: {}, now: () => at, log: () => {}, getMatchPersistence: () => ({}), store: {
      ownerId, scan: async () => { scans++; return rows; }, read: async () => row,
    } });
  await manager.recover(); rows = [row];
  await manager.reconnect({ data: { userId: original.userIds.w, limiter: { allow: () => true } },
    emit: (name, data) => events.push({ name, data }) }, original.roomId);
  await new Promise(setImmediate);
  assert.equal(scans, 2); assert.equal(rooms.get(original.roomId).durable, true);
  assert.equal(events[0].data.reason, 'recovery_pending');
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
