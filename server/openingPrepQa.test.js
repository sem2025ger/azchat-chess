'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {installAiCoach} = require('./aiCoach');
const {PositionIndex} = require('./positionIndex');
const {verifyOpeningPrepQa} = require('./scripts/verifyOpeningPrepQa');

test('QA HTTP verifier covers exact ply, KID transpositions, auth, boundaries and provider degradation', async () => {
  const rows = [
    ['a', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'],
    ['b', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O'],
    ['c', 'c4 g6 Nc3 Bg7 d4 Nf6 e4 d6 Nf3 O-O'],
  ].map(([id, pgn]) => ({id, pgn: pgn + ' 1-0', white_fide_id: '101', black_fide_id: '202',
    white_name: 'Fixture A', black_name: 'Fixture B', event: 'Synthetic', game_date: '2026-10-29',
    source_url: 'https://database.lichess.org/broadcast/lichess_db_broadcast_2026-10.pgn.zst',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/'}));
  const index = new PositionIndex({page: async cursor => rows.filter(r => !cursor || r.id > cursor), hidden: async () => new Set()}, {log() {}});
  await index.start(); assert.equal(index.status, 'ready');
  for (const mode of ['no-key', 'provider-error', 'malformed', 'generated']) {
    let calls = 0;
    const app = express();
    installAiCoach(app, {enabled: true, index, verifyToken: async token => token === 'synthetic' ? {id: 'fixture'} : null,
      apiKey: mode === 'no-key' ? null : 'synthetic-provider-key',
      fetchImpl: async () => {
        calls++;
        if (mode === 'provider-error') return new Response('', {status: 503});
        if (mode === 'malformed') return new Response('not json');
        return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({briefing: 'Study the supplied model games.'})}]}}]});
      }});
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const result = await verifyOpeningPrepQa({baseUrl: 'http://127.0.0.1:' + server.address().port,
        token: 'synthetic', expectedAi: mode === 'generated' ? 'generated' : 'fallback'});
      assert.equal(result.status, 'PASS');
      assert.deepEqual(result.results.map(r => r.status), [401, 200, 200, 200, 400, 200, 400]);
      assert.equal(calls, mode === 'no-key' ? 0 : 4);
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
});

test('isolated Coach host is strictly allowed but impostor domains are denied', async () => {
  // An empty token fails after URL validation: no request is made.
  const baseUrl = 'https://chessaz-ai-coach-v1-isolated-qa.onrender.com/';
  await assert.rejects(verifyOpeningPrepQa({baseUrl, token: ''}), /QA_ACCESS_TOKEN is required/);
  for (const unsafe of [
    'https://chessaz-ai-coach-v1-isolated-qa.onrender.com.evil.example/',
    'http://chessaz-ai-coach-v1-isolated-qa.onrender.com/',
    'https://chessaz-ai-coach-v1-isolated-qa.onrender.com:444/',
    'https://user:pass@chessaz-ai-coach-v1-isolated-qa.onrender.com/',
    'https://chessaz-api.onrender.com/',
    'https://chessaz.de/',
  ]) {
    await assert.rejects(verifyOpeningPrepQa({baseUrl: unsafe, token: 'synthetic'}),
      /unapproved_qa_host|invalid_qa_protocol|invalid_qa_port|invalid_qa_url/);
  }
});

test('QA verifier refuses production before any network request', async () => {
  for (const baseUrl of ['https://chessaz-api.onrender.com', 'https://chessaz.de', 'https://user:secret@chessaz-deutsch-qa-api.onrender.com']) {
    await assert.rejects(verifyOpeningPrepQa({baseUrl, token: 'synthetic'}));
  }
});
