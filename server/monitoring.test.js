'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const policy = require('./monitoringPrivacy');
const { createMonitoring, initializeMonitoring } = require('./monitoring');
const { persistRoomCompletedMatch } = require('./matchPersistence');

function fakeSdk({ throwCapture = false } = {}) {
  const calls = { init: [], events: [], exceptions: [], envelopes: [] };
  const sdk = {
    init: options => calls.init.push(options),
    onUncaughtExceptionIntegration: () => ({ name: 'OnUncaughtException' }),
    onUnhandledRejectionIntegration: () => ({ name: 'OnUnhandledRejection' }),
    captureException: error => { if (throwCapture) throw Error('SDK failure'); calls.exceptions.push(error); },
    captureEvent: event => { if (throwCapture) throw Error('SDK failure'); calls.events.push(event); },
    makeNodeTransport: () => ({
      send: async envelope => { calls.envelopes.push(envelope); return { statusCode: 200 }; },
      flush: async () => true,
    }),
  };
  const monitor = createMonitoring({
    env: { SENTRY_DSN: 'https://public@monitor.invalid/1', SENTRY_ENVIRONMENT: 'test', RENDER_GIT_COMMIT: '0'.repeat(40) },
    loadSdk: () => sdk,
  });
  return { monitor, sdk, calls };
}

test('backend: no DSN loads no SDK and adds no process listeners', () => {
  const before = ['uncaughtException', 'unhandledRejection'].map(name => process.listenerCount(name));
  for (const env of [{}, { SENTRY_DSN: '' }, { SENTRY_DSN: '  ' }]) {
    let loads = 0;
    const monitor = createMonitoring({ env, loadSdk: () => { loads++; throw Error(); } });
    assert.equal(monitor.enabled, false);
    assert.equal(loads, 0);
    monitor.captureException(new Error('not sent'));
    monitor.capturePersistenceFailure({});
  }
  assert.deepEqual(['uncaughtException', 'unhandledRejection'].map(name => process.listenerCount(name)), before);
});

test('backend: nested secrets/JWTs, URL fragments, headers, user/session/game fields and attachments are scrubbed', async () => {
  const { checkNestedPolicy, assertNoPrivateData, mixedEnvelope, secret } = await import('../tmp/tests/monitoringFixtures.mjs');
  checkNestedPolicy(policy);
  const { calls } = fakeSdk();
  const options = calls.init[0];
  assert.equal(options.defaultIntegrations, false);
  assert.equal(options.sendDefaultPii, false);
  assert.deepEqual(options.dataCollection, policy.privateDataCollection());
  assert.equal(options.tracesSampleRate, 0);
  assert.deepEqual(options.tracePropagationTargets, []);
  assert.equal(options.enableOpenTelemetrySetup, false);
  assert.equal(options.enableRuntimeChannelInjection, false);
  assert.equal(options.includeLocalVariables, false);
  assert.equal(options.sendClientReports, false);
  assert.equal(options.profileSessionSampleRate, 0);
  assert.deepEqual(options.integrations.map(x => x.name), ['OnUncaughtException', 'OnUnhandledRejection']);
  assert.equal(options.beforeSendLog({}), null);
  assert.equal(options.beforeSendMetric({}), null);
  assert.equal(options.beforeSendTransaction({}), null);
  assert.equal(options.release, '0'.repeat(40));
  const transport = options.transport({});
  await transport.send(mixedEnvelope());
  await transport.send([{}, [[{ type: 'attachment' }, secret]]]);
  assert.equal(calls.envelopes.length, 1);
  assertNoPrivateData(calls.envelopes);
  assert.equal(await transport.flush(100), true);
});

test('backend: terminal transient failures generate exactly one event despite retries and repeated callers', async () => {
  const { secret, assertNoPrivateData } = await import('../tmp/tests/monitoringFixtures.mjs');
  const { monitor, calls } = fakeSdk();
  const room = {};
  const logs = [];
  let attempts = 0;
  const adapter = { async persistCompletedMatch() {
    attempts++;
    throw Object.assign(new Error(secret), { code: 'ECONNRESET', pgn: secret, user: secret });
  } };
  const record = { id: secret, pgn: secret, whiteId: secret, blackId: secret };
  const options = { wait: async () => {}, logError: entry => logs.push(entry), reportFailure: monitor.capturePersistenceFailure };
  const first = persistRoomCompletedMatch(room, record, adapter, options);
  const second = persistRoomCompletedMatch(room, record, adapter, options);
  assert.equal(first, second);
  assert.equal(await first, false);
  assert.equal(await persistRoomCompletedMatch(room, record, adapter, options), false);
  assert.equal(attempts, 3);
  assert.equal(room.persisted, false);
  assert.equal(logs.length, 1, 'existing local terminal log remains');
  assert.equal(logs[0].matchId, secret, 'local log contract is unchanged');
  assert.equal(calls.events.length, 1);
  assert.deepEqual(calls.events[0].extra, {
    code: 'MATCH_PERSIST_FAILED', errorClass: 'transient', attempts: 3, lastErrorCode: 'ECONNRESET',
  });
  assertNoPrivateData(calls.events);
  assert.equal(calls.exceptions.length, 0, 'no duplicate capture of original Error');
  // A different terminal failure with identical diagnostics is still one new
  // event: no global dedupe integration is allowed to swallow it.
  await persistRoomCompletedMatch({}, record, adapter, options);
  assert.equal(calls.events.length, 2);
});

