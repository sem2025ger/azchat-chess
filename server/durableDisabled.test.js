'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');
const { io } = require('socket.io-client');

function event(emitter, name, accept = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { emitter.off(name, done); reject(new Error('Missing event ' + name)); }, 5000);
    function done(value) { if (!accept(value)) return; clearTimeout(timer); emitter.off(name, done); resolve(value); }
    emitter.on(name, done);
  });
}

test('disabled durability preserves HTTP and real socket starts during optional storage failures', { timeout: 30000 }, async t => {
  for (const initial of ['missing', 'offline', 'held', 'healthy']) {
    await t.test(initial, async () => {
      let mode = initial, child;
      const clients = [], held = new Set(), requests = [];
      let scanStarted;
      const firstScan = new Promise(resolve => { scanStarted = resolve; });
      const api = createServer(async (req, res) => {
        let body = '';
        for await (const part of req) body += part;
        const operation = body ? JSON.parse(body).p_operation : null;
        requests.push(operation ?? req.url);
        res.setHeader('content-type', 'application/json');
        if (operation === 'scan') {
          scanStarted();
          if (mode === 'held') { held.add(res); res.on('close', () => held.delete(res)); return; }
          if (mode === 'healthy') { res.end(JSON.stringify({ ok: true, rows: [] })); return; }
          res.writeHead(mode === 'missing' ? 404 : 503);
          res.end(JSON.stringify({ code: mode === 'missing' ? 'PGRST202' : '08006' }));
        } else {
          res.writeHead(404); res.end(JSON.stringify({ code: 'PGRST205' }));
        }
      });
      await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
      try {
        child = fork(resolve(__dirname, 'test-support/durableServer.cjs'), [], {
          env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
            NODE_ENV: 'test', SUPABASE_URL: `http://127.0.0.1:${api.address().port}`,
            SUPABASE_ANON_KEY: 'local-test-anon-key', SUPABASE_SERVICE_KEY: 'local-test-service-key',
            DURABLE_ACTIVE_GAMES: 'false', SENTRY_DSN: '' }, silent: true, windowsHide: true,
        });
        // Drain output without logging game data or allowing pipe backpressure.
        child.stdout.resume(); child.stderr.resume();
        const { port } = await event(child, 'message', data => Number.isInteger(data.port));
        await firstScan;
        if (initial === 'held') assert.equal(held.size, 1, 'HTTP must start before the optional scan completes');
        if (initial === 'healthy') {
          const done = event(child, 'message', data => data.type === 'recovered');
          child.send({ type: 'recover' }); await done;
          mode = 'offline'; // A new failure after a successful startup scan.
        }
        if (initial === 'held') {
          for (const res of held) { res.writeHead(503); res.end(JSON.stringify({ code: '08006' })); }
          mode = 'offline';
        }
        const recovered = event(child, 'message', data => data.type === 'recovered');
        child.send({ type: 'recover' }); await recovered;
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true, service: 'aztr-chess-server' });
        const connect = async user => {
          const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'],
            auth: { accessToken: user }, reconnection: false });
          clients.push(socket); await event(socket, 'connect'); return socket;
        };
        for (const isPrivate of [false, true]) {
          const a = await connect('white'), b = await connect('black');
          const pa = event(a, 'match_found'), pb = event(b, 'match_found');
          if (isPrivate) {
            const created = event(a, 'private_room_created'); a.emit('create_private_room');
            b.emit('join_private_room', { roomId: (await created).roomId });
          } else { a.emit('join_queue'); b.emit('join_queue'); }
          const [ra, rb] = await Promise.all([pa, pb]);
          assert.equal(ra.roomId, rb.roomId); assert.notEqual(ra.color, rb.color);
          const updated = event(b, 'update_board');
          (ra.color === 'w' ? a : b).emit('make_move', { roomId: ra.roomId, move: 'e4' });
          assert.deepEqual((await updated).history, ['e4']);
          a.disconnect(); b.disconnect();
        }
        assert.equal(requests.some(operation => operation === 'start' || operation === 'commit'), false);
      } finally {
        for (const socket of clients) socket.disconnect();
        if (child && child.exitCode === null && child.signalCode === null) {
          const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
        }
        for (const res of held) res.destroy();
        await new Promise(resolve => api.close(resolve));
      }
    });
  }
});
