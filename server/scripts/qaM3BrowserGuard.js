'use strict';
const { qaTarget } = require('./qaM3PilotTarget');
const PREVIEW = 'https://chessaz-preview-workspace-git-135194-semov20207-3068s-projects.vercel.app';
const BRANCH = 'feat/team-tournaments-m3-self-service-20261106';
function browserTarget(env) {
  const target = qaTarget(env);
  if (env.M3_QA_PREVIEW_URL !== PREVIEW) throw Error('Unapproved browser preview');
  if (env.GITHUB_REPOSITORY !== 'sem2025ger/azchat-chess' || env.M3_QA_BRANCH !== BRANCH || env.M3_QA_PR !== '194') {
    throw Error('Unapproved browser PR');
  }
  if (!/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID || '')) throw Error('Invalid run ID');
  return { ...target, preview: PREVIEW };
}
async function healthGuard(target, sha, fetcher = fetch) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('Invalid expected SHA');
  const response = await fetcher(target.api + '/health', { redirect: 'error', signal: AbortSignal.timeout(90000) });
  const value = await response.json();
  if (!response.ok || value.ok !== true || value.service !== 'aztr-chess-server' || value.commit !== sha) {
    throw Error('Render QA commit does not match the reviewed PR head.');
  }
}
function networkDecision(url, headers, target, tokens) {
  let parsed;
  try { parsed = new URL(url); } catch { return 'forbidden'; }
  const origin = parsed.origin.replace(/^wss:/, 'https:');
  const allowed = [target.preview, target.api, target.supabase].includes(origin);
  const outbound = url + '\n' + (headers.referer || headers.Referer || '');
  if (!allowed && tokens.some(token => outbound.includes(token))) return 'leak';
  if (allowed) return 'allow';
  if (/chessaz\.de|azchat-chess|chessaz-api|chessaz-deutsch-qa-api|kmwfvvliundhuovoakoa/.test(parsed.hostname)) return 'forbidden';
  return 'block';
}

async function guardBrowserRequest(route, target, tokens, markViolation) {
  const request = route.request();
  const decision = networkDecision(request.url(), request.headers(), target, tokens);
  if (decision !== 'allow') {
    if (decision !== 'block') markViolation();
    await route.abort('blockedbyclient');
    return;
  }

  // Chromium follows redirects without calling the Playwright route handler
  // again. Read exactly one response and never relay a redirect to Chromium.
  const response = await route.fetch({ maxRedirects: 0, timeout: 30000 }).catch(() => null);
  if (!response) {
    await route.abort('failed');
    return;
  }
  try {
    const status = response.status();
    if (status >= 300 && status < 400 && status !== 304) {
      markViolation();
      await route.abort('blockedbyclient');
      return;
    }
    await route.fulfill({ response });
  } finally {
    await response.dispose();
  }
}

module.exports = { PREVIEW, BRANCH, browserTarget, healthGuard, networkDecision, guardBrowserRequest };
