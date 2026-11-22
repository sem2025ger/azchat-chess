'use strict';

const express = require('express');

const inputs = {
  team_tournament_online_ready: ['p_actor', 'p_match', 'p_board'],
  team_tournament_online_claim_start: ['p_match', 'p_board', 'p_room_id'],
  team_tournament_online_mark_live: ['p_room_id'],
  team_tournament_online_release_start: ['p_room_id', 'p_claimed_at'],
  team_tournament_online_record_result: ['p_room_id', 'p_result', 'p_match_row_id'],
  team_tournament_online_forfeit_due: ['p_now'],
  team_tournament_online_unready: ['p_actor', 'p_match', 'p_board'],
  team_tournament_online_my_board: ['p_actor', 'p_tournament'],
};

async function tournamentOnlineRest(db) {
  const app = express();
  app.use(express.json());
  const routes = '/rest/v1';
  const handle = fn => async (req, res) => {
    const conn = await db.pool.connect();
    try {
      await conn.query('BEGIN');
      await conn.query('SET LOCAL ROLE service_role');
      const value = await fn(req, conn);
      await conn.query('COMMIT');
      res.json(value);
    } catch (error) {
      await conn.query('ROLLBACK');
      res.status(500).json({ code: error.code, message: error.message });
    } finally {
      conn.release();
    }
  };
  app.post(routes + '/rpc/durable_game_transition', async (req, res) => {
    const result = await fetch(db.url + req.path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: req.headers.apikey },
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(await result.json());
  });
  app.post(routes + '/rpc/team_tournament_m3_due_events', (_req, res) => res.json([]));
  app.post(routes + '/rpc/:name', handle(async (req, conn) => {
    const { name } = req.params;
    const fields = inputs[name];
    if (!fields) throw new Error('Unexpected fixture RPC ' + name);
    const params = fields.map(field => req.body[field] ?? null);
    const call = 'public.' + name + '(' + params.map((_, index) => '$' + (index + 1)).join(',') + ')';
    if (['team_tournament_online_forfeit_due', 'team_tournament_online_unready'].includes(name)) return (await conn.query('SELECT * FROM ' + call, params)).rows;
    return (await conn.query('SELECT ' + call + ' AS value', params)).rows[0].value;
  }));
  app.get(routes + '/team_tournament_m3_online_boards', handle(async (req, conn) => {
    const { headers, query } = req;
    const state = query.status.replace(/^eq\./, '');
    const ready = query.white_ready_at === 'not.is.null';
    const offset = Number(query.offset ?? headers.range?.split('-')[0] ?? 0);
    return (await conn.query(`SELECT to_jsonb(b) AS value FROM public.team_tournament_m3_online_boards b
      WHERE status=$1 AND (NOT $2 OR (white_ready_at IS NOT NULL AND black_ready_at IS NOT NULL))
      ORDER BY match_id,board_no LIMIT 200 OFFSET $3`, [state, ready, offset])).rows.map(row => row.value);
  }));
  app.get(routes + '/matches', handle(async (req, conn) => {
    const ids = (req.query.source_room_id ?? '').slice(4,-1).split(',');
    return (await conn.query(`SELECT id,source_room_id,result FROM public.matches
      WHERE status='completed' AND source_room_id=ANY($1::text[])`, [ids])).rows;
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise(resolve => server.close(resolve)) };
}

module.exports = { tournamentOnlineRest };
