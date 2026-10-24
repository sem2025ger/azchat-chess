'use strict';
function createCache({ maxEntries = 256, now = Date.now } = {}) {
  const values = new Map();
  const pending = new Map();
  return {
    async get(key, ttl, load) {
      const hit = values.get(key);
      if (hit && hit.expires > now()) { values.delete(key); values.set(key, hit); return hit.value; }
      values.delete(key);
      if (pending.has(key)) return pending.get(key);
      // A bounded loader queue prevents unique-query floods from growing memory.
      if (pending.size >= maxEntries) throw new (require('./errors').GamesError)('UPSTREAM_UNAVAILABLE');
      const task = Promise.resolve().then(load).then(value => {
        values.set(key, { value, expires: now() + ttl });
        while (values.size > maxEntries) values.delete(values.keys().next().value);
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
  };
}
module.exports = { createCache };
