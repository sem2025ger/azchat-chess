'use strict';

const { randomUUID } = require('node:crypto');
const { Chess } = require('chess.js');
const { persistRoomCompletedMatch } = require('./matchPersistence');
const { DurableError } = require('./durableStore');

const STATE_FIELDS = ['userIds', 'initialFen', 'timeControl', 'initialTime', 'increment',
  'whiteTimeMs', 'blackTimeMs', 'lastMoveTimestamp', 'startedAt', 'status',
  'drawOfferBy', 'outcome', 'completedAt', 'isPrivate'];

function snapshot(room) {
  const state = {};
  for (const key of STATE_FIELDS) if (room[key] !== undefined) state[key] = room[key];
  state.moves = room.game.history();
  state.disconnects = Object.fromEntries(['w', 'b'].map(color => [color, {
    disconnectedAt: room.disconnects?.[color]?.disconnectedAt ?? null,
    deadline: room.disconnects?.[color]?.deadline ?? null,
  }]));
  return structuredClone(state);
}

function restore(row, previous = {}) {
  const state = row.state;
  const game = new Chess(state.initialFen);
  for (const move of state.moves) game.move(move);
  return Object.assign(previous, state, {
    roomId: row.room_id, matchId: row.match_id, game, durable: true, durableRow: row,
    blocked: false, persisted: row.result_saved,
    players: previous.players ?? { w: null, b: null },
    socketIds: previous.socketIds ?? new Set(),
    disconnects: Object.fromEntries(['w', 'b'].map(color => [color, {
      ...state.disconnects[color], timer: null,
    }])),
  });
}

function clocks(room, now = Date.now()) {
  let w = room.whiteTimeMs, b = room.blackTimeMs;
  if (room.status === 'active') {
    const elapsed = Math.max(0, now - room.lastMoveTimestamp);
    if (room.game.turn() === 'w') w -= elapsed;
    else b -= elapsed;
  }
  return { whiteTime: Math.ceil(Math.max(0, w) / 1000), blackTime: Math.ceil(Math.max(0, b) / 1000) };
}

