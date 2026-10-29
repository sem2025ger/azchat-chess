'use strict';
// A single unauthenticated QA-only probe. No credentials, feature changes or data writes.
const {URL} = require('node:url');

const QA_HOST = 'chessaz-deutsch-qa-api.onrender.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const REQUEST_BODY = JSON.stringify({moves: 'e4', color: 'black', language: 'en'});

function checkedQaUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl) throw Error('qa_url_required');
  let url;
  try { url = new URL(baseUrl); } catch { throw Error('invalid_qa_url'); }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.hostname !== QA_HOST && !local) throw Error('unapproved_qa_host');
  if (url.protocol !== (local ? 'http:' : 'https:')) throw Error('invalid_qa_protocol');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('invalid_qa_url');
  if (!local && url.port) throw Error('invalid_qa_port');
  return url;
}

async function verifyOpeningPrepReadiness({baseUrl, fetchImpl = fetch, timeoutMs = 15000} = {}) {
  const url = checkedQaUrl(baseUrl);
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000)
    throw Error('invalid_probe_options');
  const started = performance.now();
  const response = await fetchImpl(new URL('/api/ai-coach/preparation', url), {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {'Content-Type': 'application/json'},
    body: REQUEST_BODY,
  });
  const base = {origin: url.origin, httpStatus: response.status, latencyMs: Math.round(performance.now() - started)};
  if (response.status === 404)
    return {...base, status: 'BLOCKED_ROUTE_OR_FLAG', note: '404 cannot distinguish missing route from a disabled feature flag'};
  if (response.status === 429)
    return {...base, status: 'BLOCKED_RATE_LIMIT', note: 'Wait for the rate window; do not retry repeatedly'};
  if (response.status !== 401)
    return {...base, status: 'UNEXPECTED_RESPONSE', note: 'Unauthenticated requests must not return lesson data'};
  if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') || ''))
    return {...base, status: 'UNVERIFIED_AUTH_RESPONSE', note: 'An upstream proxy may have returned HTTP 401'};
  const raw = await response.text();
  if (raw.length > 2048) return {...base, status: 'UNVERIFIED_AUTH_RESPONSE', note: 'Unexpected authentication body size'};
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return {...base, status: 'UNVERIFIED_AUTH_RESPONSE', note: 'Unexpected authentication response format'}; }
  if (parsed?.code !== 'authentication_required')
    return {...base, status: 'UNVERIFIED_AUTH_RESPONSE', note: 'Unexpected authentication error code'};
  return {...base, status: 'AUTH_ROUTE_PRESENT', note: 'Only route + auth gate confirmed; SHA, QA database, index and Gemini are NOT verified'};
}

if (require.main === module) {
  verifyOpeningPrepReadiness({baseUrl: process.env.QA_BASE_URL})
    .then(result => { console.log(JSON.stringify(result)); if (result.status !== 'AUTH_ROUTE_PRESENT') process.exitCode = 1; })
    .catch(() => { console.error('QA readiness probe failed; verify QA_BASE_URL and network availability. No URL or response body was logged.'); process.exitCode = 1; });
}
module.exports = {checkedQaUrl, verifyOpeningPrepReadiness};
