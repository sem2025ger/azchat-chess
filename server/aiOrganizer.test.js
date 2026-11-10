'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { installAiOrganizer, generatePlan, normaliseDraft } = require('./aiOrganizer');

const actor = randomUUID();
const now = Date.parse('2026-11-10T10:00:00Z');
const sample = {
  name: 'NRW Team Cup', start_time: '2026-12-20T15:00', registration_deadline: null,
  boards_per_team: 4, min_teams: 2, max_teams: 6,
};
function provider(body = sample, overrides = {}) {
  return async (_url, request) => {
    if (overrides.capture) overrides.capture.push(JSON.parse(request.body));
    if (overrides.fail) return new Response('unavailable', { status: 500 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{
      text: overrides.invalid ? '{not-json' : JSON.stringify({
        draft: body, missing: [], question: null, assistant_text: 'Review the draft.',
      }),
    }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
function commandClient({ allowed = true, past = false, captured = [] } = {}) {
  const lookup = {
    team_tournament_organizers: allowed ? [{ user_id: actor }] : [],
    team_tournament_roles: past ? [{ tournament_id: '11111111-1111-4111-8111-111111111111' }] : [],
    team_tournament_m3_config: past ? [{ tournament_id: '11111111-1111-4111-8111-111111111111',
      starts_at: '2026-11-09T09:00:00Z', min_teams: 2, max_teams: 4 }] : [],
    team_tournaments: past ? [{ id: '11111111-1111-4111-8111-111111111111', name: 'Prior Cup' }] : [],
    team_tournament_rulesets: past ? [{ tournament_id: '11111111-1111-4111-8111-111111111111',
      board_count: 4 }] : [],
  };
  return {
    from(table) {
      const query = {
        select(fields) { captured.push({ table, fields }); return this; },
        eq() { return this; }, in() { return this; }, order() { return this; },
        limit() { return this; },
        async abortSignal() { return { data: lookup[table] || [], error: null }; },
      };
      return query;
    },
  };
}
async function serve(t, options = {}) {
  const app = express();
  installAiOrganizer(app, {
    enabled: true, m3Enabled: true, now: () => now,
    verifyToken: async token => token === 'valid' ? { id: actor } : null,
    commandClient: commandClient(), apiKey: 'mock-key', fetchImpl: provider(), ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/ai-organizer';
  const post = async (path = '/plan', body = {
    language: 'en', messages: [{ role: 'user', text: 'Team Cup on December 20 at 15:00' }],
  }, token = 'valid') => {
    const response = await fetch(url + path, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
  return { url, post };
}
test('feature is not mounted when Organizer or M3 flag is disabled', async t => {
  for (const flags of [{ enabled: false, m3Enabled: true }, { enabled: true, m3Enabled: false }]) {
    const app = express();
    assert.equal(installAiOrganizer(app, flags), null);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/ai-organizer/plan',
      { method: 'POST' });
    assert.equal(response.status, 404);
  }
});
test('JWT and organizer allowlist both fail closed', async t => {
  const { post } = await serve(t, { commandClient: commandClient({ allowed: false }) });
  assert.deepEqual(await post(), { status: 403, body: { code: 'not_allowed' } });
  assert.deepEqual(await post('/plan', undefined, 'invalid'),
    { status: 401, body: { code: 'authentication_required' } });
});
test('complete phrase creates a ready draft with server-derived deadline; never writes to tournament endpoint', async t => {
  const { post } = await serve(t);
  const { status, body } = await post();
  assert.equal(status, 200);
  assert.equal(body.ready, true);
  assert.deepEqual(body.missing, []);
  assert.equal(body.question, null);
  assert.deepEqual(body.draft, { ...sample, registration_deadline: '2026-12-20T14:00' });
});
test('missing defaults, past start and invalid DST minute are deterministic', () => {
  const defaults = normaliseDraft({
    name: ' Cup ', start_time: '2026-12-20T15:00', boards_per_team: null,
    min_teams: null, max_teams: null,
  }, now, 'ru');
  assert.equal(defaults.ready, true);
  assert.equal(defaults.draft.boards_per_team, 4);
  assert.equal(defaults.draft.min_teams, 2);
  assert.equal(defaults.draft.max_teams, 4);
  const past = normaliseDraft({ ...sample, start_time: '2026-10-20T15:00' }, now, 'ru');
  assert.equal(past.ready, false);
  assert.equal(past.draft.start_time, null);
  assert.ok(past.missing.includes('start_time'));
  assert.match(past.question, /Когда/);
  const dst = normaliseDraft({ ...sample, start_time: '2027-03-28T02:30' }, now, 'de');
  assert.ok(dst.missing.includes('start_time'));
});
test('provider invalid JSON and unavailable response use safe 502; missing key uses 503', async t => {
  const invalid = await serve(t, { fetchImpl: provider(sample, { invalid: true }) });
  assert.deepEqual(await invalid.post(), { status: 502, body: { code: 'provider_unavailable' } });
  const unavailable = await serve(t, { fetchImpl: provider(sample, { fail: true }) });
  assert.deepEqual(await unavailable.post(), { status: 502, body: { code: 'provider_unavailable' } });
  const missing = await serve(t, { apiKey: null });
  assert.deepEqual(await missing.post(), { status: 503, body: { code: 'provider_not_configured' } });
});
test('history passed to Gemini has only non-identifying allowed fields', async t => {
  const capture = [], queries = [];
  const client = commandClient({ past: true, captured: queries });
  const { post } = await serve(t, { commandClient: client, fetchImpl: provider(sample, { capture }) });
  assert.equal((await post()).status, 200);
  const json = JSON.stringify(capture);
  assert.match(json, /Prior Cup/);
  assert.match(json, /board_count/);
  assert.doesNotMatch(json, new RegExp(actor, 'i'));
  assert.doesNotMatch(json, /@|email|user_id|tournament_id|captain_id/i);
  assert.deepEqual(queries.filter(query => query.table === 'team_tournament_roles')
    .map(query => query.fields), ['tournament_id']);
});
test('plan rate limit returns 429 on the 31st request in the 10-minute window', async t => {
  const { post } = await serve(t);
  for (let index = 0; index < 30; index++)
    assert.equal((await post()).status, 200);
  assert.deepEqual(await post(), { status: 429, body: { code: 'rate_limited' } });
});
test('input limits reject invalid history, foreign fields, invalid language and missing last user turn', async t => {
  const { post } = await serve(t);
  for (const body of [
    { language: 'en', messages: [] },
    { language: 'ja', messages: [{ role: 'user', text: 'test' }] },
    { language: 'en', messages: [{ role: 'assistant', text: 'test' }] },
    { language: 'en', messages: [{ role: 'user', text: 'x'.repeat(1001) }] },
    { language: 'en', messages: [{ role: 'user', text: 'test', extra: 'x' }] },
  ]) assert.deepEqual(await post('/plan', body), { status: 400, body: { code: 'invalid_input' } });
});
test('voice transcription endpoint with missing key returns 503 after auth', async t => {
  const { url } = await serve(t, { openaiApiKey: null });
  const response = await fetch(url + '/transcribe?language=en', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid', 'Content-Type': 'audio/webm' },
    body: Buffer.alloc(100),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'provider_not_configured' });
});
test('model output is sanitized and preserved edited values take priority', async () => {
  const result = await generatePlan({
    language: 'en', messages: [{ role: 'user', text: 'A cup' }],
    draft: { name: 'My corrected name', max_teams: 6 },
  }, [], { apiKey: 'mock-key', now, fetchImpl: provider({ ...sample, name: 'AI name', max_teams: 4 }) });
  assert.equal(result.draft.name, 'My corrected name');
  assert.equal(result.draft.max_teams, 6);
});
