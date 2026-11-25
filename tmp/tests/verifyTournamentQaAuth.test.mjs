import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTournamentQaAuth } from '../scripts/verifyTournamentQaAuth.mjs';

const env = {
  VERCEL_ENV:'preview', VITE_SUPABASE_URL:'https://iukmpcytsuofqhxsumbu.supabase.co',
  VITE_SERVER_URL:'https://chessaz-deutsch-qa-api.onrender.com',
};
const jwt = claims => ['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify(claims)).toString('base64url'),'fixtureSignature'].join('.');
const anon = jwt({ role:'anon',ref:'iukmpcytsuofqhxsumbu',exp:4102444800 });
const never = () => { throw new Error('unexpected request'); };

test('QA Preview validates public anon and publishable keys against the fixed Auth endpoint', async () => {
  for (const key of [anon,'sb_publishable_fixture_public_key']) {
    let called = false;
    assert.equal(await verifyTournamentQaAuth({...env,VITE_SUPABASE_ANON_KEY:key},async (url,init) => {
      called = true;
      assert.equal(url,env.VITE_SUPABASE_URL+'/auth/v1/settings');
      assert.equal(init.headers.apikey,key);
      assert.equal(init.redirect,'error');
      return new Response('{}',{status:200});
    }),true);
    assert.ok(called);
  }
});
test('QA Preview rejects encrypted copies, privileged and foreign keys before network access', async () => {
  for (const key of [undefined,'eyJ'+ 'x'.repeat(1800),'sb_secret_fake',
    jwt({role:'service_role',ref:'iukmpcytsuofqhxsumbu',exp:4102444800}),
    jwt({role:'anon',ref:'other',exp:4102444800}),jwt({role:'anon',ref:'iukmpcytsuofqhxsumbu',exp:1})]) {
    let calls=0;
    await assert.rejects(verifyTournamentQaAuth({...env,VITE_SUPABASE_ANON_KEY:key},()=>{calls++;return never();}),/QA Preview:/);
    assert.equal(calls,0);
  }
  await assert.rejects(verifyTournamentQaAuth({...env,VITE_SERVER_URL:'https://wrong.invalid',VITE_SUPABASE_ANON_KEY:anon},never),/expected QA/);
});
test('QA Preview fails closed on rejected key or unavailable Auth; skips production and CI', async () => {
  await assert.rejects(verifyTournamentQaAuth({...env,VITE_SUPABASE_ANON_KEY:anon},async()=>new Response(null,{status:401})),/HTTP 401/);
  await assert.rejects(verifyTournamentQaAuth({...env,VITE_SUPABASE_ANON_KEY:anon},never),/connectivity/);
  assert.equal(await verifyTournamentQaAuth({...env,VERCEL_ENV:'production'},never),false);
  assert.equal(await verifyTournamentQaAuth({},never),false);
});
