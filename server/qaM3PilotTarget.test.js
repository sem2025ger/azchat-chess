'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { join } = require('node:path');
const { promisify } = require('node:util');
const test = require('node:test');
const { qaTarget } = require('./scripts/qaM3PilotTarget');

const qa = {
  QA_SUPABASE_URL: 'https://iukmpcytsuofqhxsumbu.supabase.co',
  M3_QA_API_URL: 'https://chessaz-m3-qa-api.onrender.com',
};

test('M3 hosted pilot accepts only the dedicated HTTPS QA origins', () => {
  const expected = { supabase: qa.QA_SUPABASE_URL, api: qa.M3_QA_API_URL };
  assert.deepEqual(qaTarget(qa), expected);
  assert.deepEqual(qaTarget({
    QA_SUPABASE_URL: qa.QA_SUPABASE_URL + '/',
    M3_QA_API_URL: qa.M3_QA_API_URL + '/',
  }), expected);
});

test('M3 hosted pilot rejects the production Supabase ref and lookalikes', () => {
  for (const value of [
    undefined, 'https://kmwfvvliundhuovoakoa.supabase.co',
    qa.QA_SUPABASE_URL + '.example.com', qa.QA_SUPABASE_URL + '?fake=qa',
    qa.QA_SUPABASE_URL + '@example.com', qa.QA_SUPABASE_URL + '\n',
    qa.QA_SUPABASE_URL.replace('https:', 'http:'), qa.QA_SUPABASE_URL + '/rest/v1',
  ]) assert.throws(() => qaTarget({ ...qa, QA_SUPABASE_URL: value }), /QA_SUPABASE_URL/);
});

test('M3 hosted pilot rejects production, M2 and unapproved backend origins', () => {
  for (const value of [
    undefined, 'https://chessaz-api.onrender.com', 'https://chessaz.de',
    'https://chessaz-deutsch-qa-api.onrender.com', qa.M3_QA_API_URL + '.example.com',
    qa.M3_QA_API_URL + ':443', qa.M3_QA_API_URL + '/health', qa.M3_QA_API_URL + '#qa',
    qa.M3_QA_API_URL.replace('https://', 'https://test@'), qa.M3_QA_API_URL.replace('https:', 'http:'),
  ]) assert.throws(() => qaTarget({ ...qa, M3_QA_API_URL: value }), /M3_QA_API_URL/);
});

test('M3 hosted pilot aborts before contacting the database when Render reports a different or missing commit', async () => {
  const script = join(__dirname, 'scripts/qaM3Pilot.js');
  const expected = '0373330bdb0224695ff8f7b66554e12c5a57132a';
  for (const commit of ['392f9109e36ce50d48c33ad5d59f3c7512e74b19', null]) {
    const bootstrap = `
      import assert from 'node:assert/strict';
      import { createRequire } from 'node:module';
      const { Client } = createRequire(process.argv[1])('pg');
      Client.prototype.connect = () => {
        process.stdout.write('unexpected database connection');
        throw new Error('database reached');
      };
      globalThis.fetch = async (url, options) => {
        assert.equal(url, '${qa.M3_QA_API_URL}/health');
        assert.equal(options.method, 'GET');
        assert.equal(options.redirect, 'error');
        assert.deepEqual(options.headers, {});
        return Response.json({ ok: true, service: 'aztr-chess-server', commit: ${JSON.stringify(commit)} });
      };
    `;
    await assert.rejects(promisify(execFile)(process.execPath, [
      '--import', 'data:text/javascript,' + encodeURIComponent(bootstrap), script,
    ], { env: {
      ...process.env, ...qa,
      GITHUB_ACTIONS: 'false', GITHUB_RUN_ID: '123', GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '',
      M3_QA_EXPECTED_SHA: expected,
      QA_SUPABASE_ANON_KEY: 'test-anon', QA_SUPABASE_SERVICE_KEY: 'test-service',
      QA_DATABASE_URL: 'postgresql://postgres:fixture@db.iukmpcytsuofqhxsumbu.supabase.co/postgres',
    } }), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stderr.trim(), 'Render QA commit does not match the reviewed PR head.');
      assert.doesNotMatch(error.stdout, /unexpected database connection/);
      return true;
    });
  }
});
