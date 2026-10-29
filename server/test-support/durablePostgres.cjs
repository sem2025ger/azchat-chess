'use strict';
const { Pool, Client } = require('pg');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

// A narrow HTTP adapter for testing the actual Supabase JS client's wire calls
// against real PostgreSQL. This is NOT PostgREST or a hosted Supabase emulator.
async function isolatedPostgres(connectionString) {
  const url = new URL(connectionString);
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)
    || !url.pathname.startsWith('/durable_test')) throw new Error('Disposable loopback durable_test database required');
  const admin = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await admin.connect();
  const database = 'durable_test_' + randomUUID().replaceAll('-', '');
  await admin.query('CREATE DATABASE ' + database);
  url.pathname = '/' + database;
  const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000, max: 8 });
  await pool.query(`DO $$ BEGIN
    BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
    BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
    BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
    IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role') THEN
        ALTER ROLE service_role BYPASSRLS;
      END IF;
  END $$;
  CREATE EXTENSION "uuid-ossp";
  CREATE TABLE public.profiles(id uuid PRIMARY KEY);
  INSERT INTO public.profiles VALUES
    ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
  const schema = readFileSync(resolve(__dirname, '../../supabase/schema.sql'), 'utf8');
  await pool.query(schema.slice(schema.indexOf('CREATE TABLE public.matches'), schema.indexOf('ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY')));
  await pool.query('GRANT SELECT, INSERT ON public.matches TO service_role');
  // Same source-room uniqueness as the current production bootstrap contract.
  await pool.query('CREATE UNIQUE INDEX matches_source_room_id_unique_idx ON public.matches(source_room_id) WHERE source_room_id IS NOT NULL');
  await pool.query(readFileSync(resolve(__dirname, '../../supabase/migrations/20261019215514_durable_active_games.sql'), 'utf8'));
  const controls = { failOperation: null, loseAcknowledgement: false, failMatches: false, holdMatchResponse: false, requests: [], moveLatencies: [] };
  const http = createServer(async (req, res) => {
    const started = performance.now();
    res.setHeader('content-type', 'application/json');
    let client, operation;
    try {
      if (req.headers.apikey !== 'local-test-service-key') { res.writeHead(403); res.end('{}'); return; }
      const path = new URL(req.url, 'http://127.0.0.1');
      let body = '';
      for await (const chunk of req) body += chunk;
      body = body ? JSON.parse(body) : null;
      operation = body?.p_operation;
      controls.requests.push({ operation, path: path.pathname });
      if (operation && controls.failOperation === operation) throw Object.assign(new Error(), { code: '08006' });
      if ((path.pathname === '/rest/v1/matches' || operation === 'complete') && controls.failMatches) throw Object.assign(new Error(), { code: '08006' });
      client = await pool.connect();
      await client.query('BEGIN'); await client.query('SET LOCAL ROLE service_role');
      let data;
      if (path.pathname === '/rest/v1/rpc/durable_game_transition') {
        const result = await client.query(`SELECT public.durable_game_transition($1,$2,$3,$4,$5,$6,$7,$8) AS value`,
          ['p_operation','p_room_id','p_match_id','p_owner_id','p_fence','p_revision','p_request_id','p_state'].map(key => body[key]));
        data = result.rows[0].value;
      } else if (path.pathname === '/rest/v1/matches' && req.method === 'POST') {
        const fields = ['id','source_room_id','white_id','black_id','winner_id','winner_color','status','result','termination_reason','time_control','initial_time','increment','fen','initial_fen','final_fen','pgn','created_at','completed_at'];
        const result = await client.query(`INSERT INTO public.matches (${fields.join(',')}) VALUES (${fields.map((_, i) => '$'+(i+1)).join(',')}) RETURNING id`, fields.map(key => body[key]));
        data = result.rows[0];
      } else if (path.pathname === '/rest/v1/matches' && req.method === 'GET') {
        const id = path.searchParams.get('id')?.replace(/^eq\./, '');
        const result = await client.query('SELECT * FROM public.matches WHERE id=$1', [id]);
        data = req.headers.accept?.includes('vnd.pgrst.object') ? result.rows[0] : result.rows;
      } else throw new Error('Unexpected local test request');
      await client.query('COMMIT');
      if ((operation === 'complete' || (path.pathname === '/rest/v1/matches' && req.method === 'POST')) && controls.holdMatchResponse) {
        await once(res, 'close'); return; // simulate death after INSERT but before acknowledgement
      }
      if (operation === 'commit' && controls.loseAcknowledgement) {
        controls.loseAcknowledgement = false; req.socket.destroy(); return;
      }
      res.end(JSON.stringify(data));
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      res.writeHead(error.code === '23505' ? 409 : 503);
      res.end(JSON.stringify({ code: error.code ?? 'TEST_ERROR', message: 'isolated test failure' }));
    } finally {
      client?.release();
      if (operation === 'commit') controls.moveLatencies.push(performance.now() - started);
    }
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  return { pool, controls, url: `http://127.0.0.1:${http.address().port}`,
    async close() {
      await new Promise(resolve => http.close(resolve)); await pool.end();
      // pg-pool can resolve end() after removing clients from its list but before
      // their PostgreSQL backends have exited. FORCE can then send 57P01 to a
      // closing client and fail the test with an unhandled connection error.
      // Wait for actual backend exit and use a normal drop; do not hide errors.
      const deadline = Date.now() + 5000;
      while (true) {
        const remaining = await admin.query('SELECT count(*)::int AS n FROM pg_catalog.pg_stat_activity WHERE datname=$1', [database]);
        if (remaining.rows[0].n === 0) break;
        if (Date.now() >= deadline) throw new Error('Isolated test database connections did not close');
        await delay(25);
      }
      await admin.query('DROP DATABASE ' + database); await admin.end();
    } };
}
module.exports = { isolatedPostgres };
