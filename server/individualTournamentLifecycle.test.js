'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const { installIndividualTournaments, nextPairings } = require('./individualTournaments');
const express = require('express');

test('individual pairing assigns every player once, avoids rematches and repeat byes, and is deterministic', () => {
  for (const count of [2,3,4,5,7,16,31,128]) {
    const seeds = Array.from({ length: count }, (_,i) => i+1);
    const history = [];
    const opponents = new Set();
    for (let round = 1; round <= Math.ceil(Math.log2(count)); round++) {
      const pairs = nextPairings(seeds,history);
      assert.ok(pairs, `no round ${round} for ${count} players`);
      assert.deepEqual(pairs,nextPairings(seeds,history));
      const players = pairs.flatMap(p => [p.white_no,p.black_no]).filter(n => n !== null).sort((a,b) => a-b);
      assert.deepEqual(players,seeds);
      for (const pair of pairs) {
        const key = [pair.white_no,pair.black_no].sort().join(':');
        assert.ok(!opponents.has(key));
        opponents.add(key);
        const result = pair.black_no === null ? 'bye' : ['1-0','0-1','1/2-1/2'][(pair.white_no+round)%3];
        history.push({ ...pair,result });
      }
    }
  }
  assert.deepEqual(nextPairings([1,2,3,4], [
    { white_no: 1,black_no: 2,result: '1-0' }, { white_no: 3,black_no: 4,result: '0-1' },
  ]), [{ white_no: 4,black_no: 1 },{ white_no: 2,black_no: 3 }]);
});

test('published event closes registration and completes its rounds through the service API', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL, timeout: 60000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  t.after(() => db.close());
  await db.pool.query(`create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$`);
  for (const file of ['20261124045000_individual_tournament_drafts.sql','20261124060000_individual_tournament_lifecycle.sql']) {
    await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations',file),'utf8'));
  }
  const [owner,...players] = Array.from({ length: 7 },randomUUID);
  const event = randomUUID();
  const privateDraft = randomUUID();
  const start = new Date(Date.now()+60000).toISOString();
  await db.pool.query('insert into auth.users select unnest($1::uuid[])',[[owner,...players]]);
  await db.pool.query(`insert into public.individual_tournament_drafts(id,organizer_id,name,starts_at,max_players)
    values ($1,$2,'Private draft',$3,5)`,[privateDraft,owner,start]);
  const dbArgs = {
    individual_tournament_read: ['p_actor','p_id'],
    individual_tournament_command: ['p_actor','p_id','p_action','p_input'],
    individual_tournament_due: [],
    individual_tournament_advance: ['p_id','p_revision','p_pairs'],
  };
  async function dbCall(role,name,input) {
    const cx = await db.pool.connect();
    try {
      await cx.query('begin');
      await cx.query(role === 'service_role' ? 'set local role service_role' : 'set local role authenticated');
      const args = dbArgs[name].map(key => key === 'p_pairs' && input[key] !== null ? JSON.stringify(input[key]) : input[key]);
      const query = await cx.query(`select public.${name}(${args.map((_,i) => '$'+(i+1)).join(',')}) as value`,args);
      await cx.query('commit');
      return query.rows[0].value;
    } catch (error) { await cx.query('rollback'); throw error; }
    finally { cx.release(); }
  }
  await assert.rejects(dbCall('authenticated','individual_tournament_read',{ p_actor:owner,p_id:privateDraft }),{ code:'42501' });
  const logs = [];
  const app = express();
  const sweep = installIndividualTournaments(app,{
    client:{ rpc:(name,input) => ({ abortSignal:async() => {
      try { return { data:await dbCall('service_role',name,input) }; } catch (error) { return { error }; }
    } }) },
    verifyToken:async token => [owner,...players].includes(token) ? { id:token,is_anonymous:token === players[5] } : null,
    logError:code => logs.push(code),
  });
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(actor,id,action,input={}) {
    const headers = actor ? { Authorization:'Bearer '+actor } : {};
    if (action) headers['Content-Type'] = 'application/json';
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/individual-tournaments${id ? '/'+id : ''}`,
      { headers,...(action ? { method:'POST',body:JSON.stringify({ action,input }) } : {}) });
    return { status:response.status,body:await response.json() };
  }

  assert.deepEqual(await request(null,null),{ status:200,body:[] });
  assert.equal((await request(null,privateDraft)).status,404);
  assert.equal((await request(players[0],privateDraft,'publish')).status,404);
  const input = { name:'Neo Cup',starts_at:start,max_players:4 };
  assert.equal((await request(players[5],event,'publish',input)).status,401);
  assert.equal((await request(owner,event,'publish',{ ...input,starts_at:'2025-01-01T00:00:00.000Z' })).body.code,'invalid_time');
  assert.equal((await request(owner,event,'publish',input)).body.status,'registration');
  assert.equal((await request(owner,event,'publish',input)).status,200);
  assert.equal((await request(owner,event,'publish',{ ...input,name:'Other' })).status,409);
  for (const [i,player] of players.slice(0,3).entries())
    assert.equal((await request(player,event,'join',{ name:'Player '+i })).body.joined,true);
  const race = await Promise.all(players.slice(3,5).map((player,i) => request(player,event,'join',{ name:'Last '+i })));
  assert.deepEqual(race.map(item => item.status).sort(),[200,409]);
  assert.equal(race.find(item => item.status === 409).body.code,'event_full');
  await sweep();
  assert.equal((await request(null,event)).body.round_no,0);
  await db.pool.query("update public.individual_tournament_drafts set starts_at=now()-interval '1 second' where id=$1",[event]);
  const outsider = race[0].status === 409 ? players[3] : players[4];
  assert.equal((await request(outsider,event,'join',{ name:'Late' })).body.code,'registration_closed');
  await Promise.all([sweep(),sweep()]);
  const faced = new Set();
  for (let round = 1; round <= 2; round++) {
    const detail = (await request(null,event)).body;
    assert.equal(detail.round_no,round);
    assert.equal(detail.organizer,false);
    assert.equal(detail.joined,false);
    assert.ok(!JSON.stringify(detail).includes(players[0]));
    const games = detail.pairs.filter(p => p.round_no === round);
    assert.equal(games.length,2);
    for (const game of games) {
      const opponents = [game.white_no,game.black_no].sort().join(':');
      assert.ok(!faced.has(opponents));
      faced.add(opponents);
      const score = { round_no:round,board_no:game.board_no,result:'1/2-1/2' };
      assert.equal((await request(players[0],event,'result',score)).status,403);
      assert.equal((await request(owner,event,'result',score)).status,200);
      assert.equal((await request(owner,event,'result',score)).status,200);
      assert.equal((await request(owner,event,'result',{ ...score,result:'1-0' })).status,409);
      if (game.board_no === 1) {
        await sweep();
        assert.equal((await request(owner,event)).body.round_no,round);
      }
    }
    await sweep();
  }
  assert.equal((await request(owner,event)).body.status,'finished');
  assert.deepEqual(logs,[]);
  await db.pool.query('delete from auth.users where id=$1',[owner]);
  assert.equal((await request(null,event)).status,404);
  const tally = await db.pool.query('select count(*)::int as count from public.individual_tournament_pairings where event_id=$1',[event]);
  assert.equal(tally.rows[0].count,0);
});
