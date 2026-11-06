'use strict';

const QA_REF = 'iukmpcytsuofqhxsumbu';
const QA_SUPABASE_HOST = `${QA_REF}.supabase.co`;
const M3_RENDER_HOST = 'chessaz-m3-qa-api.onrender.com';

function checkedOrigin(value, host, variable) {
  const canonical = `https://${host}`;
  if (value !== canonical && value !== `${canonical}/`) {
    throw new Error(`${variable} must point to the dedicated QA origin`);
  }
  return canonical;
}

function qaTarget(env) {
  return {
    supabase: checkedOrigin(env.QA_SUPABASE_URL, QA_SUPABASE_HOST, 'QA_SUPABASE_URL'),
    api: checkedOrigin(env.M3_QA_API_URL, M3_RENDER_HOST, 'M3_QA_API_URL'),
  };
}

module.exports = { qaTarget, QA_REF, M3_RENDER_HOST };