test('backend: permanent failures report once; recovered retries/success report nothing; SDK failures preserve results', async () => {
  const { monitor, calls } = fakeSdk();
  let attempts = 0;
  const record = { id: 'private-match' };
  const options = { wait: async () => {}, logError() {}, reportFailure: monitor.capturePersistenceFailure };
  const permanent = { async persistCompletedMatch() { attempts++; throw Object.assign(Error('private'), { code: '42501' }); } };
  assert.equal(await persistRoomCompletedMatch({}, record, permanent, options), false);
  assert.equal(attempts, 1);
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].extra.lastErrorCode, '42501');
  assert.equal(calls.events[0].extra.errorClass, 'permanent');
  let retry = 0;
  const room = {};
  assert.equal(await persistRoomCompletedMatch(room, record, { async persistCompletedMatch() {
    if (++retry === 1) throw Object.assign(Error('private'), { code: 'ECONNRESET' });
    return { id: record.id };
  } }, options), true);
  assert.equal(room.persisted, true);
  assert.equal(calls.events.length, 1);
  const broken = fakeSdk({ throwCapture: true }).monitor;
  assert.equal(await persistRoomCompletedMatch({}, record, permanent, {
    ...options, reportFailure: broken.capturePersistenceFailure,
  }), false);
  assert.equal(await persistRoomCompletedMatch({}, record, permanent, {
    ...options, reportFailure() { throw Error('monitor failure'); },
  }), false);
  assert.equal(policy.persistenceDiagnostics({ matchId: 'private', lastErrorCode: 'private@example.com' }).lastErrorCode, 'UNKNOWN');
});

test('backend: production default persistence reporter uses the initialized monitor once', async () => {
  const { sdk, calls } = fakeSdk();
  initializeMonitoring({ env: { SENTRY_DSN: 'https://public@monitor.invalid/1' }, loadSdk: () => sdk });
  try {
    const room = {};
    const adapter = { async persistCompletedMatch() { throw Object.assign(Error('private'), { code: '42501' }); } };
    assert.equal(await persistRoomCompletedMatch(room, { id: 'private' }, adapter, { logError() {} }), false);
    assert.equal(await persistRoomCompletedMatch(room, { id: 'private' }, adapter, { logError() {} }), false);
    assert.equal(calls.events.length, 1);
  } finally { initializeMonitoring({ env: {} }); }
});

test('backend: Express status/body/headers and original error are preserved, and the same Error is captured once', async () => {
  const { monitor, calls } = fakeSdk();
  const error = Object.assign(new Error('private response'), { status: 503, headers: { 'X-Test': 'unchanged' } });
  async function serve(withMonitoring, customHandler) {
    const app = express();
    app.set('env', 'production');
    app.get('/fail', (req, res, next) => next(error));
    if (withMonitoring) app.use(monitor.expressErrorHandler);
    if (customHandler) app.use((received, req, res, next) => {
      assert.equal(received, error);
      if (res.headersSent) return next(received);
      res.status(received.status).set(received.headers).json({ error: received.message });
    });
    const server = await new Promise(resolve => { const handle = app.listen(0, '127.0.0.1', () => resolve(handle)); });
    try {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/fail');
      return { status: response.status, body: await response.text(), testHeader: response.headers.get('x-test'), contentType: response.headers.get('content-type') };
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
  for (const custom of [true, false]) assert.deepEqual(await serve(true, custom), await serve(false, custom));
  assert.equal(calls.exceptions.length, 1);
  assert.equal(calls.exceptions[0], error);
  const broken = fakeSdk({ throwCapture: true }).monitor;
  let forwarded;
  broken.expressErrorHandler(error, {}, {}, value => { forwarded = value; });
  assert.equal(forwarded, error);
});

test('backend: SDK loading/init failures return a no-op monitor', () => {
  assert.equal(createMonitoring({ env: { SENTRY_DSN: 'configured' }, loadSdk() { throw Error('failed'); } }).enabled, false);
  const { sdk } = fakeSdk();
  sdk.init = () => { throw Error('failed'); };
  assert.equal(createMonitoring({ env: { SENTRY_DSN: 'configured' }, loadSdk: () => sdk }).enabled, false);
});

test('backend: real SDK sends only a scrubbed error envelope through a mock transport', async () => {
  const { hostileEvent, assertNoPrivateData } = await import('../tmp/tests/monitoringFixtures.mjs');
  const sdk = require('@sentry/node');
  const sent = [];
  const monitor = createMonitoring({
    env: { SENTRY_DSN: 'https://public@monitor.invalid/1', SENTRY_ENVIRONMENT: 'test' },
    loadSdk: () => ({
      ...sdk,
      makeNodeTransport: () => ({
        send: async envelope => { sent.push(envelope); return { statusCode: 200 }; },
        flush: async () => true,
      }),
    }),
  });
  try {
    assert.equal(monitor.enabled, true);
    const collection = sdk.getClient().getDataCollectionOptions();
    for (const key of ['userInfo', 'cookies', 'urlQueryParams', 'databaseQueryData', 'queues', 'stackFrameVariables']) assert.equal(collection[key], false, key);
    assert.deepEqual(collection.httpHeaders, { request: false, response: false });
    assert.deepEqual(collection.httpBodies, []);
    assert.equal(collection.frameContextLines, 0);
    sdk.captureEvent(hostileEvent(), { attachments: [{ filename: 'private', data: 'private' }] });
    await sdk.flush(1000);
    assert.equal(sent.length, 1);
    assertNoPrivateData(sent);
    assert.equal(sent[0][1].length, 1);
  } finally { await sdk.close(1000); sdk.setUser(null); sdk.setContext('supabase', null); }
});
