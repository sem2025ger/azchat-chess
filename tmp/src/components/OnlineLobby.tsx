import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useLanguage } from '../context/LanguageContext';
import { ChevronDown, Swords, CircleCheck } from 'lucide-react';

type Invite = { roomId: string; fromUserId: string; timeControl: string };
type Profile = { id: string; username: string };
const TIME_CONTROLS: Record<string, string> = {
  '1 min.': '1+0', '1 | 1': '1+1', '2 | 1': '2+1',
  '3 min.': '3+0', '3 | 2': '3+2', '5 min.': '5+0',
  '10 min.': '10+0', '15 | 10': '15+10', '30 min.': '30+0'
};

export function toServerTimeControl(value: string): string {
  return TIME_CONTROLS[value] ?? '3+0';
}

/** Show only ready-to-play challengers in a compact, expandable Play lobby. */
export default function OnlineLobby({ timeControl }: { timeControl: string }) {
  const { socket, isConnected } = useSocket();
  const { session, user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isGerman = language === 'de';
  const isRussian = language === 'ru';
  const tr = (de: string, ru: string, en: string) => isGerman ? de : isRussian ? ru : en;
  const [userIds, setUserIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [inbound, setInbound] = useState<Invite | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [readyToPlay, setReadyToPlay] = useState(() => sessionStorage.getItem('chessaz_lobby_ready') !== 'false');
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const [showPlayers, setShowPlayers] = useState(false);
  const targetRef = useRef<string | null>(null);
  const roomRef = useRef<string | null>(null);
  const timeRef = useRef(timeControl);
  useEffect(() => { timeRef.current = timeControl; }, [timeControl]);
  const expiresRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readySet = useMemo(() => new Set(readyIds), [readyIds]);
  const available = useMemo(() => userIds.filter(id => id !== user?.id && readySet.has(id)), [userIds, user?.id, readySet]);

  useEffect(() => {
    if (!socket || !isConnected || !session) {
      setUserIds([]); setReadyIds([]);
      return;
    }
    const onPresence = (data: { userIds?: string[]; readyUserIds?: string[] }) => {
      setUserIds(Array.isArray(data?.userIds) ? data.userIds.filter(id => typeof id === 'string').slice(0, 100) : []);
      setReadyIds(Array.isArray(data?.readyUserIds) ? data.readyUserIds.filter(id => typeof id === 'string').slice(0, 100) : []);
    };
    const onReady = (data: { ready?: boolean }) => {
      if (typeof data?.ready === 'boolean') setReadyToPlay(data.ready);
    };
    const onInvitation = (data: Invite) => {
      if (typeof data?.roomId !== 'string' || typeof data?.fromUserId !== 'string') return;
      setInbound(current => current ?? data);
    };
    const onCreated = (data: { roomId: string; timeControl: string }) => {
      if (!targetRef.current) return;
      if (data.timeControl !== toServerTimeControl(timeRef.current)) {
        socket.emit('cancel_matchmaking');
        setMessage(tr('Zeitkontrolle nicht bestätigt.', 'Контроль времени не подтверждён.', 'Time control not confirmed.'));
        targetRef.current = null;
        setPendingTarget(null);
        return;
      }
      roomRef.current = data.roomId;
      socket.emit('invite_lobby_player', { roomId: data.roomId, targetUserId: targetRef.current });
    };
    const onFail = () => {
      if (!targetRef.current) return;
      targetRef.current = null; roomRef.current = null;
      if (expiresRef.current) clearTimeout(expiresRef.current);
      setPendingTarget(null);
      setMessage(tr('Einladung fehlgeschlagen.', 'Приглашение не удалось.', 'Invitation failed.'));
      socket.emit('cancel_matchmaking');
    };
    const onDeclined = () => {
      if (!targetRef.current) return;
      targetRef.current = null; roomRef.current = null;
      if (expiresRef.current) clearTimeout(expiresRef.current);
      setPendingTarget(null);
      setMessage(tr('Einladung abgelehnt.', 'Приглашение отклонено.', 'Invitation declined.'));
      socket.emit('cancel_matchmaking');
    };
    socket.on('lobby_presence', onPresence);
    socket.on('lobby_ready_state', onReady);
    socket.on('lobby_game_invitation', onInvitation);
    socket.on('private_room_created', onCreated);
    socket.on('invitation_failed', onFail);
    socket.on('invitation_declined', onDeclined);
    const onMatch = () => {
      targetRef.current = null; roomRef.current = null;
      if (expiresRef.current) clearTimeout(expiresRef.current);
      setPendingTarget(null); setInbound(null);
      sessionStorage.setItem('chessaz_lobby_ready', 'false');
      setReadyToPlay(false);
    };
    socket.on('match_found', onMatch);
    socket.emit('lobby_presence_enter', { ready: sessionStorage.getItem('chessaz_lobby_ready') !== 'false' });
    return () => {
      socket.emit('lobby_presence_leave');
      socket.off('lobby_presence', onPresence);
      socket.off('lobby_ready_state', onReady);
      socket.off('lobby_game_invitation', onInvitation);
      socket.off('private_room_created', onCreated);
      socket.off('invitation_failed', onFail);
      socket.off('invitation_declined', onDeclined);
      socket.off('match_found', onMatch);
      if (roomRef.current) socket.emit('cancel_matchmaking');
      if (expiresRef.current) clearTimeout(expiresRef.current);
    };
  }, [socket, isConnected, session?.user?.id]);

  useEffect(() => {
    if (!available.length && !inbound) return;
    const ids = [...new Set([...available, ...(inbound ? [inbound.fromUserId] : [])])].slice(0, 101);
    let cancelled = false;
    void supabase.from('profiles').select('id,username').in('id', ids).then(({ data, error }) => {
      if (!cancelled && !error) {
        setProfiles(Object.fromEntries(((data ?? []) as Profile[]).map(p => [p.id, p.username])));
      }
    });
    return () => { cancelled = true; };
  }, [available.join(','), inbound?.fromUserId]);

  const challenge = (targetId: string) => {
    if (!socket || !isConnected || pendingTarget || !session) return;
    setMessage('');
    targetRef.current = targetId;
    setPendingTarget(targetId);
    socket.emit('create_private_room', { timeControl: toServerTimeControl(timeControl) });
    if (expiresRef.current) clearTimeout(expiresRef.current);
    expiresRef.current = setTimeout(() => {
      if (!targetRef.current) return;
      if (roomRef.current) socket.emit('cancel_matchmaking');
      targetRef.current = null; roomRef.current = null;
      setPendingTarget(null);
      setMessage(tr('Einladung abgelaufen.', 'Время приглашения истекло.', 'Invitation expired.'));
    }, 60000);
  };

  const respond = (accept: boolean) => {
    if (!inbound || !socket) return;
    if (accept) {
      navigate(`/play?room=${encodeURIComponent(inbound.roomId)}`);
    } else {
      socket.emit('decline_lobby_invitation', { roomId: inbound.roomId });
    }
    setInbound(null);
  };

  const signInForPlay = () => navigate('/profile?returnTo=%2Fplay');
  const setReady = () => {
    if (!session) { signInForPlay(); return; }
    if (!isConnected || !socket) return;
    const nextReady = !readyToPlay;
    socket.emit('lobby_ready_set', { ready: nextReady });
    if (!nextReady && roomRef.current) socket.emit('cancel_matchmaking');
    if (!nextReady && inbound) socket.emit('decline_lobby_invitation', { roomId: inbound.roomId });
    if (!nextReady) {
      targetRef.current = null;
      roomRef.current = null;
      if (expiresRef.current) clearTimeout(expiresRef.current);
      setPendingTarget(null);
      setInbound(null);
    }
    sessionStorage.setItem('chessaz_lobby_ready', String(nextReady));
    setReadyToPlay(nextReady);
  };
  const togglePlayers = () => {
    if (!session) { signInForPlay(); return; }
    setShowPlayers(v => !v);
  };

  return (
    <section aria-label={tr('Spielbereitschaft und Gegner', 'Готовность и соперники', 'Readiness and opponents')} className="w-full">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#5c4a33]/70 bg-[#161718] p-2">
        <button
          type="button"
          role="switch"
          aria-checked={!!session && isConnected && readyToPlay}
          onClick={setReady}
          className={`flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 sm:text-xs ${session && isConnected && readyToPlay ? 'border-emerald-600/60 bg-emerald-950/60 text-emerald-200' : 'border-white/15 bg-white/[0.04] text-neutral-300'}`}
        >
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${session && isConnected && readyToPlay ? 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.55)]' : 'bg-neutral-500'}`} />
          <span className="min-w-0">{readyToPlay ? tr('Spielbereit', 'Готов играть', 'Ready to play') : tr('Nicht bereit', 'Не готов', 'Not ready')}</span>
        </button>
        <button
          type="button"
          aria-expanded={showPlayers}
          aria-controls="chessaz-ready-opponents"
          onClick={togglePlayers}
          className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#78603d]/80 bg-[#27231c] px-2 py-2 text-[11px] font-bold text-[#f1d5a5] transition-colors hover:bg-[#342b1e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 sm:text-xs"
        >
          <Swords size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0">{tr('Gegner wählen', 'Выбрать соперника', 'Choose opponent')}</span>
          <ChevronDown size={13} aria-hidden="true" className={`shrink-0 transition-transform ${showPlayers ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {showPlayers && (
        <div id="chessaz-ready-opponents" className="mt-2 rounded-xl border border-[#635037]/70 bg-[#111416] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#edce98]">
            <CircleCheck size={14} aria-hidden="true" />
            {tr('Spielbereite Gegner', 'Готовы к игре', 'Ready opponents')}
          </div>
          {!isConnected && <p role="status" className="text-xs text-neutral-400">{tr('Keine Serververbindung', 'Нет соединения с сервером', 'Server unavailable')}</p>}
          {isConnected && available.length === 0 && <p className="text-xs text-neutral-400">{tr('Noch keine spielbereiten Gegner.', 'Пока нет готовых соперников.', 'No ready opponents right now.')}</p>}
          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {isConnected && available.map(id => (
              <div key={id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-100">
                  <span aria-hidden="true" className="mr-1.5 text-emerald-400">●</span>
                  {profiles[id] || tr('Spieler', 'Игрок', 'Player')}
                </span>
                <button type="button" disabled={!readyToPlay || !!pendingTarget} className="shrink-0 rounded-lg border border-[#b58e50]/80 bg-[#382a17] px-2.5 py-2 text-[11px] font-bold text-[#f5d8a5] disabled:cursor-not-allowed disabled:opacity-45" onClick={() => challenge(id)}>
                  {pendingTarget === id ? tr('Warten…', 'Ожидание…', 'Waiting…') : tr('Einladen', 'Пригласить', 'Invite')}
                </button>
              </div>
            ))}
          </div>
          {pendingTarget && <button type="button" className="mt-2 text-xs text-[#f0d4a2] underline underline-offset-4" onClick={() => {
            socket?.emit('cancel_matchmaking');
            targetRef.current = null;
            roomRef.current = null;
            if (expiresRef.current) clearTimeout(expiresRef.current);
            setPendingTarget(null);
          }}>{tr('Einladung abbrechen', 'Отменить приглашение', 'Cancel invitation')}</button>}
        </div>
      )}
      {session && !isConnected && <p role="status" className="mt-1 px-1 text-[11px] text-amber-200">{tr('Verbindung zum Spielserver fehlt.', 'Нет подключения к игровому серверу.', 'Game server connection unavailable.')}</p>}
      {message && <p role="status" className="mt-2 px-1 text-xs text-amber-200">{message}</p>}
      {inbound && <div role="dialog" aria-label="Game invitation" className="mt-2 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3">
        <p className="text-xs font-semibold text-neutral-100">{tr('Spieleinladung von', 'Вызов от', 'Invitation from')} {profiles[inbound.fromUserId] || tr('Spieler', 'игрока', 'player')} · {inbound.timeControl}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-neutral-950" onClick={() => respond(true)}>{tr('Annehmen', 'Принять', 'Accept')}</button>
          <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-xs" onClick={() => respond(false)}>{tr('Ablehnen', 'Отклонить', 'Decline')}</button>
        </div>
      </div>}
    </section>
  );
}
