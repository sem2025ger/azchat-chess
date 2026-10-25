'use strict';

// Integration tests run only against a disposable PostgreSQL database on the
// GitHub Actions localhost service, NEVER against Supabase or a remote server.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const url = process.env.DURABLE_TEST_DATABASE_URL;
const local = (() => {
  if (!url) return false;
  try { return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname); }
  catch { return false; }
})();

test('ChessAZ Deutsch PostgreSQL migration and RLS integration (isolated)', { skip: !local }, async t => {
  const admin = new Client({ connectionString: url });
  await admin.connect();
  const database = 'chessaz_ci_' + randomBytes(6).toString('hex');
  let created = false;
  const dbUrl = new URL(url);
  dbUrl.pathname = '/' + database;
  const connectionString = dbUrl.toString();
  let setup;
  const ids = {
    alice: '11111111-1111-4111-8111-111111111111',
    bob: '22222222-2222-4222-8222-222222222222',
    charlie: '33333333-3333-4333-8333-333333333333',
    dave: '44444444-4444-4444-8444-444444444444',
  };

  async function as(user, action) {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      await client.query('SET ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [ids[user]]);
      return await action(client);
    } finally {
      await client.end();
    }
  }
  async function denied(action) {
    await assert.rejects(action, err => err && err.code === '42501');
  }

  try {
    await admin.query('CREATE DATABASE "' + database + '"');
    created = true;
    setup = new Client({ connectionString });
    await setup.connect();
    await setup.query("DO $$ BEGIN BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END; BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END; END $$");
    await setup.query("CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;");
    await setup.query('GRANT USAGE ON SCHEMA public TO anon, authenticated; CREATE TABLE public.profiles(id uuid PRIMARY KEY);');
    for (const id of Object.values(ids)) {
      await setup.query('INSERT INTO public.profiles (id) VALUES ($1)', [id]);
    }
    const sql = readFileSync(join(__dirname, '../supabase/migrations/20261021000000_chessaz_deutsch_community_foundation.sql'), 'utf8');
    await setup.query(sql);
    const { rows } = await setup.query("SELECT id FROM public.chess_clubs WHERE slug='chessaz-deutsch'");
    assert.equal(rows.length, 1, 'founding club must be seeded');
    const clubId = rows[0].id;
    await setup.end();
    setup = null;

    await t.test('tables enforce RLS and API grants are restricted', async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        const result = await client.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1)", [
          ['chess_clubs', 'chess_club_members', 'chess_club_messages', 'chess_club_events', 'chess_club_event_participants']
        ]);
        assert.equal(result.rows.length, 5);
        assert.ok(result.rows.every(row => row.relrowsecurity));
        const grants = await client.query(
          "SELECT has_table_privilege('authenticated','public.chess_club_members','UPDATE') AS can_update, has_table_privilege('anon','public.chess_club_members','SELECT') AS anonymous_roster"
        );
        assert.equal(grants.rows[0].can_update, false);
        assert.equal(grants.rows[0].anonymous_roster, false);
      } finally { await client.end(); }
    });

    await t.test('club join succeeds; forged membership and privilege escalation fail', async () => {
      await as('alice', c => c.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES ($1,$2)', [clubId, ids.alice]));
      await as('bob', c => c.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES ($1,$2)', [clubId, ids.bob]));
      await denied(() => as('charlie', c => c.query(
        "INSERT INTO public.chess_club_members(club_id,user_id,role) VALUES ($1,$2,'admin')", [clubId, ids.charlie]
      )));
      await denied(() => as('charlie', c => c.query(
        'INSERT INTO public.chess_club_members(club_id,user_id) VALUES ($1,$2)', [clubId, ids.dave]
      )));
      const result = await as('charlie', c => c.query('SELECT COUNT(*)::int AS n FROM public.chess_club_members WHERE club_id=$1', [clubId]));
      assert.equal(result.rows[0].n, 2);
    });

    await t.test('only members can read or write messages; authorship cannot be forged', async () => {
      await as('alice', c => c.query(
        'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES ($1,$2,$3)',
        [clubId, ids.alice, 'Welcome!']
      ));
      const memberRead = await as('bob', c => c.query('SELECT body FROM public.chess_club_messages WHERE club_id=$1', [clubId]));
      assert.equal(memberRead.rows[0].body, 'Welcome!');
      const outsideRead = await as('charlie', c => c.query('SELECT body FROM public.chess_club_messages WHERE club_id=$1', [clubId]));
      assert.equal(outsideRead.rows.length, 0);
      await denied(() => as('charlie', c => c.query(
        'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES ($1,$2,$3)',
        [clubId, ids.charlie, 'Outside post']
      )));
      await denied(() => as('bob', c => c.query(
        'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES ($1,$2,$3)',
        [clubId, ids.alice, 'Forged authorship']
      )));
    });

    let eventId;
    await t.test('event visibility, membership and author ownership are enforced', async () => {
      const event = await as('alice', c => c.query(
        "INSERT INTO public.chess_club_events(club_id,created_by,title,format,min_players,max_players) VALUES($1,$2,'Friday blitz','blitz',2,2) RETURNING id",
        [clubId, ids.alice]
      ));
      eventId = event.rows[0].id;
      const outsideRead = await as('charlie', c => c.query(
        'SELECT id FROM public.chess_club_events WHERE club_id=$1', [clubId]
      ));
      assert.equal(outsideRead.rows.length, 0);
      await denied(() => as('charlie', c => c.query(
        'INSERT INTO public.chess_club_event_participants(event_id,user_id) VALUES($1,$2)', [eventId, ids.charlie]
      )));
      await denied(() => as('bob', c => c.query(
        "INSERT INTO public.chess_club_events(club_id,created_by,title) VALUES($1,$2,'Forged event')", [clubId, ids.alice]
      )));
    });

    await t.test('participant cap and deletion of another user signup', async () => {
      await as('alice', c => c.query(
        'INSERT INTO public.chess_club_event_participants(event_id,user_id) VALUES($1,$2)', [eventId, ids.alice]
      ));
      await as('bob', c => c.query(
        'INSERT INTO public.chess_club_event_participants(event_id,user_id) VALUES($1,$2)', [eventId, ids.bob]
      ));
      const unauthorizedDelete = await as('bob', c => c.query(
        'DELETE FROM public.chess_club_event_participants WHERE event_id=$1 AND user_id=$2 RETURNING user_id',
        [eventId, ids.alice]
      ));
      assert.equal(unauthorizedDelete.rows.length, 0);
      await as('charlie', c => c.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES ($1,$2)', [clubId, ids.charlie]));
      await assert.rejects(() => as('charlie', c => c.query(
        'INSERT INTO public.chess_club_event_participants(event_id,user_id) VALUES($1,$2)', [eventId, ids.charlie]
      )), err => err?.code === '23514');
    });

    await t.test('parallel sign-ups never exceed event max_players', async () => {
      await as('dave', c => c.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES ($1,$2)', [clubId, ids.dave]));
      const event = await as('alice', c => c.query(
        "INSERT INTO public.chess_club_events(club_id,created_by,title,min_players,max_players) VALUES($1,$2,'Parallel signup',2,2) RETURNING id",
        [clubId, ids.alice]
      ));
      const target = event.rows[0].id;
      await as('alice', c => c.query(
        'INSERT INTO public.chess_club_event_participants(event_id,user_id) VALUES($1,$2)', [target, ids.alice]
      ));
      const signup = user => as(user, c => c.query(
        'INSERT INTO public.chess_club_event_participants(event_id,user_id) VALUES($1,$2)', [target, ids[user]]
      ));
      const results = await Promise.allSettled([signup('charlie'), signup('dave')]);
      assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal(results.filter(x => x.status === 'rejected' && x.reason?.code === '23514').length, 1);
      const count = await as('alice', c => c.query(
        'SELECT COUNT(*)::int AS n FROM public.chess_club_event_participants WHERE event_id=$1', [target]
      ));
      assert.equal(count.rows[0].n, 2);
    });
  } finally {
    if (setup) await setup.end().catch(() => {});
    if (created) await admin.query('DROP DATABASE IF EXISTS "' + database + '" WITH (FORCE)');
    await admin.end();
  }
});
