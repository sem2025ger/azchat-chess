'use strict';

const { randomUUID } = require('node:crypto');

const TIME_CONTROLS = ['1+0', '3+0', '3+2', '5+0', '10+0', '15+10'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const prefix = 'team_tournament_online_';

function createTeamTournamentOnline({
  io, client, durableEnabled, durableGames, reservePlayers, startRoom, announceRoom, hasRoom,
  publishDue, now = Date.now, log = entry => console.warn(JSON.stringify(entry)),
}) {
  let warned = false;
  let flight;
  let nextTick = 0;

  function status() {
    const durable = durableEnabled && durableGames.ready();
    if (!durable && !warned) {
      warned = true;
      log({ code: 'TOURNAMENT_ONLINE_REQUIRES_DURABLE' });
    }
    return { online_play: true, durable };
  }

  async function read(query) {
    const { data, error } = await query.abortSignal(AbortSignal.timeout(8000));
    if (error) throw Object.assign(new Error('Tournament online storage operation failed'), { code: error.code });
    return data;
  }

  const command = (name, args) => read(client.rpc(prefix + name, args));
  const key = board => ({ p_match: board.match_id, p_board: board.board_no });

  function notify(board) {
    if (!board?.match_id) return;
    for (const socket of io.sockets.sockets.values()) {
      if (socket.connected && [board.white_id, board.black_id].includes(socket.data.userId)) {
        socket.emit('tournament_board_status', { matchId: board.match_id, boardNo: board.board_no,
          status: board.status, ready: Boolean(socket.data.userId === board.white_id
            ? board.white_ready_at : board.black_ready_at) });
      }
    }
  }

  async function attempt(board) {
    if (!board || board.status !== 'scheduled' || !board.white_ready_at || !board.black_ready_at || !status().durable) return;
    const reservation = reservePlayers(board.white_id, board.black_id, board.reserved_room_id);
    if (!reservation) return;
    let assigned;
    try {
      assigned = await command('claim_start', { ...key(board), p_room_id: randomUUID() });
      if (assigned?.status !== 'starting') return;
      try {
        await startRoom(assigned, reservation);
        const live = await command('mark_live', { p_room_id: assigned.room_id });
        if (live?.status === 'live') {
          announceRoom(assigned.room_id);
          notify(live);
        }
      } catch {
        // The release RPC promotes a committed durable start if its ACK was lost.
        const recovered = await command('release_start', { p_room_id: assigned.room_id, p_claimed_at: assigned.claimed_at });
        if (recovered?.status === 'live') announceRoom(assigned.room_id);
        notify(recovered);
        log({ code: 'TOURNAMENT_ONLINE_START_RETRY' });
      }
    } finally {
      reservation.release();
    }
  }

  function register(socket) {
    socket.on('tournament_board_ready', async (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      if (!socket.data?.limiter?.allow('lobby')) return reply({ code: 'rate_limit_exceeded' });
      const { matchId, boardNo } = payload ?? {};
      if (typeof matchId !== 'string' || !UUID.test(matchId) || !Number.isInteger(boardNo) || boardNo < 1 || boardNo > 16) {
        return reply({ code: 'invalid_input' });
      }
      if (!status().durable || !client) return reply({ code: 'storage_unavailable' });
      try {
        const board = await command('ready', { p_actor: socket.data.userId, p_match: matchId, p_board: boardNo });
        if (board.code) return reply({ code: board.code });
        notify(board);
        reply({ ok: true });
        void attempt(board).catch(() => log({ code: 'TOURNAMENT_ONLINE_START_RETRY' }));
      } catch {
        log({ code: 'TOURNAMENT_ONLINE_READY_FAILED' });
        // A client retries readiness safely even if PostgreSQL committed it.
        reply({ code: 'storage_unavailable' });
      }
    });
  }

  async function list(state, readyOnly = false) {
    const rows = [];
    for (let start = 0; ; start += 200) {
      let query = client.from('team_tournament_m3_online_boards').select('*').eq('status', state);
      if (readyOnly) query = query.not('white_ready_at', 'is', null).not('black_ready_at', 'is', null);
      const batch = await read(query.order('match_id').order('board_no').range(start, start + 199));
      rows.push(...batch);
      if (batch.length < 200) return rows;
    }
  }

  async function run() {
    await publishDue();
    const [live, starting] = await Promise.all([list('live'), list('starting')]);
    for (const board of starting) {
      const stale = now() - Date.parse(board.claimed_at) >= 60_000 && !hasRoom(board.room_id);
      const updated = await (stale
        ? command('release_start', { p_room_id: board.room_id, p_claimed_at: board.claimed_at })
        : command('mark_live', { p_room_id: board.room_id }));
      if (updated?.status === 'live') {
        announceRoom(board.room_id);
        live.push(updated);
      }
      if (updated?.status !== board.status) notify(updated);
    }
    for (let offset = 0; offset < live.length; offset += 50) {
      const ids = live.slice(offset, offset + 50).map(board => board.room_id);
      const matches = await read(client.from('matches').select('id,source_room_id,result')
        .eq('status', 'completed').in('source_room_id', ids));
      for (const game of matches) {
        try {
          const board = await command('record_result', { p_room_id: game.source_room_id,
            p_result: game.result, p_match_row_id: game.id });
          notify(board);
        } catch {
          log({ code: 'TOURNAMENT_ONLINE_RESULT_RETRY' });
        }
      }
    }
    const forfeits = await command('forfeit_due', { p_now: new Date(now()).toISOString() });
    forfeits.forEach(notify);
    for (const board of await list('scheduled', true)) {
      try { await attempt(board); }
      catch { log({ code: 'TOURNAMENT_ONLINE_START_RETRY' }); }
    }
  }

  function tick() {
    if (flight) return flight;
    if (now() < nextTick) return Promise.resolve();
    nextTick = now() + 5000;
    if (!status().durable || !client) return Promise.resolve();
    flight = run().finally(() => { flight = null; });
    return flight;
  }

  return { status, register, tick };
}

module.exports = { createTeamTournamentOnline, TIME_CONTROLS };
