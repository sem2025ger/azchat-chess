import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../src/monitoring/privacy.ts';
import { initializeFrontendMonitoring } from '../src/monitoring/sentry.ts';
import { secret, jwt, hostileEvent, checkNestedPolicy, assertNoPrivateData, mixedEnvelope } from './monitoringFixtures.mjs';

function fakeSdk() {
  const calls = { init: [], events: [], react: [], flush: [] };
  const sdk = {
    init: options => calls.init.push(options),
    globalHandlersIntegration: () => ({ name: 'GlobalHandlers' }),
    dedupeIntegration: () => ({ name: 'Dedupe' }),
    captureException: error => calls.react.push(error),
    makeFetchTransport: () => ({
      send: async envelope => { calls.events.push(envelope); return { statusCode: 200 }; },
      flush: async timeout => { calls.flush.push(timeout); return true; },
    }),
  };
  return { sdk, calls };
}

test('frontend: no DSN means no SDK import, initialization or root hooks', async () => {
  for (const env of [{}, { VITE_SENTRY_DSN: '' }, { VITE_SENTRY_DSN: '  ' }]) {
    let imports = 0;
    assert.equal(await initializeFrontendMonitoring(env, async () => { imports++; throw Error(); }), undefined);
    assert.equal(imports, 0);
  }
});

test('frontend: URLs strip query, token fragments, credentials, private paths and unknown hosts', () => {
  assert.equal(policy.sanitizeUrl('https://user:password@chessaz.de/play?token=' + jwt + '#access_token=' + jwt), 'https://chessaz.de/play');
  assert.equal(policy.sanitizeUrl('/profile#refresh_token=' + secret), 'https://chessaz.de/profile');
  assert.equal(policy.sanitizeUrl('https://chessaz.de/private/' + secret), 'https://chessaz.de/[redacted]');
  assert.equal(policy.sanitizeUrl('https://project.supabase.co/auth/v1#access_token=' + jwt), '[redacted-url]');
  assert.equal(policy.sanitizeUrl('javascript:' + jwt), '[redacted-url]');
  assert.equal(policy.sanitizeUrl('https://azchat-chess-private-branch-semov20207-3068s-projects.vercel.app/play#' + jwt), 'https://chessaz-preview.vercel.app/play');
});

test('frontend: JWTs, emails, user data, authorization/cookies and nested game/session data never leave the boundary', () => {
  checkNestedPolicy(policy);
});

test('frontend: type-confused fields and hostile getters fail closed', () => {
  const object = { private: secret, toString: () => 'GET' };
  const safe = policy.sanitizeEvent({
    level: object, exception: { values: [{ type: object }] },
    request: { url: '/health', method: object },
    breadcrumbs: [{ category: { private: secret, toString: () => 'fetch' } }],
  });
  assertNoPrivateData(safe);
  assert.equal(safe.level, 'error');
  assert.equal(safe.exception.values[0].type, 'Error');
  assert.equal(safe.request.method, undefined);
  assert.equal(safe.breadcrumbs.length, 0);
  assert.equal(policy.sanitizeEvent({ get request() { throw Error(secret); } }), null);
  assert.equal(policy.sanitizeBreadcrumb({ get category() { throw Error(secret); } }), null);
  assert.equal(policy.sanitizeEnvelope([{}, [[{ get type() { throw Error(secret); } }, {}]]]), null);
});

test('frontend: sanitizer blocks non-error event types and strips all attachment/replay/feedback/session/trace envelopes', () => {
  for (const type of ['transaction', 'feedback', 'replay_event', 'log', 'profile']) {
    assert.equal(policy.sanitizeEvent({ type, message: secret }), null);
  }
  const safe = policy.sanitizeEnvelope(mixedEnvelope());
  assert.equal(safe[1].length, 1);
  assert.deepEqual(safe[0], { event_id: 'a'.repeat(32) });
  assert.deepEqual(safe[1][0][0], { type: 'event' });
  assertNoPrivateData(safe);
  assert.equal(policy.sanitizeEnvelope([{}, [[{ type: 'attachment' }, secret]]]), null);
});

