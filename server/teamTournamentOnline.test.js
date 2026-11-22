'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { createTeamTournamentOnline } = require('./teamTournamentOnline');

test('online board readiness and ticks make no database calls while durable play is disabled', async () => {
  for (const durableEnabled of [false,true]) {
    const logged = [];
    const online = createTeamTournamentOnline({
      client: { rpc() { assert.fail('durable guard must run before SQL'); } },
      durableEnabled, durableGames:{ ready:() => !durableEnabled }, now:() => 1000,
      log: entry => logged.push(entry),
    });
    const socket = new EventEmitter();
    socket.data = { userId:randomUUID(),limiter:{ allow:() => true } };
    online.register(socket);
    const reply = request => new Promise(resolve => socket.emit('tournament_board_ready',request,resolve));
    assert.deepEqual(await reply({ matchId:'invalid',boardNo:1 }),{ code:'invalid_input' });
    assert.deepEqual(await reply({ matchId:randomUUID(),boardNo:1 }),{ code:'storage_unavailable' });
    await online.tick();
    assert.deepEqual(online.status(),{ online_play:true,durable:false });
    assert.deepEqual(logged,[{ code:'TOURNAMENT_ONLINE_REQUIRES_DURABLE' }]);
  }
});

test('default-off server never registers a tournament socket handler', async t => {
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = '';
  delete process.env.TEAM_TOURNAMENTS_ONLINE_PLAY;
  const { once } = require('node:events');
  const { io: connect } = require('socket.io-client');
  const runtime = require('./index');
  clearInterval(runtime.timeoutWatchdog);
  runtime.setTokenVerifier(async token => ({ id:token }));
  await new Promise(resolve => runtime.server.listen(0,'127.0.0.1',resolve));
  const client = connect('http://127.0.0.1:' + runtime.server.address().port,
    { transports:['websocket'],auth:{accessToken:randomUUID()},reconnection:false });
  t.after(async () => {
    client.disconnect();
    await new Promise(resolve => runtime.io.close(resolve));
  });
  await once(client,'connect',{ signal:AbortSignal.timeout(5000) });
  const socket = runtime.io.sockets.sockets.get(client.id);
  assert.equal(socket.listenerCount('tournament_board_ready'),0);
  assert.ok(socket.listenerCount('join_queue') > 0);
});