function createDurableGames({ store, enabled = false, rooms, socketToRoom, io,
  getMatchPersistence, naturalGameOver, now = Date.now,
  log = entry => console.error(JSON.stringify(entry)),
}) {
  const queues = new Map();
  let storageHealthy = !enabled && !store;
  let scanPromise = null;
  let nextScanAt = 0;
  let retryDelay = 5000;
  let recoveryRequired = false;
  let schemaAbsent = false;
  let tickPromise = null;
  const terminalNotices = new WeakMap();
  const opposite = color => color === 'w' ? 'b' : 'w';
  const diagnostic = error => log({ code: 'DURABLE_GAME_UNAVAILABLE',
    errorCode: /^[a-zA-Z0-9_]{1,40}$/.test(error?.code ?? '') ? error.code : 'storage_unavailable' });

  function serial(roomId, work) {
    const pending = (queues.get(roomId) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(roomId, pending);
    void pending.finally(() => { if (queues.get(roomId) === pending) queues.delete(roomId); }).catch(() => {});
    return pending;
  }

  function ready() {
    // Readiness governs NEW starts and HTTP availability. With the flag off,
    // optional recovery failures must not take legacy volatile games offline.
    // Existing durable rooms still enforce storage/ownership checks themselves.
    return !enabled || (storageHealthy && ![...rooms.values()].some(room => room.durable && room.blocked));
  }

  function hasPendingRooms() {
    return [...rooms.values()].some(room => room.durable && !room.durableRow.result_saved);
  }

  function notifySocketEnded(socket, roomId, outcome) {
    let notified = terminalNotices.get(socket);
    if (!notified) { notified = new Set(); terminalNotices.set(socket, notified); }
    if (notified.has(roomId)) return;
    notified.add(roomId);
    socket.emit('game_over', { roomId, ...outcome });
  }

  function notifyRoomEnded(room, outcome = room.outcome) {
    // Deduplicate per live connection, including a resync after an expiry
    // already notified that connection. A new connection still gets its result.
    for (const id of room.socketIds ?? []) {
      const socket = io.sockets?.sockets?.get(id);
      if (socket) notifySocketEnded(socket, room.roomId, outcome);
    }
  }

  async function commit(room, state) {
    if (room.blocked) throw new DurableError();
    try {
      const row = await store.write('commit', room.durableRow, state);
      restore(row, room); // install only the acknowledged state
      return room;
    } catch (error) {
      room.blocked = true; storageHealthy = false;
      throw error;
    }
  }

  function update(room) {
    return { roomId: room.roomId, fen: room.game.fen(), history: room.game.history(),
      initialFen: room.initialFen, ...clocks(room, now()), turn: room.game.turn(),
      drawOfferBy: room.drawOfferBy, status: room.status, outcome: room.outcome,
      revision: Number(room.durableRow.revision), timeControl: room.timeControl };
  }

  function resultRecord(room) {
    const outcome = room.outcome;
    return { id: room.matchId, sourceRoomId: room.roomId,
      whiteId: room.userIds.w, blackId: room.userIds.b,
      winnerId: outcome.winnerColor ? room.userIds[outcome.winnerColor] : null,
      winnerColor: outcome.winnerColor, result: outcome.result,
      terminationReason: outcome.reason, timeControl: room.timeControl,
      initialTime: room.initialTime, increment: room.increment, initialFen: room.initialFen,
      finalFen: room.game.fen(), pgn: room.game.pgn(),
      createdAt: room.startedAt, completedAt: room.completedAt };
  }

  async function finishResult(room) {
    if (room.resultFlight || room.durableRow.result_saved || room.blocked
      || (room.resultRetryAfter ?? 0) > now()) return;
    room.resultFlight = true;
    try {
      // Reuse Milestone A's bounded retry/classification/confirmation contract.
      // Durable results use one RPC that inserts/verifies the immutable result
      // and compacts history in the SAME transaction. Volatile results keep the
      // existing adapter in index.js unchanged.
      const saved = await persistRoomCompletedMatch(room, resultRecord(room), {
        persistCompletedMatch: record => serial(room.roomId, async () => {
          const row = await store.write('complete', room.durableRow, {
            finalFen: record.finalFen, pgn: record.pgn,
          });
          room.durableRow = row;
          return { id: row.match_id };
        }),
      });
      if (!saved) { room.persistencePromise = null; room.resultRetryAfter = now() + 30000; return; }
    } catch (error) {
      room.blocked = true; storageHealthy = false; diagnostic(error);
    } finally { room.resultFlight = false; }
  }

  function terminal(state, payload) {
    const at = payload.effectiveAt ?? now();
    const game = new Chess(state.initialFen);
    for (const move of state.moves) game.move(move);
    const field = game.turn() === 'w' ? 'whiteTimeMs' : 'blackTimeMs';
    state[field] = Math.max(0, state[field] - Math.max(0, at - state.lastMoveTimestamp));
    state.lastMoveTimestamp = at;
    state.status = 'ended';
    state.outcome = { reason: payload.reason, result: payload.result,
      winnerColor: payload.winnerColor ?? null, endedBy: payload.endedBy ?? null };
    state.completedAt = new Date(at).toISOString();
  }

  function expiry(room) {
    if (room.status !== 'active') return null;
    const color = room.game.turn();
    const clockDeadline = room.lastMoveTimestamp + room[color === 'w' ? 'whiteTimeMs' : 'blackTimeMs'];
    const disconnected = ['w', 'b'].filter(c => room.disconnects[c].deadline !== null
      && room.disconnects[c].deadline <= now())
      .sort((a, b) => room.disconnects[a].deadline - room.disconnects[b].deadline)[0];
    // After downtime, resolve the first deadline that actually elapsed. A later
    // clock expiry must not reverse an earlier recorded disconnect outcome.
    if (clockDeadline <= now() && (!disconnected || clockDeadline <= room.disconnects[disconnected].deadline)) {
      const winnerColor = opposite(color);
      return { reason: 'timeout', result: winnerColor === 'w' ? '1-0' : '0-1', winnerColor, endedBy: color, effectiveAt: clockDeadline };
    }
    if (!disconnected) return null;
    const winnerColor = opposite(disconnected);
    return { reason: 'opponent_disconnected', result: winnerColor === 'w' ? '1-0' : '0-1', winnerColor,
      endedBy: disconnected, effectiveAt: room.disconnects[disconnected].deadline };
  }

  async function end(room, payload) {
    if (room.status !== 'active') return false;
    const state = snapshot(room);
    terminal(state, payload);
    if (payload.reason === 'timeout') state[payload.endedBy === 'w' ? 'whiteTimeMs' : 'blackTimeMs'] = 0;
    await commit(room, state);
    notifyRoomEnded(room);
    void finishResult(room);
    return true;
  }

  async function recover() {
    if (scanPromise) return scanPromise;
    if (!store) { storageHealthy = !enabled; return; }
    scanPromise = (async () => {
      try {
        const rows = await store.scan();
        schemaAbsent = false;
        const listed = new Set(rows.map(row => row.room_id));
        // A lost ACK can leave a blocked in-memory room whose durable copy has
        // already become a tombstone and therefore no longer appears in scan.
        for (const room of rooms.values()) if (room.durable && room.blocked && !listed.has(room.roomId)) {
          rows.push(await store.read(room.roomId));
        }
        for (const row of rows) {
          await serial(row.room_id, async () => {
            const previous = rooms.get(row.room_id);
            if (row.result_saved) {
              if (previous) notifyRoomEnded(previous, row.state.outcome);
              if (previous?.status === 'ended') {
                previous.durableRow = row; previous.persisted = true; previous.blocked = false;
              } else if (previous) {
                io.to(row.room_id).emit('game_action_rejected', { roomId: row.room_id, reason: 'recovery_pending' });
                for (const id of previous.socketIds ?? []) {
                  socketToRoom.delete(id); io.sockets.sockets.get(id)?.leave(row.room_id);
                }
                rooms.delete(row.room_id);
              }
              return;
            }
            let owned = row;
            let claimed = false;
            if (row.owner_id !== store.ownerId || Date.parse(row.lease_until) <= now()) {
              if (Date.parse(row.lease_until) > now()) return;
              try { owned = await store.claim(row); claimed = true; }
              catch (error) { if (error.code === 'owned_elsewhere') return; throw error; }
            }
            if (previous?.durable && !previous.blocked && !claimed) return;
            if (previous?.blocked && owned.owner_id === store.ownerId) {
              // The scan may predate a queued transition. Reconcile from a fresh
              // read while holding the in-process room queue.
              owned = await store.read(row.room_id);
              if (owned.owner_id !== store.ownerId || Date.parse(owned.lease_until) <= now()) return;
            }
            const room = restore(owned, previous);
            rooms.set(row.room_id, room);
            // No synthetic disconnects: absence of restored sockets is not a loss.
            const expired = expiry(room);
            if (expired) await end(room, expired);
            if (room.status === 'ended') { notifyRoomEnded(room); void finishResult(room); }
            if (previous) io.to(room.roomId).emit('update_board', update(room));
          });
        }
        storageHealthy = true;
        recoveryRequired = rows.some(row => !row.result_saved) || hasPendingRooms();
        retryDelay = 5000;
        // An installed but empty schema cannot prove there was no activation
        // (another process may still create games). Discover these at a bounded,
        // slower cadence; known games retain the five-second recovery interval.
        nextScanAt = now() + (enabled || recoveryRequired ? 5000 : 60000);
      } catch (error) {
        storageHealthy = false;
        schemaAbsent = false;
        let uninstalled = false;
        if (!enabled && ['PGRST202', '42P01', '42883'].includes(error.code)) {
          try { uninstalled = await store.isUninstalled(); }
          catch { /* Unknown is not proof that recovery can be abandoned. */ }
        }
        if (uninstalled && !recoveryRequired && !hasPendingRooms()) {
          schemaAbsent = true;
          // Confirmed missing schema: no periodic polling until restart or an
          // explicit recovery request. Rollout requires restart after migration.
          nextScanAt = Infinity;
        } else {
          nextScanAt = now() + (enabled || recoveryRequired || hasPendingRooms() ? 5000 : retryDelay);
          retryDelay = Math.min(retryDelay * 2, 60000);
          diagnostic(error);
        }
      }
    })().finally(() => { scanPromise = null; });
    return scanPromise;
  }

  async function runTick() {
    if (store && now() >= nextScanAt) void recover();
    await Promise.all([...rooms.values()].filter(room => room.durable).map(room =>
      serial(room.roomId, async () => {
        if (room.blocked || room.durableRow.result_saved) return;
        try {
          if (Date.parse(room.durableRow.lease_until) - now() < 10000) {
            room.durableRow = await store.renew(room.durableRow);
          }
          const expired = expiry(room);
          if (expired) await end(room, expired);
          else if (room.status === 'ended') void finishResult(room);
        } catch (error) { room.blocked = true; storageHealthy = false; diagnostic(error); }
      })));
  }

  function tick() {
    if (!tickPromise) tickPromise = runTick().finally(() => { tickPromise = null; });
    return tickPromise;
  }

  async function start(room) {
    if (!enabled) return;
    if (!store || !ready() || !getMatchPersistence()) throw new DurableError();
    const row = { room_id: room.roomId, match_id: randomUUID(), revision: 0, fence: 1 };
    try { restore(await store.write('start', row, snapshot(room)), room); }
    catch (error) { storageHealthy = false; throw error; }
  }

  async function action(socket, name, payload) {
    const roomId = payload?.roomId;
    const reject = reason => socket.emit(name === 'make_move' ? 'move_rejected' : 'game_action_rejected', { roomId, action: name, reason });
    // Preserve the existing arrival-time limit. Database queue latency must not
    // refill a bucket before requests from an already received burst are checked.
    if (!socket.data?.limiter?.allow(name === 'make_move' ? 'move' : 'game_action')) return reject('rate_limit_exceeded');
    return serial(roomId, async () => {
      const room = rooms.get(roomId);
      if (!room?.durable) return reject('room_not_found');
      if (room.blocked) return reject('storage_unavailable');
      if (room.status !== 'active') return reject('already_ended');
      const color = ['w', 'b'].find(c => room.userIds[c] === socket.data.userId && room.players[c] === socket.id);
      if (!color || socketToRoom.get(socket.id) !== roomId) return reject('not_in_room');
      try {
        const expired = expiry(room);
        if (expired) return await end(room, expired);
        const state = snapshot(room);
        let declined = false;
        if (name === 'make_move') {
          if (room.game.turn() !== color) return reject('not_your_turn');
          const candidate = restore({ ...room.durableRow, state });
          try { if (!candidate.game.move(payload.move)) return reject('illegal_move'); }
          catch { return reject('illegal_move'); }
          const at = now();
          const field = color === 'w' ? 'whiteTimeMs' : 'blackTimeMs';
          state[field] = Math.max(0, state[field] - Math.max(0, at - state.lastMoveTimestamp) + state.increment * 1000);
          state.lastMoveTimestamp = at;
          state.moves = candidate.game.history();
          if (state.drawOfferBy && state.drawOfferBy !== color) { state.drawOfferBy = null; declined = true; }
          const outcome = naturalGameOver(candidate.game);
          if (outcome) terminal(state, outcome);
        } else if (name === 'resign_game') {
          const winnerColor = opposite(color);
          terminal(state, { reason: 'resignation', result: winnerColor === 'w' ? '1-0' : '0-1', winnerColor, endedBy: color });
        } else if (name === 'draw_offer') {
          if (state.drawOfferBy) return reject(state.drawOfferBy === color ? 'duplicate_draw_offer' : 'existing_draw_offer');
          state.drawOfferBy = color;
        } else {
          if (!state.drawOfferBy) return reject('no_draw_offer');
          if (state.drawOfferBy === color) return reject('own_draw_offer');
          if (name === 'draw_accept') terminal(state, { reason: 'draw_agreement', result: '1/2-1/2', winnerColor: null, endedBy: color });
          else state.drawOfferBy = null;
        }
        await commit(room, state);
        if (name === 'make_move') io.to(roomId).emit('update_board', update(room));
        if (declined || name === 'draw_decline') io.to(roomId).emit('draw_offer_declined', { roomId, declinedBy: color });
        if (name === 'draw_offer') io.to(roomId).emit('draw_offer_received', { roomId, offeredBy: color });
        if (room.status === 'ended') {
          notifyRoomEnded(room);
          void finishResult(room);
        }
      } catch (error) { diagnostic(error); reject('storage_unavailable'); }
    });
  }

  async function disconnect(roomId, color, socketId) {
    return serial(roomId, async () => {
      const room = rooms.get(roomId);
      if (!room?.durable || room.status !== 'active' || room.players[color] !== socketId) return;
      try {
        const state = snapshot(room);
        state.disconnects[color] = { disconnectedAt: now(), deadline: now() + 30000 };
        await commit(room, state);
        io.to(roomId).emit('player_disconnected', { roomId, color, graceSeconds: 30 });
      } catch (error) { diagnostic(error); }
    });
  }

  async function reconnect(socket, roomId) {
    if (typeof roomId !== 'string' || !/^[0-9a-f-]{36}$/i.test(roomId)) {
      socket.emit('reconnect_failed', { reason: 'invalid_payload' }); return;
    }
    const cached = rooms.get(roomId);
    if ((!cached || cached.blocked) && !socket.data?.limiter?.allow('lobby')) {
      socket.emit('reconnect_failed', { roomId, reason: 'rate_limit_exceeded' }); return;
    }
    return serial(roomId, async () => {
      let knownDurable = Boolean(rooms.get(roomId)?.durable);
      try {
        let room = rooms.get(roomId);
        if (!room && !enabled && schemaAbsent) {
          socket.emit('reconnect_failed', { roomId, reason: 'game_not_active' }); return;
        }
        if (!room || room.blocked) {
          const row = await store.read(roomId);
          const color = ['w', 'b'].find(c => row.state.userIds[c] === socket.data.userId);
          if (!color) { socket.emit('reconnect_failed', { roomId, reason: 'not_a_player' }); return; }
          knownDurable = true;
          if (row.result_saved) {
            const match = await store.completedMatch(row.match_id);
            if (match.source_room_id !== roomId || match.white_id !== row.state.userIds.w
              || match.black_id !== row.state.userIds.b || match.status !== 'completed') throw new DurableError();
            const game = new Chess(match.initial_fen);
            if (match.pgn) game.loadPgn(match.pgn);
            socket.emit('reconnect_success', { roomId, color, fen: game.fen(), history: game.history(),
              initialFen: match.initial_fen, status: 'ended', outcome: row.state.outcome, whiteTime: 0, blackTime: 0 });
            notifySocketEnded(socket, roomId, row.state.outcome); return;
          }
          // A reconnect can discover a game created by a different process
          // since our last idle scan. Resume prompt recovery without trusting
          // the client or executing the durable room as a volatile one.
          recoveryRequired = true;
          nextScanAt = 0;
          void recover();
          // Only startup/recovery claims expired leases, never a socket request.
          throw new DurableError('recovery_pending');
        }
        const color = ['w', 'b'].find(c => room.userIds[c] === socket.data.userId);
        if (!color) { socket.emit('reconnect_failed', { roomId, reason: 'not_a_player' }); return; }
        if (room.status === 'active') {
          if (Date.parse(room.durableRow.lease_until) <= now()) throw new DurableError('recovery_pending');
          const expired = expiry(room);
          if (expired) await end(room, expired);
          else if (room.disconnects[color].deadline !== null) {
            const state = snapshot(room);
            state.disconnects[color] = { disconnectedAt: null, deadline: null };
            await commit(room, state);
          }
        }
        const oldId = room.players[color];
        if (oldId && oldId !== socket.id) {
          socketToRoom.delete(oldId); room.socketIds.delete(oldId);
          io.sockets.sockets.get(oldId)?.leave(roomId);
        }
        room.players[color] = socket.id; room.socketIds.add(socket.id);
        socketToRoom.set(socket.id, roomId); socket.join(roomId);
        socket.emit('reconnect_success', { ...update(room), color });
        if (room.status === 'ended') notifySocketEnded(socket, roomId, room.outcome);
        else {
          io.to(roomId).emit('player_reconnected', { roomId, color });
          const opponent = opposite(color);
          if (room.disconnects[opponent].deadline !== null) socket.emit('player_disconnected', {
            roomId, color: opponent, graceSeconds: Math.max(0, Math.ceil((room.disconnects[opponent].deadline - now()) / 1000)),
          });
        }
      } catch (error) {
        diagnostic(error);
        const reason = error.code === 'not_found' ? 'game_not_active'
          : enabled || knownDurable ? 'recovery_pending' : 'storage_unavailable';
        socket.emit('reconnect_failed', { roomId, reason,
          ...(reason === 'storage_unavailable' ? { retryLimitMs: 30000 } : {}) });
      }
    });
  }

  return { ready, recover, tick, start, action, disconnect, reconnect,
    finalize: (roomId, payload) => serial(roomId, async () => {
      const room = rooms.get(roomId);
      if (room?.durable) return end(room, payload);
      return false;
    }) };
}

module.exports = { createDurableGames, snapshot, restore, clocks };
