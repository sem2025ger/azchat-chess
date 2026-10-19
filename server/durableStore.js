'use strict';

const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

class DurableError extends Error {
  constructor(code = '08006') {
    super('Durable game operation unavailable');
    this.code = code;
  }
}

function createDurableStore(client, ownerId = randomUUID()) {
  async function call(operation, row = {}, state = null, requestId = randomUUID()) {
    let response;
    try {
      response = await client.rpc('durable_game_transition', {
        p_operation: operation, p_room_id: row.room_id ?? null,
        p_match_id: row.match_id ?? null, p_owner_id: ownerId,
        p_fence: row.fence ?? 1, p_revision: row.revision ?? 0,
        p_request_id: requestId, p_state: state,
      }).abortSignal(AbortSignal.timeout(8000));
    } catch { throw new DurableError(); }
    if (response.error) {
      const code = /^[A-Z0-9_]{1,32}$/.test(response.error.code ?? '')
        ? response.error.code : 'storage_unavailable';
      throw new DurableError(code);
    }
    if (!response.data?.ok) throw new DurableError(response.data?.code);
    return response.data;
  }

  return {
    ownerId,
    scan: async () => (await call('scan')).rows,
    read: async roomId => (await call('read', { room_id: roomId })).row,
    claim: async row => (await call('claim', row)).row,
    renew: async row => (await call('renew', row)).row,
    async isUninstalled() {
      let response;
      try {
        response = await client.from('durable_games').select('room_id').limit(1)
          .abortSignal(AbortSignal.timeout(8000));
      } catch { throw new DurableError(); }
      // A missing RPC alone is insufficient: the table may contain games from
      // an earlier activation. Only confirmed absence permits legacy startup.
      if (['42P01', 'PGRST205'].includes(response.error?.code)) return true;
      if (response.error) throw new DurableError();
      return false;
    },
    async write(operation, row, state) {
      const requestId = randomUUID();
      try {
        return (await call(operation, row, state, requestId)).row;
      } catch (error) {
        // Exceptional path only. A timeout may mean COMMIT succeeded. Read the
        // request identity/revision; never reapply the move or blindly retry.
        if (['ownership_lost', 'revision_conflict', 'invalid_transition',
          'result_unconfirmed'].includes(error.code)) throw error;
        try {
          const committed = (await call('read', row)).row;
          const expected = operation === 'start' ? 0 : Number(row.revision) + 1;
          if (committed.last_request === requestId && Number(committed.revision) === expected
            && committed.owner_id === ownerId && Number(committed.fence) === Number(row.fence ?? 1)
            && Date.parse(committed.lease_until) > Date.now()) return committed;
        } catch { /* Preserve the original safe diagnostic. */ }
        throw error;
      }
    },
    async completedMatch(matchId) {
      let response;
      try {
        response = await client.from('matches')
          .select('id, source_room_id, white_id, black_id, initial_fen, pgn, final_fen, status')
          .eq('id', matchId).single().abortSignal(AbortSignal.timeout(8000));
      } catch { throw new DurableError(); }
      if (response.error || !response.data) throw new DurableError();
      return response.data;
    },
  };
}

function createDurableStoreFromEnv(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
  return createDurableStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}

module.exports = { createDurableStore, createDurableStoreFromEnv, DurableError };
