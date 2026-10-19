import { Chess, DEFAULT_POSITION } from 'chess.js';
import type { Socket } from 'socket.io-client';

// A room URL is only a hint. The server authenticates membership and supplies
// every position/history/colour; the client never uploads a saved game.
export function decodeLiveSnapshot(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.fen !== 'string' || !Array.isArray(data.history)
    || !data.history.every(move => typeof move === 'string')) return null;
  try {
    const game = new Chess(typeof data.initialFen === 'string' ? data.initialFen : DEFAULT_POSITION);
    const positions = [game.fen()];
    for (const move of data.history) { game.move(move); positions.push(game.fen()); }
    if (game.fen() !== data.fen) return null;
    const color: 'w' | 'b' | undefined = data.color === 'w' || data.color === 'b' ? data.color : undefined;
    const drawOfferBy: 'w' | 'b' | null = data.drawOfferBy === 'w' || data.drawOfferBy === 'b' ? data.drawOfferBy : null;
    return { game, positions, history: game.history(),
      color, drawOfferBy,
      ended: data.status === 'ended' };
  } catch { return null; }
}

export function attachLiveRecovery(socket: Socket, roomId: string, onWaiting: () => void, onExpired: () => void = () => {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let startedAt: number | undefined;
  let expired = false;
  let finished = false;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const clearDeadline = () => { clearTimeout(deadlineTimer); deadlineTimer = undefined; };
  const expire = () => { if (expired) return; expired = true; clear(); clearDeadline(); onExpired(); };
  const request = () => {
    clear();
    if (!expired && !finished && socket.connected) {
      startedAt ??= Date.now(); socket.emit('reconnect_game', { roomId });
    }
  };
  const connect = () => { if (!expired && !finished) { onWaiting(); request(); } };
  const disconnect = () => { clear(); onWaiting(); };
  const retry = (data: { roomId?: string; reason?: string; retryLimitMs?: number }) => {
    if (data.roomId && data.roomId !== roomId) return;
    if (expired || finished) return;
    if (!['recovery_pending', 'storage_unavailable'].includes(data.reason ?? '')) { clear(); clearDeadline(); return; }
    if (data.retryLimitMs === 30000) {
      const remaining = (startedAt ?? Date.now()) + 30000 - Date.now();
      if (remaining <= 0) { expire(); return; }
      if (!deadlineTimer) deadlineTimer = setTimeout(expire, remaining);
    } else {
      // A known durable row or enabled mode must not be abandoned on this UI
      // deadline. Server-side recovery is independent of the client's wait.
      clearDeadline();
    }
    onWaiting(); clear();
    timer = setTimeout(request, 2000);
  };
  const success = (data: { roomId?: string; status?: string }) => {
    if (data.roomId && data.roomId !== roomId) return;
    clear(); clearDeadline(); startedAt = undefined; expired = false; finished = data.status === 'ended';
  };
  const ended = (data: { roomId?: string }) => {
    if (data.roomId && data.roomId !== roomId) return;
    clear(); clearDeadline(); finished = true;
  };
  const board = (data: { roomId?: string; status?: string }) => { if (data.status === 'ended') ended(data); };
  socket.on('connect', connect);
  socket.on('disconnect', disconnect);
  socket.on('reconnect_failed', retry);
  socket.on('move_rejected', retry);
  socket.on('game_action_rejected', retry);
  socket.on('reconnect_success', success);
  socket.on('game_over', ended);
  socket.on('update_board', board);
  request();
  return () => {
    clear(); clearDeadline();
    socket.off('connect', connect); socket.off('disconnect', disconnect);
    socket.off('reconnect_failed', retry); socket.off('move_rejected', retry);
    socket.off('game_action_rejected', retry); socket.off('reconnect_success', success);
    socket.off('game_over', ended); socket.off('update_board', board);
  };
}
