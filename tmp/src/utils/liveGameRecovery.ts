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

export function attachLiveRecovery(socket: Socket, roomId: string, onWaiting: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const request = () => { clear(); if (socket.connected) socket.emit('reconnect_game', { roomId }); };
  const connect = () => { onWaiting(); request(); };
  const disconnect = () => { clear(); onWaiting(); };
  const retry = (data: { roomId?: string; reason?: string }) => {
    if (data.roomId && data.roomId !== roomId) return;
    if (!['recovery_pending', 'storage_unavailable'].includes(data.reason ?? '')) return;
    onWaiting(); clear();
    timer = setTimeout(request, 2000);
  };
  socket.on('connect', connect);
  socket.on('disconnect', disconnect);
  socket.on('reconnect_failed', retry);
  socket.on('move_rejected', retry);
  socket.on('game_action_rejected', retry);
  socket.on('reconnect_success', clear);
  request();
  return () => {
    clear();
    socket.off('connect', connect); socket.off('disconnect', disconnect);
    socket.off('reconnect_failed', retry); socket.off('move_rejected', retry);
    socket.off('game_action_rejected', retry); socket.off('reconnect_success', clear);
  };
}
