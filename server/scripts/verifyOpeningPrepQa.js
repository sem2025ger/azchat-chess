'use strict';
// Read-only lesson requests. Never changes flags, keys, accounts or database state.
const assert = require('node:assert/strict');
const {Chess} = require('chess.js');
const {normalizedPositionKey} = require('../positionIndex');

function validateLesson(data, expectedPly, {requireGames = true} = {}) {
  assert.equal(data.ply, expectedPly);
  assert.ok(Array.isArray(data.groups));
  assert.ok(Number.isInteger(data.matched) && data.matched >= 0);
  assert.equal(data.generated, Boolean(data.briefing));
  if (requireGames) assert.ok(data.groups.length > 0, 'Expected archive examples');
  for (const group of data.groups) {
    const board = new Chess(data.fen);
    const replies = new Map();
    assert.equal(board.move(group.move).san, group.move);
    assert.equal(group.replyColor, board.turn() === 'w' ? 'white' : 'black');
    assert.ok(group.games.length > 0 && group.games.length <= 5);
    for (const game of group.games) {
      const replay = new Chess();
      replay.loadPgn(game.pgn);
      const moves = replay.history();
      assert.ok(Number.isInteger(game.ply) && game.ply >= 0 && game.ply < moves.length);
      const at = new Chess();
      for (const move of moves.slice(0, game.ply)) at.move(move);
      assert.equal(normalizedPositionKey(at.fen()), normalizedPositionKey(data.fen));
      assert.equal(moves[game.ply], group.move);
      assert.ok(Array.isArray(game.first25) && game.first25.length <= 50);
      assert.deepEqual(game.first25, moves.slice(0, 50));
      if (moves[game.ply + 1]) {
        const reply = moves[game.ply + 1];
        replies.set(reply, (replies.get(reply) || 0) + 1);
      }
    }
    assert.deepEqual(group.replies, [...replies].map(([move, count]) => ({move, count}))
      .sort((a, b) => b.count - a.count || a.move.localeCompare(b.move)));
  }
  return data;
}

async function verifyOpeningPrepQa({baseUrl, token, expectedAi = 'either', report = () => {}}) {
  const url = new URL(baseUrl);
  assert.ok(['https:', 'http:'].includes(url.protocol));
  assert.equal(url.username + url.password + url.search + url.hash, '');
  assert.equal(url.pathname, '/');
  assert.ok(['chessaz-deutsch-qa-api.onrender.com', 'localhost', '127.0.0.1'].includes(url.hostname),
    'Only the known QA service or a local fixture is allowed; production is rejected');
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) assert.equal(url.protocol, 'https:');
  assert.ok(typeof token === 'string' && token.length > 0, 'QA_ACCESS_TOKEN is required');
  assert.ok(['either', 'fallback', 'generated'].includes(expectedAi));
  const results = [];
  async function send(name, body, expectedStatus, authenticated = true) {
    const start = performance.now();
    const response = await fetch(new URL('/api/ai-coach/preparation', url), {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000),
      headers: {'Content-Type': 'application/json', ...(authenticated ? {Authorization: 'Bearer ' + token} : {})},
      body: JSON.stringify(body),
    });
    const measurement = {name, status: response.status, ms: Math.round(performance.now() - start)};
    results.push(measurement); report(measurement);
    assert.equal(response.status, expectedStatus, name + ': unexpected HTTP status');
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    const data = await response.json();
    if (expectedStatus === 200) {
      const expected = new Chess();
      for (const move of body.moves.split(' ')) expected.move(move);
      assert.equal(normalizedPositionKey(data.fen), normalizedPositionKey(expected.fen()));
      assert.deepEqual(data.moves, expected.history());
      assert.equal(data.color, body.color);
      assert.equal(data.turn, expected.turn() === 'w' ? 'white' : 'black');
    }
    if (expectedStatus === 400) assert.equal(data.code, 'invalid_query');
    if (expectedStatus === 401) assert.equal(data.code, 'authentication_required');
    return data;
  }
  const query = (moves, color = 'black') => ({moves, color, language: 'en'});
  await send('unauthenticated', query('e4'), 401, false);
  // Exactly six authenticated requests: the normal per-user minute budget.
  const spanish = validateLesson(await send('Spanish, white, ply 8',
    query('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6', 'white'), 200), 8);
  assert.equal(spanish.turn, 'white');
  if (expectedAi !== 'either') assert.equal(spanish.generated, expectedAi === 'generated');
  const a = validateLesson(await send('Kings Indian A', query('d4 Nf6 c4 g6 Nc3 Bg7 e4 d6'), 200), 8);
  const b = validateLesson(await send('Kings Indian B', query('c4 g6 Nc3 Bg7 d4 Nf6 e4 d6'), 200), 8);
  assert.equal(normalizedPositionKey(a.fen), normalizedPositionKey(b.fen));
  assert.equal(a.matched, b.matched); assert.equal(a.inspected, b.inspected);
  assert.deepEqual(a.groups, b.groups, 'Transposed requests must return identical groups/examples');
  await send('illegal move', query('e4 e5 Bh6'), 400);
  const forty = Array(10).fill('Nf3 Nf6 Ng1 Ng8').join(' ');
  validateLesson(await send('40 plies accepted', query(forty), 200), 40, {requireGames: false});
  await send('41 plies rejected', query(forty + ' Nf3'), 400);
  return {status: 'PASS', environment: url.origin, results,
    ai: spanish.generated ? 'generated (quality not evaluated)' : 'fallback',
    limitations: ['API only; visual board navigation requires browser QA',
      'One provider configuration per run; no flags or keys are changed',
      'Deployed SHA must be verified through the hosting provider separately']};
}

if (require.main === module) {
  verifyOpeningPrepQa({baseUrl: process.env.QA_BASE_URL, token: process.env.QA_ACCESS_TOKEN,
    expectedAi: process.env.QA_EXPECT_AI || 'either', report: value => console.log(JSON.stringify(value))})
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => {
      // Assertion/JSON errors can contain response data or credentials from an invalid URL.
      console.error('QA FAILED: network, response, or acceptance check failed. Review the status/latency lines; response bodies are not logged.');
      process.exitCode = 1;
    });
}
module.exports = {verifyOpeningPrepQa, validateLesson};
