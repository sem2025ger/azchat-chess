import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { createTournamentM3Api, type OnlineBoard } from '../../services/teamTournaments';
import { gamePath, ROOM_ID } from '../schachTreff/challengeRouting';
import { tournamentCopy, type TournamentCopy } from './copy';
import { RoundStartTime } from './TeamTournamentViews';
import { onlineBoardState, onlineCountdown, stateLabels } from './onlineBoardState';

function useOnlineBoards(token: string | undefined, connected: boolean, event?: string) {
  const { socket } = useSocket();
  const [data, setData] = useState<{ token: string; event?: string; boards: OnlineBoard[]; durable: boolean } | null>(null);
  useEffect(() => {
    if (!token || !connected) return;
    const api = createTournamentM3Api(import.meta.env.VITE_SERVER_URL, token);
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const value = await api.onlineBoards(controller.signal, event);
        if (!controller.signal.aborted) setData({ token, event, ...value });
      } catch {
        // Hide actions while storage cannot confirm the board state.
        if (!controller.signal.aborted) setData(previous => previous && { ...previous, durable: false });
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    socket?.on('tournament_board_status', refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      socket?.off('tournament_board_status', refresh);
    };
  }, [token, connected, event, socket]);
  return data?.token === token && data?.event === event ? data : null;
}

function useRoundClock(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function PlayButton({ board, tr, onReady }: { board: OnlineBoard; tr: TournamentCopy; onReady?: () => void }) {
  const { socket, isConnected } = useSocket();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" className="min-h-11 rounded-lg bg-[#e5c89a] px-4 font-semibold text-[#252017]"
      disabled={!isConnected || busy}
      onClick={() => {
        if (!socket?.connected || busy) return;
        setBusy(true);
        setError(false);
        socket.timeout(9000).emit('tournament_board_ready', { matchId: board.match_id, boardNo: board.board_no },
          (failure: Error | null, response?: { ok?: boolean }) => {
            setBusy(false);
            if (failure || !response?.ok) setError(true);
            else onReady?.();
          });
      }}>{tr('onlinePlay')}</button>
    {error && <span role="alert">{tr('onlineReadyError')}</span>}
  </span>;
}

function OnlineBoardCard({ board, tr, durable }: { board: OnlineBoard; tr: TournamentCopy; durable: boolean }) {
  const { isConnected } = useSocket();
  const now = useRoundClock(board.status === 'scheduled');
  const [pressed, setPressed] = useState(false);
  const view = onlineBoardState({ ...board, ready: board.ready || pressed }, now);
  const countdown = onlineCountdown(view === 'scheduled' ? board.starts_at
    : view === 'play' || view === 'waiting' ? board.deadline : null, now);
  const result = board.result;
  return <section className="section-card mb-3 min-w-0 break-words" aria-label={tr('myTournament')} data-online-board={view}>
    <h3 className="font-semibold">{board.tournament_name} · {tr('round')} {board.round_no} · {tr('board')} {board.board_no}</h3>
    <RoundStartTime startsAt={board.starts_at} tr={tr} />
    <p>{tr('opponent')} {board.opponent} · {tr('myColor')}: {tr(board.side)} · {board.time_control}</p>
    <p role="status">{tr(stateLabels[view])}</p>
    {countdown && <p>{tr(view === 'scheduled' ? 'onlineStartsIn' : 'onlineReadyBy')} <span className="tabular-nums">{countdown}</span></p>}
    {(view === 'play' || (view === 'previous' && !pressed && !board.ready)) && (durable && isConnected
      ? <PlayButton board={board} tr={tr} onReady={() => setPressed(true)} />
      : <p>{tr('onlineUnavailable')}</p>)}
    {view === 'live' && board.room_id && ROOM_ID.test(board.room_id) &&
      <Link className="inline-flex items-center min-h-11 underline" to={gamePath(board.room_id)}>{tr('onlineOpen')}</Link>}
    {result !== 'pending' && <p>{tr('result')} · {result}</p>}
    <p>{tr('onlineScore')} · {board.score.home} : {board.score.away}</p>
  </section>;
}

export function TournamentOnlineCards({ event }: { event?: string }) {
  const { session } = useAuth();
  const { language } = useLanguage();
  const { isConnected } = useSocket();
  const data = useOnlineBoards(session?.access_token, Boolean(session?.access_token), event);
  const tr = tournamentCopy(language);
  return data?.boards.map(board => <OnlineBoardCard key={board.match_id + ':' + board.board_no}
    board={board} tr={tr} durable={data.durable && isConnected} />) ?? null;
}

export function TournamentOnlineBanner() {
  const { session } = useAuth();
  const { socket, isConnected } = useSocket();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const data = useOnlineBoards(session?.access_token, isConnected);
  const board = data?.boards[0];
  const now = useRoundClock(isConnected && board?.status === 'scheduled');
  const [pressed, setPressed] = useState<string | null>(null);
  const tr = tournamentCopy(language);
  useEffect(() => {
    const open = (message: { roomId?: string; tournament?: boolean }) => {
      if (message?.tournament && typeof message.roomId === 'string' && ROOM_ID.test(message.roomId)) {
        navigate(gamePath(message.roomId));
      }
    };
    socket?.on('match_found', open);
    return () => { socket?.off('match_found', open); };
  }, [socket, navigate]);
  const boardKey = board && session?.user.id + ':' + board.match_id + ':' + board.board_no;
  if (!isConnected || !data?.durable || !board || pressed === boardKey ||
      onlineBoardState(board, now) !== 'play' || (location.pathname === '/play' && location.search.includes('roomId='))) return null;
  return <aside data-online-round-banner
    className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg rounded-xl border border-[#a48961] bg-[#23201c] text-[#f3e8d3] shadow-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
    <p role="status" className="text-sm">{tr('onlineBanner')}</p>
    <PlayButton key={boardKey} board={board} tr={tr} onReady={() => setPressed(boardKey ?? null)} />
  </aside>;
}
