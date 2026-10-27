'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const sample = require('./test-support/spielerFixture.cjs').acceptance();

test('NRW/Spieler real PostgreSQL: ordered migrations, club validation and legacy privacy', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL,
  timeout: 30000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  const legacyActor = '11111111-1111-4111-8111-111111111111';
  const actor = '22222222-2222-4222-8222-222222222222';
  const legacyId = Number(sample.fide_id), fideId = legacyId + 1;
  const legacy = 'PRIVATE legacy association — never publish';
  const migrate = file => db.pool.query(readFileSync(join(__dirname, '../supabase/migrations', file), 'utf8'));
  async function as(role, sql, args = []) {
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE ' + role);
      const result = await c.query(sql, args);
      await c.query('COMMIT');
      return result.rows[0]?.value;
    } catch (error) {
      await c.query('ROLLBACK');
      throw error;
    } finally { c.release(); }
  }
  const claim = club => as('service_role', "SELECT public.spieler_request('claim',$1,$2,$3) AS value", [actor, fideId, club]);
  const card = id => as('service_role', 'SELECT public.spieler_search(NULL,$1) AS value', [id]);
  try {
    await db.pool.query(`CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      ALTER TABLE public.profiles ADD COLUMN username text;
      GRANT SELECT ON public.profiles TO service_role;
      -- Match the existing hosted Supabase public-table defaults. Each migration
      -- must still revoke browser access explicitly; BYPASSRLS alone is no grant.
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
    await migrate('20261021000000_chessaz_deutsch_community_foundation.sql');
    for (const file of [
      '20261026184317_spieler_v1.sql',
      '20261026201936_spieler_review_privacy.sql',
      '20261026210344_spieler_hide_abuse_limits.sql',
    ]) await migrate(file);
    for (const id of [legacyId, fideId]) {
      await db.pool.query(`INSERT INTO public.spieler_players
        (fide_id,name,surname,federation,title,fide_rating,source_date,source_url)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, sample.name, sample.surname,
        sample.federation, sample.title, sample.fide_rating, sample.source_date, sample.source_url]);
    }
    await db.pool.query("INSERT INTO public.spieler_claims(user_id,fide_id,status,club) VALUES($1,$2,'verified',$3)", [legacyActor, legacyId, legacy]);
    await migrate('20261026224500_clubs_nrw_v1.sql');
    await migrate('20261027001000_spieler_clubs_nrw_fk.sql');
    const { rows: [club, other] } = await db.pool.query('SELECT id,name FROM public.clubs_nrw ORDER BY slug');
    await db.pool.query('UPDATE public.clubs_nrw SET published=false WHERE id=$1', [other.id]);

    await t.test('verified legacy text survives privately but is absent from surname and ID search', async () => {
      const saved = await db.pool.query('SELECT club_legacy,club_id FROM public.spieler_claims WHERE user_id=$1', [legacyActor]);
      assert.equal(saved.rows[0].club_legacy, legacy);
      assert.equal(saved.rows[0].club_id, null);
      for (const result of [await card(legacyId), await as('service_role', 'SELECT public.spieler_search($1) AS value', [sample.surname])]) {
        assert.ok(result.length > 0);
        assert.ok(result.every(p => p.club === null && !Object.hasOwn(p, 'club_legacy')));
        assert.ok(!JSON.stringify(result).includes(legacy));
      }
    });
    await t.test('unknown, unpublished and malformed club IDs raise invalid_club without storing a claim', async () => {
      for (const id of ['99999999-9999-4999-8999-999999999999', other.id, 'not-a-uuid']) {
        await assert.rejects(claim(id), error => error.code === '22023' && error.message === 'invalid_club');
      }
      assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.spieler_claims WHERE user_id=$1', [actor])).rows[0].n, 0);
    });
    await t.test('published club claim is accepted and becomes visible only after owner verification', async () => {
      assert.equal((await claim(club.id)).status, 'pending');
      assert.equal((await card(fideId))[0].club, null);
      const reviewed = await as('service_role', "SELECT spieler_admin.review('claim',$1,$2,'approve') AS value", [actor, fideId]);
      assert.equal(reviewed.status, 'verified');
      assert.equal((await card(fideId))[0].club, club.name);
      const results = await as('service_role', 'SELECT public.spieler_search($1) AS value', [sample.surname]);
      assert.equal(results.find(p => Number(p.fide_id) === fideId).club, club.name);
      assert.ok(results.every(p => !Object.hasOwn(p, 'club_legacy')));
      assert.equal((await claim(club.id)).status, 'verified', 'unchanged selected club preserves verification');
      await db.pool.query('UPDATE public.clubs_nrw SET published=false WHERE id=$1', [club.id]);
      assert.equal((await card(fideId))[0].club, null, 'unpublishing also hides an already verified association');
    });
    await t.test('replacing RPCs preserves server-only permissions', async () => {
      for (const role of ['anon', 'authenticated']) {
        await assert.rejects(as(role, 'SELECT public.spieler_search(NULL,$1) AS value', [fideId]), error => error.code === '42501');
        await assert.rejects(as(role, "SELECT public.spieler_request('claim',$1,$2,NULL) AS value", [actor, fideId]), error => error.code === '42501');
      }
    });
  } finally { await db.close(); }
});
