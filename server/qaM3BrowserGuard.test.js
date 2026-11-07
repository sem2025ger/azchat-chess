'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PREVIEW, BRANCH, browserTarget, healthGuard, networkDecision } = require('./scripts/qaM3BrowserGuard');
const env = { QA_SUPABASE_URL: 'https://iukmpcytsuofqhxsumbu.supabase.co', M3_QA_API_URL: 'https://chessaz-m3-qa-api.onrender.com', M3_QA_PREVIEW_URL: PREVIEW, GITHUB_REPOSITORY: 'sem2025ger/azchat-chess', M3_QA_BRANCH: BRANCH, M3_QA_PR: '194', GITHUB_RUN_ID: '123' };
const target = browserTarget(env);
const sha = 'a'.repeat(40);
test('browser target requires exact QA origins, repository, PR and branch', () => {
  assert.equal(target.preview, PREVIEW);
  for (const [key, values] of Object.entries({
    M3_QA_PREVIEW_URL: [undefined, PREVIEW + '/', PREVIEW + '@evil.test', 'https://chessaz.de', 'https://azchat-chess.vercel.app'],
    M3_QA_API_URL: ['https://chessaz-api.onrender.com', 'https://chessaz-deutsch-qa-api.onrender.com'],
    QA_SUPABASE_URL: ['https://kmwfvvliundhuovoakoa.supabase.co'],
    M3_QA_BRANCH: ['main', undefined], M3_QA_PR: ['193', undefined], GITHUB_REPOSITORY: ['fork/azchat-chess'], GITHUB_RUN_ID: ['../123', '0'],
  })) for (const value of values) assert.throws(() => browserTarget({ ...env, [key]: value }));
});
test('browser health guard uses credential-free non-redirecting read and exact full SHA', async () => {
  await healthGuard(target, sha, async (url, options) => {
    assert.equal(url, target.api + '/health'); assert.equal(options.redirect, 'error'); assert.equal(options.headers, undefined);
    return Response.json({ ok: true, service: 'aztr-chess-server', commit: sha });
  });
  for (const commit of [null, sha.slice(0, 7), 'b'.repeat(40)]) {
    await assert.rejects(healthGuard(target, sha, async () => Response.json({ ok: true, service: 'aztr-chess-server', commit })), /commit/);
  }
  await assert.rejects(healthGuard(target, 'main', () => { throw Error('must not fetch'); }), /SHA/);
  await assert.rejects(healthGuard(target, sha, async () => Response.json({ ok: true, service: 'wrong', commit: sha })), /commit/);
});
test('browser network guard blocks production, unapproved origins, token URLs and referrers', () => {
  const token = 'secret-fixture-token';
  assert.equal(networkDecision(PREVIEW + '/spieltag?invite=' + token, {}, target, [token]), 'allow');
  assert.equal(networkDecision(target.api + '/health', {}, target, []), 'allow');
  assert.equal(networkDecision(target.supabase.replace('https:', 'wss:') + '/realtime/v1', {}, target, []), 'allow');
  for (const host of ['chessaz.de','azchat-chess.vercel.app','chessaz-api.onrender.com','chessaz-deutsch-qa-api.onrender.com','kmwfvvliundhuovoakoa.supabase.co']) {
    assert.equal(networkDecision('https://' + host, {}, target, []), 'forbidden');
  }
  assert.equal(networkDecision('https://third.test/?t=' + token, {}, target, [token]), 'leak');
  assert.equal(networkDecision('https://third.test', { referer: PREVIEW + '/?invite=' + token }, target, [token]), 'leak');
  assert.equal(networkDecision('https://third.test', {}, target, []), 'block');
  assert.equal(networkDecision(PREVIEW + '.evil.test/', {}, target, []), 'block');
});
test('browser entrypoint stops before SQL and fixtures when health SHA differs', async () => {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const { mkdtempSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const cwd = mkdtempSync(join(tmpdir(), 'm3-browser-guard-'));
  const script = join(__dirname,'scripts/qaM3Browser.js');
  const bootstrap = `
    import {createRequire} from 'node:module';
    const {Client}=createRequire(process.argv[1])('pg');
    Client.prototype.connect=()=>{process.stdout.write('UNEXPECTED_SQL');throw Error('SQL reached');};
    globalThis.fetch=async()=>Response.json({ok:true,service:'aztr-chess-server',commit:'${'b'.repeat(40)}'});
  `;
  try {
    await assert.rejects(promisify(execFile)(process.execPath, ['--import','data:text/javascript,'+encodeURIComponent(bootstrap),script], {
      cwd, env:{...process.env,...env,GITHUB_ACTIONS:'false',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:'',M3_QA_EXPECTED_SHA:sha,
        QA_SUPABASE_ANON_KEY:'fixture-anon',QA_SUPABASE_SERVICE_KEY:'fixture-service',
        QA_DATABASE_URL:'postgresql://postgres:fixture@db.iukmpcytsuofqhxsumbu.supabase.co/postgres'},
    }), error=>{assert.equal(error.code,1);assert.doesNotMatch(error.stdout,/UNEXPECTED_SQL|PASS/);return true;});
  } finally {rmSync(cwd,{recursive:true,force:true});}
});
