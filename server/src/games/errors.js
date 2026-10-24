'use strict';
const statuses = { INVALID_FEN: 400, INVALID_QUERY: 400, INVALID_USERNAME: 400, NOT_FOUND: 404, FEATURE_DISABLED: 404, UPSTREAM_RATE_LIMITED: 503, UPSTREAM_AUTH_REQUIRED: 503, UPSTREAM_UNAVAILABLE: 502, INTERNAL: 500 };
class GamesError extends Error {
  constructor(code, retryAfter) { super(code); this.code = code; this.status = statuses[code] || 500; this.retryAfter = retryAfter; }
}
function errorResponse(error, res) {
  const safe = error instanceof GamesError ? error : new GamesError('INTERNAL');
  if (safe.retryAfter) res.set('Retry-After', String(safe.retryAfter));
  return res.status(safe.status).json({ error: { code: safe.code, message: safe.code } });
}
module.exports = { GamesError, errorResponse };
