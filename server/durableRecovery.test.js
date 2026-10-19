'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { io } = require('socket.io-client');
const { createClient } = require('@supabase/supabase-js');
const { Chess } = require('chess.js');
const { createDurableStore } = require('./durableStore');

function event(socket, name, timeout = 10000, accept = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, done); reject(new Error('Missing event '+name)); }, timeout);
    function done(data) { if (!accept(data)) return; clearTimeout(timer); socket.off(name,done); resolve(data); }
    socket.on(name, done);
  });
}
async function until(work, timeout = 25000) {
  const end = Date.now()+timeout;
  while (Date.now()<end) { if (await work()) return; await delay(150); }
  throw new Error('Condition did not become true');
}

test('isolated PostgreSQL and fresh-process crash recovery', { skip: !process.env.DURABLE_TEST_DATABASE_URL, timeout: 150000 }, async t => {
  const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  const processes = new Set(), sockets = new Set();
  async function launch(enabled = 'true') {
    const child = fork(resolve(__dirname, 'test-support/durableServer.cjs'), [], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
        NODE_ENV: 'test', SUPABASE_URL: db.url, SUPABASE_ANON_KEY: 'local-test-anon-key',
        SUPABASE_SERVICE_KEY: 'local-test-service-key', DURABLE_ACTIVE_GAMES: enabled,
        SENTRY_DSN: '' }, silent: true, windowsHide: true,
    });
    processes.add(child);
    let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
    const message = await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw new Error('Child failed: '+output); }), delay(12000).then(() => { throw new Error('Child startup timed out: '+output); })]);
    return { child, port: message[0].port };
  }
  async function kill(proc) { const closed = once(proc.child, 'exit'); proc.child.kill('SIGKILL'); await closed; processes.delete(proc.child); }
  async function connect(proc, user) {
    const socket = io(`http://127.0.0.1:${proc.port}`, { transports: ['websocket'], auth: { accessToken: user }, reconnection: false });
    sockets.add(socket); await event(socket, 'connect'); return socket;
  }
  async function start(proc, isPrivate = false) {
    const a = await connect(proc, 'white'), b = await connect(proc, 'black');
    const pa = event(a,'match_found'), pb = event(b,'match_found');
    if (isPrivate) {
      const created = event(a,'private_room_created'); a.emit('create_private_room', { timeControl: '15+10' });
      b.emit('join_private_room', { roomId: (await created).roomId });
    } else { a.emit('join_queue'); b.emit('join_queue'); }
    const [ra, rb] = await Promise.all([pa,pb]);
    return { a, b, roomId: ra.roomId, white: ra.color === 'w' ? a : b, black: ra.color === 'b' ? a : b,
      whiteUser: ra.color === 'w' ? 'white' : 'black', blackUser: ra.color === 'b' ? 'white' : 'black', colors: [ra.color,rb.color] };
  }
  async function move(game, color, san) {
    const ply = (game.ply ?? 0) + 1;
    const updated = event(game[color], 'update_board', 10000, data => data.history?.length === ply);
    game[color].emit('make_move', { roomId: game.roomId, move: san });
    const data = await updated; game.ply = ply; return data;
  }
  async function row(roomId) { return (await db.pool.query('SELECT * FROM public.durable_games WHERE room_id=$1', [roomId])).rows[0]; }
  async function resync(socket, roomId) { const data = event(socket,'reconnect_success'); socket.emit('reconnect_game',{roomId}); return data; }
  let proc, game, last;
  try {
    await t.test('RLS and actual permission denial on every browser table operation and RPC', async () => {
      for (const role of ['anon','authenticated']) {
        const c = await db.pool.connect();
        try {
          await c.query('SET ROLE '+role);
          for (const sql of ['SELECT * FROM public.durable_games', 'INSERT INTO public.durable_games DEFAULT VALUES',
            "UPDATE public.durable_games SET revision=revision+1", 'DELETE FROM public.durable_games',
            "SELECT public.durable_game_transition('scan',NULL,NULL,NULL,NULL,NULL,NULL,NULL)"]) {
            await assert.rejects(c.query(sql), error => error.code === '42501');
          }
        } finally { await c.query('RESET ROLE'); c.release(); }
      }
      const check = await db.pool.query(`SELECT relrowsecurity FROM pg_class WHERE oid='public.durable_games'::regclass`);
      assert.equal(check.rows[0].relrowsecurity, true);
      assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM pg_policies WHERE tablename='durable_games'")).rows[0].n,0);
    });
    proc = await launch();
    await t.test('storage failure rejects startup and readiness, without a game_start', async () => {
      const a = await connect(proc,'white'), b = await connect(proc,'black');
      let started = false; a.on('game_start',()=>{started=true;});
      db.controls.failOperation = 'start';
      const failed = event(a,'join_failed'); a.emit('join_queue'); b.emit('join_queue');
      assert.equal((await failed).reason,'storage_unavailable'); assert.equal(started,false);
      assert.equal((await fetch(`http://127.0.0.1:${proc.port}/health`)).status,503);
      db.controls.failOperation = null; a.disconnect(); b.disconnect();
      await until(async () => (await fetch(`http://127.0.0.1:${proc.port}/health`)).status === 200);
    });
    await t.test('matchmaking and private starts exist durably before start events, with stable match IDs', async () => {
      game = await start(proc, true);
      const durable = await row(game.roomId);
      assert.equal(durable.state.timeControl,'15+10'); assert.ok(durable.match_id);
      assert.deepEqual(game.colors.slice().sort(),['b','w']);
      const queueGame = await start(proc); assert.equal((await row(queueGame.roomId)).state.timeControl,'10+0');
      queueGame.a.disconnect(); queueGame.b.disconnect();
    });
    await t.test('commit failure blocks acceptance and ambiguous acknowledgement applies a move once', async () => {
      db.controls.failOperation = 'commit';
      const rejected = event(game.white,'move_rejected'); game.white.emit('make_move',{roomId:game.roomId,move:'e4'});
      assert.equal((await rejected).reason,'storage_unavailable'); assert.deepEqual((await row(game.roomId)).state.moves,[]);
      db.controls.failOperation = null;
      await until(async () => (await fetch(`http://127.0.0.1:${proc.port}/health`)).status === 200);
      await resync(game.white,game.roomId);
      db.controls.loseAcknowledgement = true;
      last = await move(game,'white','e4');
      assert.deepEqual(last.history,['e4']); assert.deepEqual((await row(game.roomId)).state.moves,['e4']);
      assert.equal(Number((await row(game.roomId)).revision),1);
    });
    await t.test('serialized repeated actions, draw transitions and stale owner are rejected', async () => {
      const offer = event(game.black,'draw_offer_received'), rejected = event(game.white,'game_action_rejected');
      game.white.emit('draw_offer',{roomId:game.roomId}); game.white.emit('draw_offer',{roomId:game.roomId});
      await offer; assert.equal((await rejected).reason,'duplicate_draw_offer');
      const declined = event(game.white,'draw_offer_declined'); game.black.emit('draw_decline',{roomId:game.roomId}); await declined;
      const other = createDurableStore(createClient(db.url,'local-test-service-key'));
      await assert.rejects(other.write('commit',await row(game.roomId),(await row(game.roomId)).state),e=>e.code==='ownership_lost');
      await assert.rejects(other.claim(await row(game.roomId)),e=>e.code==='owned_elsewhere');
    });
    await t.test('a committed ending with lost acknowledgement notifies both live clients once after recovery', async () => {
      const match = await start(proc), notices = { white: 0, black: 0 };
      for (const color of ['white', 'black']) match[color].on('game_over', () => { notices[color]++; });
      const whiteOver = event(match.white, 'game_over'), blackOver = event(match.black, 'game_over');
      db.controls.loseAcknowledgement = true;
      db.controls.failOperation = 'read'; // Also lose the exceptional commit-confirmation read.
      const rejected = event(match.white, 'game_action_rejected');
      match.white.emit('resign_game', { roomId: match.roomId });
      assert.equal((await rejected).reason, 'storage_unavailable');
      assert.equal((await row(match.roomId)).state.status, 'ended');
      assert.deepEqual(notices, { white: 0, black: 0 });
      db.controls.failOperation = null;
      const outcomes = await Promise.all([whiteOver, blackOver]);
      assert.ok(outcomes.every(outcome => outcome.reason === 'resignation'));
      await resync(match.white, match.roomId); await resync(match.black, match.roomId);
      assert.deepEqual(notices, { white: 1, black: 1 });
      match.a.disconnect(); match.b.disconnect();
    });
    await t.test('several moves survive SIGKILL and a fresh process, with clocks, colours, and en passant intact', async () => {
      last = await move(game,'black','a6'); last = await move(game,'white','e5'); last = await move(game,'black','d5');
      const before = await row(game.roomId), oldPid = proc.child.pid;
      await kill(proc); // No shutdown hook, export, or memory transfer.
      const downtimeStarted = Date.now();
      proc = await launch(); assert.notEqual(proc.child.pid,oldPid);
      await until(async()=> { const r=await row(game.roomId); return r.owner_id!==before.owner_id; });
      const w = await connect(proc,game.whiteUser), b = await connect(proc,game.blackUser);
      const [ws,bs] = await Promise.all([resync(w,game.roomId),resync(b,game.roomId)]);
      assert.deepEqual(ws.history,['e4','a6','e5','d5']); assert.deepEqual(ws.history,bs.history);
      assert.equal(ws.color,'w'); assert.equal(bs.color,'b'); assert.equal(ws.fen,last.fen);
      assert.ok(ws.whiteTime <= last.whiteTime - Math.floor((Date.now()-downtimeStarted)/1000)+2);
      assert.ok(Math.abs(ws.blackTime-last.blackTime)<=1);
      const restored = await row(game.roomId);
      assert.equal(restored.state.disconnects.w.deadline,null); assert.equal(restored.state.disconnects.b.deadline,null);
      assert.equal(restored.state.lastMoveTimestamp,before.state.lastMoveTimestamp);
      game.white=w; game.black=b;
      last=await move(game,'white','exd6'); assert.equal(last.history.at(-1),'exd6');
      const afterMove=await row(game.roomId);
      assert.equal(afterMove.state.whiteTimeMs, restored.state.whiteTimeMs
        - (afterMove.state.lastMoveTimestamp-restored.state.lastMoveTimestamp)+10000);
      const stale = createDurableStore(createClient(db.url,'local-test-service-key'),before.owner_id);
      await assert.rejects(stale.write('commit',before,before.state),e=>e.code==='ownership_lost');
    });
    await t.test('authenticated membership rejects a room-ID-only reconnect', async () => {
      const stranger = await connect(proc,'stranger');
      const rejected = event(stranger,'reconnect_failed'); stranger.emit('reconnect_game',{roomId:game.roomId});
      assert.equal((await rejected).reason,'not_a_player'); stranger.disconnect();
    });
    await t.test('a recorded disconnect is durably cleared before grace expires', async () => {
      game.black.disconnect();
      await until(async()=> (await row(game.roomId)).state.disconnects.b.deadline !== null);
      const replacement=await connect(proc,game.blackUser);
      const state=await resync(replacement,game.roomId); assert.equal(state.color,'b');
      assert.equal((await row(game.roomId)).state.disconnects.b.deadline,null);
      game.black=replacement;
    });
    await t.test('50 accepted move transitions are measured over the real RPC/SQL path', async () => {
      const samples=[]; let match=await start(proc), chess=new Chess();
      for (let i=0;i<50;i++) {
        await delay(110); // Keep the unchanged 5/sec per-player limiter enabled.
        if (chess.isGameOver()) { match.a.disconnect();match.b.disconnect(); match=await start(proc);chess=new Chess(); }
        const legal=chess.moves({verbose:true});
        const selected=legal.find(m=>m.piece==='p') ?? legal.find(m=>m.captured) ?? legal[i%legal.length];
        const color=chess.turn()==='w'?'white':'black';
        const start=performance.now(); const data=await move(match,color,selected.san); samples.push(performance.now()-start);
        chess.move(selected.san); assert.equal(data.fen,chess.fen());
      }
      samples.sort((a,b)=>a-b);
      t.diagnostic(JSON.stringify({ measurement:'local_socket_move_to_ack_ms',samples:50,p50:samples[24],p95:samples[47] }));
      match.a.disconnect();match.b.disconnect();
    });
    await t.test('terminal handoff survives crash during result persistence and drains with flag off', async () => {
      db.controls.failMatches=true;
      const ended=event(game.white,'game_over'); game.white.emit('resign_game',{roomId:game.roomId}); await ended;
      const terminal=await row(game.roomId); assert.equal(terminal.state.status,'ended'); assert.equal(terminal.result_saved,false);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches WHERE id=$1',[terminal.match_id])).rows[0].n,0);
      await kill(proc); db.controls.failMatches=false;
      proc=await launch('false');
      await until(async()=> (await row(game.roomId)).result_saved);
      const tombstone=await row(game.roomId); assert.equal(tombstone.state.moves,undefined);
      assert.deepEqual(Object.keys(tombstone.state).sort(),['outcome','status','userIds']);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches WHERE id=$1',[terminal.match_id])).rows[0].n,1);
      // A second process has no in-memory ended room and reads the tombstone.
      const fresh=await launch('false'), w=await connect(fresh,game.whiteUser);
      const over=event(w,'game_over'); const state=await resync(w,game.roomId); await over;
      assert.equal(state.status,'ended'); assert.deepEqual(state.history,['e4','a6','e5','d5','exd6']);
      await kill(fresh);
    });
    await t.test('crash after atomic result commit but before its response leaves one row and no duplicate history', async () => {
      const active=await launch(), match=await start(active), current=await row(match.roomId);
      db.controls.holdMatchResponse=true;
      const ended=event(match.white,'game_over');match.white.emit('resign_game',{roomId:match.roomId});await ended;
      await until(async()=> (await row(match.roomId)).result_saved);
      assert.equal((await row(match.roomId)).state.moves,undefined);
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches WHERE id=$1',[current.match_id])).rows[0].n,1);
      await kill(active);db.controls.holdMatchResponse=false;
      const fresh=await launch('false'), w=await connect(fresh,match.whiteUser);
      assert.equal((await resync(w,match.roomId)).status,'ended');
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches WHERE id=$1',[current.match_id])).rows[0].n,1);
      await kill(fresh);
    });
    await t.test('flag off preserves volatile starts while existing durable games continue recovering', async () => {
      const volatile=await start(proc);
      assert.equal(await row(volatile.roomId),undefined);
      const board=await move(volatile,'white','e4'); assert.deepEqual(board.history,['e4']);
      assert.equal(await row(volatile.roomId),undefined);
      volatile.a.disconnect();volatile.b.disconnect();
    });
    await t.test('database CAS accepts one simultaneous revision and rejects resurrection and unconfirmed retention cleanup', async () => {
      const store=createDurableStore(createClient(db.url,'local-test-service-key'));
      const durable=await row(game.roomId);
      const state={...durable.state,initialFen:new Chess().fen(),moves:[],timeControl:'10+0',initialTime:600,increment:0,
        whiteTimeMs:600000,blackTimeMs:600000,lastMoveTimestamp:Date.now(),startedAt:new Date().toISOString(),status:'active',drawOfferBy:null,
        disconnects:{w:{disconnectedAt:null,deadline:null},b:{disconnectedAt:null,deadline:null}}};
      delete state.outcome; delete state.completedAt;
      const started=await store.write('start',{room_id:randomUUID(),match_id:randomUUID(),revision:0,fence:1},state);
      const attempts=await Promise.allSettled([
        store.write('commit',started,{...state,drawOfferBy:'w'}),store.write('commit',started,{...state,drawOfferBy:'b'})]);
      assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(attempts.find(r=>r.status==='rejected').reason.code,'revision_conflict');
      const current=await store.read(started.room_id);
      const ended=await store.write('commit',current,{...current.state,status:'ended',outcome:{reason:'draw_agreement',result:'1/2-1/2',winnerColor:null,endedBy:'w'},completedAt:new Date().toISOString()});
      await assert.rejects(store.write('commit',ended,state),e=>e.code==='invalid_transition');
      await assert.rejects(store.write('ack',ended,null),e=>e.code==='result_unconfirmed');
      assert.ok((await row(started.room_id)).state.moves);
      const insert=`INSERT INTO public.matches(id,source_room_id,white_id,black_id,status,result,
        termination_reason,time_control,initial_time,increment,fen,initial_fen,final_fen,pgn,created_at,completed_at)
        VALUES($1,$2,$3,$4,'completed','1/2-1/2','draw_agreement','10+0',600,0,$5,$5,$5,'',$6,$7)`;
      for(const source of [randomUUID(),started.room_id]) {
        await db.pool.query(insert,[started.match_id,source,state.userIds.w,state.userIds.b,state.initialFen,state.startedAt,ended.state.completedAt]);
        if(source!==started.room_id) {
          await assert.rejects(store.write('complete',ended,{finalFen:state.initialFen,pgn:''}),e=>e.code==='23505');
          assert.equal((await row(started.room_id)).result_saved,false);
          // Remove only this intentionally conflicting row in the isolated fixture.
          await db.pool.query('DELETE FROM public.matches WHERE id=$1',[started.match_id]);
        } else {
          const saved=await store.write('complete',ended,{finalFen:state.initialFen,pgn:''});
          assert.equal(saved.result_saved,true);assert.equal(saved.state.moves,undefined);
          const repeated=await store.write('complete',ended,{finalFen:state.initialFen,pgn:''});
          assert.equal(repeated.result_saved,true);
          assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches WHERE id=$1',[started.match_id])).rows[0].n,1);
        }
      }
    });
    await t.test('recorded deadlines and clock expiry are recovered; repetition is replayed from the initial position', async () => {
      const store=createDurableStore(createClient(db.url,'local-test-service-key'));
      const initialFen=new Chess().fen(), now=Date.now();
      const base={userIds:{w:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222'},
        initialFen,moves:[],timeControl:'10+0',initialTime:600,increment:0,whiteTimeMs:600000,blackTimeMs:600000,
        lastMoveTimestamp:now,startedAt:new Date(now-60000).toISOString(),status:'active',drawOfferBy:null,
        disconnects:{w:{disconnectedAt:null,deadline:null},b:{disconnectedAt:null,deadline:null}}};
      const cases=[
        {...base,whiteTimeMs:1,lastMoveTimestamp:now-1000},
        {...base,disconnects:{...base.disconnects,b:{disconnectedAt:now-31000,deadline:now-1000}}},
        {...base,moves:['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1']},
        {...base,whiteTimeMs:1,lastMoveTimestamp:now-1000,
          disconnects:{...base.disconnects,b:{disconnectedAt:now-35000,deadline:now-5000}}},
        {...base,moves:['e4','e5','Nf3','Nc6','Bc4','Nf6']},
        {...base,initialFen:'7k/P7/8/8/8/8/8/7K w - - 0 1'},
      ];
      const rows=[];
      for(const state of cases) rows.push(await store.write('start',{room_id:randomUUID(),match_id:randomUUID(),fence:1,revision:0},state));
      // Test-only expiry acceleration for these seeded fixtures; the SIGKILL
      // recovery above waits for the real 15-second ownership lease.
      await db.pool.query("UPDATE public.durable_games SET lease_until=clock_timestamp()-interval '1 second' WHERE owner_id=$1",[store.ownerId]);
      await until(async()=> (await row(rows[0].room_id)).state.status==='ended' && (await row(rows[1].room_id)).state.status==='ended');
      assert.equal((await row(rows[0].room_id)).state.outcome.reason,'timeout');
      assert.equal((await row(rows[1].room_id)).state.outcome.endedBy,'b');
      await until(async()=> (await row(rows[3].room_id)).state.status==='ended');
      assert.equal((await row(rows[3].room_id)).state.outcome.endedBy,'b');
      const b=await connect(proc,'black'); await until(async()=> (await row(rows[2].room_id)).owner_id!==store.ownerId);
      const state=await resync(b,rows[2].room_id); assert.equal(state.color,'b'); assert.equal(state.history.length,7);
      const over=event(b,'game_over'); b.emit('make_move',{roomId:rows[2].room_id,move:'Ng8'});
      assert.equal((await over).reason,'draw');
      for(const [index,san] of [[4,'O-O'],[5,'a8=Q+']]) {
        const w=await connect(proc,'white');
        await until(async()=> (await row(rows[index].room_id)).owner_id!==store.ownerId);
        await resync(w,rows[index].room_id);
        const board=event(w,'update_board'); w.emit('make_move',{roomId:rows[index].room_id,move:san});
        assert.equal((await board).history.at(-1),san);
      }
    });
  } finally {
    for(const socket of sockets) socket.disconnect();
    for(const child of processes) { const exited=once(child,'exit');child.kill('SIGKILL');await exited; }
    await db.close();
  }
});
