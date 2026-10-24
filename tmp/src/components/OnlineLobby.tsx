import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useLanguage } from '../context/LanguageContext';

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

/** Game invitations are opt-in on the Play screen, independently of being online. */
export default function OnlineLobby({ timeControl, compact = false }: { timeControl: string; compact?: boolean }) {
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
  const targetRef = useRef<string | null>(null);
  const roomRef = useRef<string | null>(null);
  const timeRef = useRef(timeControl);
  useEffect(() => { timeRef.current = timeControl; }, [timeControl]);
  const expiresRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readySet = useMemo(() => new Set(readyIds), [readyIds]);
  const available = useMemo(() => userIds.filter(id => id !== user?.id), [userIds, user?.id]);

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

  return (
    <section id="chessaz-online-lobby" className="rounded-2xl border border-amber-300/25 bg-[#131817] p-3 text-neutral-100 shadow-[0_12px_32px_-20px_rgba(218,171,98,0.35)]" aria-label="Online players lobby">
      {!session && <p className="mb-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">
        {tr('Zum Spielen bitte anmelden. Der Bereitschaftsschalter wird nach der Anmeldung aktiv.', 'Войдите в профиль, чтобы управлять готовностью и приглашениями.', 'Sign in to enable readiness and invitations.')}
      </p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{tr('Spielbereite Spieler', 'Игроки, готовые играть', 'Players ready to play')}</h2>
          <span className="text-xs text-neutral-400" aria-live="polite">
            {isConnected ? tr('● Online', '● В сети', '● Online') : tr('○ Offline', '○ Не в сети', '○ Offline')}
          </span>
        </div>
        <button type="button" role="switch" aria-checked={readyToPlay}
          disabled={!isConnected || !session}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${readyToPlay ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-white/20 hover:bg-white/10'}`}
          onClick={() => {
            const nextReady = !readyToPlay;
            socket?.emit('lobby_ready_set', { ready: nextReady });
            if (!nextReady && roomRef.current) socket?.emit('cancel_matchmaking');
            if (!nextReady && inbound) socket?.emit('decline_lobby_invitation', { roomId: inbound.roomId });
            if (!nextReady) {
              targetRef.current = null; roomRef.current = null;
              if (expiresRef.current) clearTimeout(expiresRef.current);
              setPendingTarget(null); setInbound(null);
            }
            sessionStorage.setItem('chessaz_lobby_ready', String(nextReady));
            setReadyToPlay(nextReady);
          }}>
          {readyToPlay ? tr('Spielbereit', 'Готов играть', 'Ready to play') : tr('Nicht spielbereit', 'Не готов играть', 'Not ready to play')}
        </button>
      </div>
      {!compact && <p className="mt-2 text-xs text-neutral-400" role="status">
        {readyToPlay
          ? tr('Du kannst Einladungen zum Spielen erhalten.', 'Ты доступен для приглашений на партию.', 'You can receive game invitations.')
          : tr('Du bleibst online sichtbar, erhältst aber keine neuen Spieleinladungen.', 'Ты виден в списке онлайн, но новые приглашения не приходят.', 'You remain visible online but cannot receive new game invitations.')}
      </p>}
      <div className={`mt-3 space-y-2 ${compact ? 'max-h-40 overflow-y-auto' : ''}`}>
          {!compact && <p className="text-xs text-neutral-400">{tr('Spieler sind online sichtbar, auch wenn sie nicht bereit sind. Herausfordern nur, wenn bereit.', 'Игроки видны в сети даже когда не готовы; вызвать можно только готовых.', 'Players remain visible online even if not ready; only ready players can be challenged.')}</p>}
          {available.length === 0 && <p className="text-xs text-neutral-400">{tr('Noch keine anderen Spieler verfügbar.', 'Других доступных игроков пока нет.', 'No other players available yet.')}</p>}
          {available.map(id => (
            <div key={id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{profiles[id] || tr('Spieler', 'Игрок', 'Player')}</span>
              <span className={`shrink-0 text-[11px] ${readySet.has(id) ? 'text-emerald-300' : 'text-neutral-400'}`}>
                {readySet.has(id) ? tr('Bereit', 'Готов', 'Ready') : tr('Nicht bereit', 'Не готов', 'Not ready')}
              </span>
              {readySet.has(id) && readyToPlay && <button type="button" disabled={!!pendingTarget} className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-neutral-950 disabled:opacity-50"
                onClick={() => challenge(id)}>{pendingTarget === id ? tr('Warten…', 'Ожидание…', 'Waiting…') : tr('Herausfordern', 'Вызвать', 'Challenge')}</button>}
            </div>
          ))}
          {!!pendingTarget && <button type="button" className="text-xs underline underline-offset-4" onClick={() => {
            socket?.emit('cancel_matchmaking'); targetRef.current = null; roomRef.current = null; if (expiresRef.current) clearTimeout(expiresRef.current); setPendingTarget(null);
          }}>{tr('Einladung abbrechen', 'Отменить приглашение', 'Cancel invitation')}</button>}
      </div>
      {message && <p role="status" className="mt-2 text-xs text-amber-200">{message}</p>}
      {inbound && <div role="dialog" aria-label="Game invitation" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3">
        <p className="text-sm font-semibold">{tr('Spieleinladung von', 'Приглашение от', 'Invitation from')} {profiles[inbound.fromUserId] || tr('Spieler', 'игрока', 'player')} · {inbound.timeControl}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-neutral-950" onClick={() => respond(true)}>{tr('Annehmen', 'Принять', 'Accept')}</button>
          <button type="button" className="rounded-lg border border-white/20 px-4 py-2 text-sm" onClick={() => respond(false)}>{tr('Ablehnen', 'Отклонить', 'Decline')}</button>
        </div>
      </div>}
    </section>
  );
}
