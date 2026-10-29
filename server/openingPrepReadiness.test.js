'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {checkedQaUrl, verifyOpeningPrepReadiness} = require('./scripts/verifyOpeningPrepReadiness');
const QA = 'https://chessaz-deutsch-qa-api.onrender.com/';

function stub(status, code = 'authentication_required', contentType = 'application/json') {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url: String(url), options});
    return new Response(JSON.stringify({code}), {status, headers: {'content-type': contentType}});
  };
  return {calls, fetchImpl};
}

test('only pinned QA origin or loopback can be probed', async () => {
  assert.equal(checkedQaUrl(QA).origin, 'https://chessaz-deutsch-qa-api.onrender.com');
  assert.equal(checkedQaUrl('http://127.0.0.1:4000/').port, '4000');
  for (const bad of [undefined, '', 'not-a-url', 'https://chessaz.de/', 'https://chessaz-api.onrender.com/',
    'http://chessaz-deutsch-qa-api.onrender.com/', 'https://chessaz-deutsch-qa-api.onrender.com:444/',
    'https://user:password@chessaz-deutsch-qa-api.onrender.com/',
    'https://chessaz-deutsch-qa-api.onrender.com/?token=secret',
    'https://chessaz-deutsch-qa-api.onrender.com/api/ai-coach',
    'https://chessaz-deutsch-qa-api.onrender.com.evil.example/',
    'http://localhost.evil.example/']) {
    assert.throws(() => checkedQaUrl(bad), {message: /qa_url_required|invalid_qa_url|unapproved_qa_host|invalid_qa_protocol|invalid_qa_port/});
  }
});

test('a single token-free unauthenticated request confirms only the auth gate', async () => {
  const {calls, fetchImpl} = stub(401);
  const r = await verifyOpeningPrepReadiness({baseUrl: QA, fetchImpl});
  assert.equal(r.status, 'AUTH_ROUTE_PRESENT');
  assert.equal(r.httpStatus, 401);
  assert.match(r.note, /NOT verified/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, QA + 'api/ai-coach/preparation');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(!('Authorization' in calls[0].options.headers));
  assert.deepEqual(JSON.parse(calls[0].options.body), {moves: 'e4', color: 'black', language: 'en'});
});

test('404, 429, 200 and proxy-style 401 never produce a false pass', async () => {
  for (const [http, contentType, code, expected] of [
    [404, 'application/json', 'feature_disabled', 'BLOCKED_ROUTE_OR_FLAG'],
    [429, 'application/json', 'rate_limit', 'BLOCKED_RATE_LIMIT'],
    [200, 'application/json', 'none', 'UNEXPECTED_RESPONSE'],
    [401, 'text/html', 'authentication_required', 'UNVERIFIED_AUTH_RESPONSE'],
    [401, 'application/json', 'other_error', 'UNVERIFIED_AUTH_RESPONSE'],
  ]) {
    const {fetchImpl} = stub(http, code, contentType);
    const r = await verifyOpeningPrepReadiness({baseUrl: QA, fetchImpl});
    assert.equal(r.status, expected, String(http) + '/' + code);
  }
});

test('unsafe destination and invalid options are rejected before fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => {calls++; throw Error('must not be called');};
  await assert.rejects(verifyOpeningPrepReadiness({baseUrl: 'https://chessaz.de/', fetchImpl}));
  await assert.rejects(verifyOpeningPrepReadiness({baseUrl: QA, fetchImpl, timeoutMs: 120000}));
  assert.equal(calls, 0);
});
