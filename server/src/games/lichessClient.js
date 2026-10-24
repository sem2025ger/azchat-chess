'use strict';
const { GamesError } = require('./errors');
function createLichessClient({ fetchImpl = fetch, token = process.env.LICHESS_API_TOKEN, now = Date.now, timeoutMs = 8000, maxQueue = 64 } = {}) {
  let tail = Promise.resolve(), cooldown = 0, queued = 0;
  function request(path, { explorer = false, requiresAuth = explorer, accept = 'application/json' } = {}) {
    if (queued >= maxQueue) return Promise.reject(new GamesError('UPSTREAM_UNAVAILABLE'));
    queued++;
    const task = tail.then(async () => {
      if (now() < cooldown) throw new GamesError('UPSTREAM_RATE_LIMITED', Math.ceil((cooldown - now()) / 1000));
      // The current official explorer specification requires OAuth2.
      if (requiresAuth && !token) throw new GamesError('UPSTREAM_AUTH_REQUIRED');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl((explorer ? 'https://explorer.lichess.org' : 'https://lichess.org') + path, {
          headers: { Accept: accept, 'User-Agent': 'ChessAZ/1.0 (+https://chessaz.de)', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: controller.signal, redirect: 'error',
        });
        if (response.status === 429) { cooldown = now() + 60000; throw new GamesError('UPSTREAM_RATE_LIMITED', 60); }
        if (response.status === 401 || response.status === 403) throw new GamesError('UPSTREAM_AUTH_REQUIRED');
        if (response.status === 404) throw new GamesError('NOT_FOUND');
        if (!response.ok) throw new GamesError('UPSTREAM_UNAVAILABLE');
        // Keep timeout active until the entire bounded body is consumed.
        const reader = response.body.getReader();
        const chunks = []; let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new GamesError('UPSTREAM_UNAVAILABLE'); }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
        return Buffer.concat(chunks).toString('utf8');
      } catch (error) {
        if (error instanceof GamesError) throw error;
        throw new GamesError('UPSTREAM_UNAVAILABLE');
      } finally { clearTimeout(timer); }
    }).finally(() => { queued--; });
    tail = task.then(() => undefined, () => undefined); // Keep queue usable after failures.
    return task;
  }
  return { request };
}
module.exports = { createLichessClient };
