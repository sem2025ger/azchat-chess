'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connectSocket } = require('socket.io-client');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://cors-test.invalid';
process.env.SUPABASE_ANON_KEY = 'fake-anon-key';
process.env.SUPABASE_SERVICE_KEY = '';
process.env.FRONTEND_URL = 'https://configured-frontend.example';

const { server, io, setTokenVerifier } = require('./index');
const TEAM_PREVIEW = 'https://azchat-chess-405k296wy-semov20207-3068s-projects.vercel.app';
const PERMANENT_PREVIEW = 'https://chessaz-preview.vercel.app';
const UNTRUSTED = [
  'https://untrusted.example',
  'https://azchat-chess-evil.vercel.app',
  'https://azchat-chess-405k296wy-other-team.vercel.app',
  `${TEAM_PREVIEW}.evil.example`,
  'https://azchat-chess-405k296wy-semov20207-3068s-projects.vercel.app@evil.example',
  TEAM_PREVIEW.replace('https:', 'http:'),
];
let baseUrl;
let verifierCalls = 0;

test.before(async () => {
  setTokenVerifier(async (token) => { verifierCalls++; return { id: token }; });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => io.close(resolve));
});

test('CORS: approved exact origins and verified team previews receive allow-origin headers', async () => {
  for (const origin of [
    'https://chessaz.de', 'https://www.chessaz.de',
    'http://localhost:5173', 'http://127.0.0.1:5173',
    process.env.FRONTEND_URL, PERMANENT_PREVIEW, TEAM_PREVIEW,
    'https://azchat-chess-git-main-semov20207-3068s-projects.vercel.app',
  ]) {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.deepEqual(await response.json(), { ok: true, service: 'aztr-chess-server' });
  }
});

test('CORS: disallowed and lookalike origins produce no 500 and no allow-origin header', async () => {
  for (const origin of UNTRUSTED) {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), null, origin);
    assert.deepEqual(await response.json(), { ok: true, service: 'aztr-chess-server' });
  }
});

test('CORS: requests without Origin continue to work', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('CORS: preflight reflects an approved origin and omits CORS headers for an untrusted origin', async () => {
  for (const origin of [PERMANENT_PREVIEW, UNTRUSTED[1]]) {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
    });
    assert.ok(response.status < 500);
    assert.equal(response.headers.get('access-control-allow-origin'), origin === PERMANENT_PREVIEW ? origin : null);
  }
});

test('CORS: polling handshakes reject untrusted origins with 403 before socket authentication', async () => {
  const callsBefore = verifierCalls;
  for (const origin of UNTRUSTED) {
    const response = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: origin },
    });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await response.json()).code, 4); // Engine.IO FORBIDDEN.
  }
  assert.equal(verifierCalls, callsBefore);
});

function socketHandshake(origin, transport) {
  return new Promise((resolve) => {
    const socket = connectSocket(baseUrl, {
      transports: [transport], reconnection: false, forceNew: true, timeout: 2000,
      auth: { accessToken: '11111111-1111-4111-8111-111111111111' },
      ...(origin === undefined ? {} : { extraHeaders: { Origin: origin } }),
    });
    socket.once('connect', () => { socket.close(); resolve('connected'); });
    socket.once('connect_error', () => { socket.close(); resolve('rejected'); });
  });
}

test('CORS: WebSocket handshakes reject untrusted origins before socket authentication', async () => {
  const callsBefore = verifierCalls;
  for (const origin of UNTRUSTED) {
    assert.equal(await socketHandshake(origin, 'websocket'), 'rejected', origin);
  }
  assert.equal(verifierCalls, callsBefore);
});

test('CORS: approved origins and no-Origin clients connect through polling and WebSocket', async () => {
  for (const transport of ['polling', 'websocket']) {
    for (const origin of [TEAM_PREVIEW, PERMANENT_PREVIEW, undefined]) {
      assert.equal(await socketHandshake(origin, transport), 'connected', `${transport}: ${origin}`);
    }
  }
});
