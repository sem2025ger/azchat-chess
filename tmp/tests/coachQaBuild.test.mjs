import test from 'node:test';
import assert from 'node:assert/strict';
import {coachQaBindings, coachQaConfig, buildCoachQa, qaApi, qaSupabase} from '../scripts/buildCoachQa.mjs';

const env = {
  VITE_SERVER_URL: qaApi, VITE_SUPABASE_URL: qaSupabase,
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_qa_test_fixture_123456789',
  VITE_AI_COACH_ENABLED: 'true', VITE_SPIELER_V1_ENABLED: 'true', VITE_POSITION_SEARCH_ENABLED: 'true',
};

test('QA build rejects production, alternate projects, redirects and missing bindings', () => {
  for (const [key, values] of Object.entries({
    VITE_SERVER_URL: [undefined, 'https://chessaz-api.onrender.com', qaApi + '/redirect'],
    VITE_SUPABASE_URL: [undefined, 'https://another-project.supabase.co', qaSupabase + '/'],
    VITE_SUPABASE_ANON_KEY: [undefined, 'sb_secret_not_a_public_key_123456789', 'eyJservice_role'],
  })) for (const value of values) assert.throws(() => coachQaBindings({...env, [key]: value}), /QA build blocked/);
  for (const key of ['VITE_AI_COACH_ENABLED', 'VITE_SPIELER_V1_ENABLED', 'VITE_POSITION_SEARCH_ENABLED']) {
    assert.throws(() => coachQaBindings({...env, [key]: 'false'}), /required QA flag/);
  }
});

test('QA build whitelists client variables and excludes secrets and production telemetry', () => {
  const actual = coachQaBindings({...env,
    OPENAI_API_KEY: 'private-key-fixture', SUPABASE_SERVICE_KEY: 'private-service-fixture',
    VITE_OPENAI_API_KEY: 'accidentally-public-fixture', VITE_SENTRY_DSN: 'production-telemetry-fixture',
    VITE_CLUBS_NRW_ENABLED: 'true',
  });
  const serialized = JSON.stringify(actual);
  assert.doesNotMatch(serialized, /private-|accidentally-public|production-telemetry/);
  assert.equal(actual.VITE_CLUBS_NRW_ENABLED, 'true');
  assert.equal(actual.VITE_SPIELTAG_ENABLED, 'false');
  assert.equal(actual.VITE_MAINTENANCE_MODE, 'false');
  assert.equal(actual.VITE_SUPABASE_ANON_KEY, env.VITE_SUPABASE_ANON_KEY);
});

test('QA build disables env files and automatic VITE exposure', () => {
  const actual = coachQaConfig(env);
  assert.equal(actual.configFile, false);
  assert.equal(actual.envDir, false);
  assert.equal(actual.envPrefix, 'CHESSAZ_COACH_QA_UNUSED_');
  assert.equal(actual.define['import.meta.env.VITE_SERVER_URL'], JSON.stringify(qaApi));
  assert.equal(actual.build.outDir, 'dist-coach-qa');
});

test('QA build refuses absent and mismatched source identity before building', async () => {
  await assert.rejects(buildCoachQa(undefined, env), /full reviewed source SHA/);
  await assert.rejects(buildCoachQa('a'.repeat(40), {...env, VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40)}), /source SHA mismatch/);
});