test('frontend: init opts out of defaults, replay, tracing, feedback and client reports; metadata is validated', async () => {
  const { sdk, calls } = fakeSdk();
  const hooks = await initializeFrontendMonitoring({
    VITE_SENTRY_DSN: 'https://public@monitor.invalid/1',
    VITE_SENTRY_ENVIRONMENT: 'preview',
    VITE_SENTRY_RELEASE_SHA: '0'.repeat(40),
  }, async () => sdk);
  const options = calls.init[0];
  assert.equal(options.sendDefaultPii, false);
  assert.deepEqual(options.dataCollection, policy.privateDataCollection());
  assert.equal(options.defaultIntegrations, false);
  assert.deepEqual(options.integrations.map(x => x.name), ['GlobalHandlers', 'Dedupe']);
  assert.equal(options.tracesSampleRate, 0);
  assert.deepEqual(options.tracePropagationTargets, []);
  assert.equal(options.replaysSessionSampleRate, 0);
  assert.equal(options.replaysOnErrorSampleRate, 0);
  assert.equal(options.sendClientReports, false);
  assert.equal(options.beforeSendLog({}), null);
  assert.equal(options.beforeSendMetric({}), null);
  assert.equal(options.beforeSendTransaction({}), null);
  assert.equal(options.beforeBreadcrumb({ category: 'console', message: secret }), null);
  assertNoPrivateData(options.beforeSend(hostileEvent()));
  assert.equal(options.environment, 'preview');
  assert.equal(options.release, '0'.repeat(40));
  assert.equal(policy.safeRelease('not-a-sha-' + secret), undefined);
  assert.equal(policy.safeEnvironment('private@example.com'), 'unspecified');
  const transport = options.transport({});
  await transport.send(mixedEnvelope());
  await transport.send([{}, [[{ type: 'attachment' }, secret]]]);
  assert.equal(calls.events.length, 1);
  assertNoPrivateData(calls.events[0]);
  assert.equal(await transport.flush(100), true);
  assert.deepEqual(calls.flush, [100]);
  assert.ok(hooks.onUncaughtError && hooks.onCaughtError && hooks.onRecoverableError);
});

test('frontend: SDK loading/init failures do not prevent normal rendering', async () => {
  assert.equal(await initializeFrontendMonitoring({ VITE_SENTRY_DSN: 'configured' }, async () => { throw Error(secret); }), undefined);
  const { sdk } = fakeSdk();
  sdk.init = () => { throw Error(secret); };
  assert.equal(await initializeFrontendMonitoring({ VITE_SENTRY_DSN: 'configured' }, async () => sdk), undefined);
});

test('frontend: real Sentry SDK events reach only the scrubbed mock transport, including SDK-added fields', async () => {
  const sdk = await import('@sentry/react');
  const sent = [];
  await initializeFrontendMonitoring({
    VITE_SENTRY_DSN: 'https://public@monitor.invalid/1',
    VITE_SENTRY_ENVIRONMENT: 'test',
  }, async () => ({
    ...sdk,
    makeFetchTransport: () => ({
      send: async envelope => { sent.push(envelope); return { statusCode: 200 }; },
      flush: async () => true,
    }),
  }));
  try {
    sdk.setUser({ id: secret, email: 'private@example.com' });
    sdk.setContext('supabase', { session: jwt, pgn: secret });
    sdk.addBreadcrumb({ category: 'console', message: secret });
    const collection = sdk.getClient().getDataCollectionOptions();
    for (const key of ['userInfo', 'cookies', 'urlQueryParams', 'databaseQueryData', 'queues', 'stackFrameVariables']) assert.equal(collection[key], false, key);
    assert.deepEqual(collection.httpHeaders, { request: false, response: false });
    assert.deepEqual(collection.httpBodies, []);
    assert.equal(collection.frameContextLines, 0);
    sdk.captureEvent(hostileEvent(), { attachments: [{ filename: secret, data: secret }] });
    await sdk.flush(1000);
    assert.equal(sent.length, 1);
    assertNoPrivateData(sent);
    assert.equal(sent[0][1].length, 1);
    assert.equal(sent[0][1][0][1].exception.values[0].type, 'TypeError');
  } finally {
    await sdk.close(1000);
    sdk.setUser(null); sdk.setContext('supabase', null);
  }
});

test('frontend: React error hooks preserve local reporting even if Sentry capture throws', async () => {
  const originalReport = globalThis.reportError;
  const originalConsole = console.error;
  const reported = [];
  const logged = [];
  globalThis.reportError = error => reported.push(error);
  console.error = (...args) => logged.push(args);
  try {
    for (const broken of [false, true]) {
      const { sdk, calls } = fakeSdk();
      if (broken) sdk.captureException = () => { throw Error('SDK failure'); };
      const hooks = await initializeFrontendMonitoring({ VITE_SENTRY_DSN: 'configured' }, async () => sdk);
      const error = new Error('local private error');
      for (const key of ['onUncaughtError', 'onCaughtError', 'onRecoverableError']) hooks[key](error, { componentStack: 'local component stack' });
      assert.equal(calls.react.length, broken ? 0 : 3);
    }
    assert.equal(reported.length, 4);
    assert.equal(logged.length, 2);
  } finally {
    if (originalReport === undefined) delete globalThis.reportError;
    else globalThis.reportError = originalReport;
    console.error = originalConsole;
  }
});
