import type { OnlineBoard, StaffOnlineBoard } from '../../services/teamTournaments';

export const stateLabels = {
  scheduled: 'onlineScheduled', waiting: 'onlineWaiting', starting: 'onlineStarting',
  live: 'onlineLive', finished: 'onlineFinished', forfeit: 'onlineForfeit',
  previous: 'onlinePrevious', closed: 'onlineClosed', play: 'onlineReady',
} as const;

export function onlineBoardState(board: OnlineBoard, now: number) {
  if (board.status !== 'scheduled') return board.status;
  if (now < Date.parse(board.starts_at)) return 'scheduled';
  if (board.deadline === null) return 'previous';
  if (board.ready) return 'waiting';
  if (now >= Date.parse(board.deadline)) return 'closed';
  return 'play';
}

export function onlineCountdown(target: string | null, now: number): string | null {
  if (!target) return null;
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export function staffOnlineBoardState(board: StaffOnlineBoard) {
  if (board.status === 'starting' || (board.status === 'scheduled' && (board.white_ready_at || board.black_ready_at))) {
    return 'waiting';
  }
  return board.status;
}
