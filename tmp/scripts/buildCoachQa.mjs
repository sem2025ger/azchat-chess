// Explicitly isolated QA build; never inherit production bindings or secrets.
import {build, mergeConfig} from 'vite';
import config from '../vite.config.ts';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export const qaApi = 'https://chessaz-ai-coach-v1-isolated-qa.onrender.com';
export const qaSupabase = 'https://iukmpcytsuofqhxsumbu.supabase.co';

export function coachQaBindings(env) {
  if (env.VITE_SERVER_URL !== qaApi || env.VITE_SUPABASE_URL !== qaSupabase) {
    throw new Error('QA build blocked: isolated API and Supabase bindings required');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(env.VITE_SUPABASE_ANON_KEY || '')) {
    throw new Error('QA build blocked: existing public Supabase key required');
  }
  for (const key of ['VITE_AI_COACH_ENABLED', 'VITE_SPIELER_V1_ENABLED', 'VITE_POSITION_SEARCH_ENABLED']) {
    if (env[key] !== 'true') throw new Error('QA build blocked: required QA flag missing');
  }
  return {
    VITE_SERVER_URL: qaApi,
    VITE_SUPABASE_URL: qaSupabase,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
    VITE_AI_COACH_ENABLED: 'true',
    VITE_SPIELER_V1_ENABLED: 'true',
    VITE_POSITION_SEARCH_ENABLED: 'true',
    VITE_MAINTENANCE_MODE: 'false',
    VITE_SENTRY_DSN: '',
    ...Object.fromEntries(['CLUBS_NRW', 'SPIELTAG', 'VORBEREITUNG'].map(name => {
      const key = `VITE_${name}_ENABLED`;
      return [key, env[key] === 'true' ? 'true' : 'false'];
    })),
  };
}

export function coachQaConfig(env) {
  return mergeConfig(config, {
    configFile: false, envDir: false, envPrefix: 'CHESSAZ_COACH_QA_UNUSED_',
    define: Object.fromEntries(Object.entries(coachQaBindings(env)).map(([key, value]) =>
      [`import.meta.env.${key}`, JSON.stringify(value)])),
    plugins: [{name: 'coach-qa-noindex', transformIndexHtml() {
      return [{tag: 'meta', attrs: {name: 'robots', content: 'noindex,nofollow'}, injectTo: 'head-prepend'}];
    }}],
    build: {outDir: 'dist-coach-qa', emptyOutDir: true},
  });
}

export async function buildCoachQa(sourceSha, env = process.env) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha || '')) throw new Error('A full reviewed source SHA is required');
  if (env.VERCEL_GIT_COMMIT_SHA && env.VERCEL_GIT_COMMIT_SHA !== sourceSha) {
    throw new Error('QA build blocked: source SHA mismatch');
  }
  const buildConfig = coachQaConfig(env);
  execFileSync(process.execPath, ['scripts/prepareStockfish19.mjs'], {stdio: 'inherit'});
  await build(buildConfig);
  await writeFile(resolve('dist-coach-qa/snapshot.json'), JSON.stringify({
    sourceRepository: 'sem2025ger/azchat-chess', sourceSha,
    mode: 'isolated-coach-qa', backend: qaApi, supabase: qaSupabase,
    openaiVerified: false,
  }, null, 2) + '\n');
  console.log('PASS isolated Coach QA build: ' + sourceSha);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildCoachQa(process.argv[2]);
}
