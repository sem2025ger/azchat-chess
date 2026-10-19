import assert from 'node:assert/strict';

export const secret = 'PRIVATE_SECRET_SENTINEL';
export const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcml2YXRlIn0.secretSignature';
export function hostileEvent() {
  const privateData = {
    access_token: jwt, refresh_token: secret, authorization: 'Bearer ' + jwt,
    cookie: 'session=' + secret, email: 'private@example.com', username: secret,
    user_id: secret, playerId: secret, matchId: secret, pgn: secret,
    chat: secret, session: { user: { id: secret }, access_token: jwt },
  };
  const event = {
    event_id: 'a'.repeat(32), timestamp: 1000, level: 'error',
    environment: 'test', release: '0'.repeat(40),
    message: secret + ' ' + jwt + ' private@example.com 1. e4 e5',
    user: privateData, server_name: secret, transaction: secret, culprit: secret,
    logentry: { formatted: secret }, tags: privateData, extra: { deeply: [privateData] },
    contexts: { supabase: privateData, trace: { data: privateData }, react: privateData },
    request: {
      url: 'https://user:password@chessaz.de/play?access_token=' + jwt + '#refresh_token=' + secret,
      method: 'GET', headers: privateData, cookies: privateData, data: privateData,
      query_string: secret, fragment: secret,
    },
    exception: { values: [{
      type: 'TypeError', value: secret + jwt, mechanism: { data: privateData },
      stacktrace: { frames: [{
        filename: 'https://chessaz.de/assets/index-ABC.js?token=' + jwt + '#' + secret,
        lineno: 12, colno: 3, in_app: true, function: secret,
        vars: privateData, context_line: secret, pre_context: [secret], post_context: [secret],
      }] },
    }] },
    breadcrumbs: [
      { category: 'console', message: secret, data: privateData },
      { category: 'navigation', data: { from: secret, to: secret } },
      { category: 'ui.click', message: secret },
      { category: 'fetch', timestamp: 10, message: secret, data: {
        url: 'https://chessaz-api.onrender.com/health?token=' + jwt + '#' + secret,
        method: 'GET', status_code: 500, ...privateData,
      } },
    ],
  };
  // Event fields contain cycles in unknown data: sanitization must neither
  // serialize them nor mutate the original event.
  event.extra.cycle = event;
  return event;
}

export function assertNoPrivateData(value) {
  const json = JSON.stringify(value);
  for (const forbidden of [
    secret, jwt, 'private@example.com', 'Bearer ', 'access_token',
    'refresh_token', 'authorization', 'cookie', 'username', 'user_id',
    'playerId', 'matchId', 'pgn', 'supabase', 'context_line', 'session',
    'password', '1. e4 e5',
  ]) assert.ok(!json.includes(forbidden), 'private field/value leaked: ' + forbidden);
}

export function checkNestedPolicy(policy) {
  const original = hostileEvent();
  const safe = policy.sanitizeEvent(original);
  assert.ok(safe);
  assertNoPrivateData(safe);
  assert.equal(safe.exception.values[0].type, 'TypeError');
  assert.equal(safe.exception.values[0].stacktrace.frames[0].lineno, 12);
  assert.equal(safe.exception.values[0].stacktrace.frames[0].filename, 'https://chessaz.de/assets/index-ABC.js');
  assert.deepEqual(safe.request, { url: 'https://chessaz.de/play', method: 'GET' });
  assert.equal(safe.breadcrumbs.length, 1);
  assert.equal(safe.breadcrumbs[0].data.status_code, 500);
  assert.equal(original.user.access_token, jwt, 'input must not be mutated');
  assert.equal(original.extra.cycle, original);
  assert.deepEqual(policy.sanitizeEvent(safe), safe, 'privacy boundary must be idempotent');
}

export function mixedEnvelope() {
  return [{
    event_id: 'a'.repeat(32), trace: { transaction: secret }, sdk: { private: secret },
  }, [
    [{ type: 'event', private: secret }, hostileEvent()],
    ...['attachment', 'transaction', 'session', 'sessions', 'replay_event',
      'replay_recording', 'feedback', 'user_report', 'profile', 'profile_chunk',
      'log', 'metric', 'span', 'client_report'].map(type => [{ type, filename: secret }, secret]),
  ]];
}
