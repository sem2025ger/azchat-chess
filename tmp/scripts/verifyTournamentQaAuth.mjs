// Validate only the QA Vercel preview, never production or local/CI builds.
// The public anon key is expected here; service-role/secret keys are forbidden.
const qaUrl = 'https://iukmpcytsuofqhxsumbu.supabase.co';
const qaServer = 'https://chessaz-deutsch-qa-api.onrender.com';
const knownBranches = new Set(['feat/neo-individual-tournament-lifecycle-20261124','feat/individual-tournament-ui-20261125']);

export async function verifyTournamentQaAuth(env, fetchImpl = fetch) {
  if (env.VERCEL_ENV !== 'preview' ||
      !(env.VITE_SUPABASE_URL === qaUrl || env.VITE_SERVER_URL === qaServer || knownBranches.has(env.VERCEL_GIT_COMMIT_REF))) return false;
  if (env.VITE_SUPABASE_URL !== qaUrl || env.VITE_SERVER_URL !== qaServer) {
    throw new Error('QA Preview: expected QA Supabase and Render endpoints.');
  }
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (typeof key !== 'string') throw new Error('QA Preview: missing public Supabase key.');
  if (!/^sb_publishable_[A-Za-z0-9_-]{10,100}$/.test(key)) {
    let claims;
    try {
      const parts = key.split('.');
      if (parts.length !== 3 || key.length > 512 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch { throw new Error('QA Preview: invalid public Supabase key format. Obtain it directly from QA Supabase.'); }
    if (claims?.role !== 'anon' || claims.ref !== 'iukmpcytsuofqhxsumbu' ||
        !Number.isFinite(claims.exp) || claims.exp <= Date.now()/1000) {
      throw new Error('QA Preview: public key role, project or expiry is invalid.');
    }
  }
  let response;
  try {
    response = await fetchImpl(qaUrl + '/auth/v1/settings', {
      headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(12000),
    });
  } catch { throw new Error('QA Preview: Supabase auth connectivity could not be verified.'); }
  if (!response.ok) throw new Error('QA Preview: Supabase auth key verification failed (HTTP ' + response.status + ').');
  return true;
}
