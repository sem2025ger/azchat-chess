import { useEffect, useMemo, useState } from 'react';
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

/** Presence is opt-in and scoped to the Play screen. Never expose socket IDs or email. */
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
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const available = useMemo(() => userIds.filter(id => id !== user?.id), [userIds, user?.id]);

  useEffect(() => {
    if (!socket || !isConnected || !session || !visible) {
      setUserIds([]);
      return;
    }
    socket.emit('lobby_presence_enter');
    const onPresence = (data: { userIds?: string[] }) =>
      setUserIds(Array.isArray(data?.userIds) ? data.userIds.filter(id => typeof id === 'string').slice(0, 100) : []);
    const onInvitation = (data: Invite) => {
      if (typeof data?.roomId !== 'string' || typeof data?.fromUserId !== 'string') return;
      setInbound(current => current ?? data);
    };
    const onCreated = (data: { roomId: string; timeControl: string }) => {
      if (!pendingTarget) return;
      if (data.timeControl !== toServerTimeControl(timeControl)) {
        socket.emit('cancel_matchmaking');
        setMessage(tr('Zeitkontrolle nicht bestätigt.', 'Контроль времени не подтверждён.', 'Time control not confirmed.'));
        setPendingTarget(null);
        return;
      }
      setPendingRoom(data.roomId);
      socket.emit('invite_lobby_player', { roomId: data.roomId, targetUserId: pendingTarget });
    };
    const onFail = () => {
      setPendingTarget(null); setPendingRoom(null);
      setMessage(tr('Einladung fehlgeschlagen.', 'Приглашение не удалось.', 'Invitation failed.'));
      socket.emit('cancel_matchmaking');
    };
    const onDeclined = () => {
      setPendingTarget(null); setPendingRoom(null);
      setMessage(tr('Einladung abgelehnt.', 'Приглашение отклонено.', 'Invitation declined.'));
      socket.emit('cancel_matchmaking');
    };
    socket.on('lobby_presence', onPresence);
    socket.on('lobby_game_invitation', onInvitation);
    socket.on('private_room_created', onCreated);
    socket.on('invitation_failed', onFail);
    socket.on('invitation_declined', onDeclined);
    return () => {
      socket.emit('lobby_presence_leave');
      socket.off('lobby_presence', onPresence);
      socket.off('lobby_game_invitation', onInvitation);
      socket.off('private_room_created', onCreated);
      socket.off('invitation_failed', onFail);
      socket.off('invitation_declined', onDeclined);
    };
  }, [socket, isConnected, session, visible, pendingTarget, timeControl, language]);

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
    setPendingTarget(targetId);
    socket.emit('create_private_room', { timeControl: toServerTimeControl(timeControl) });
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

  if (!session) return <section className="rounded-xl border border-white/10 bg-neutral-900/70 p-3 text-xs text-neutral-400">
    {tr('Melde dich an, um verfügbare Spieler zu sehen.', 'Войдите, чтобы увидеть игроков онлайн.', 'Sign in to see online players.')}
  </section>;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#131817] p-3 text-neutral-100" aria-label="Online players lobby">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{tr('Spieler online', 'Игроки онлайн', 'Online players')}</h2>
        <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
          aria-pressed={visible} onClick={() => { if (visible && pendingRoom) socket?.emit('cancel_matchmaking'); setVisible(v => !v); setPendingTarget(null); setPendingRoom(null); }}>
          {visible ? tr('Nicht sichtbar', 'Скрыться', 'Go invisible') : tr('Sichtbar werden', 'Показаться онлайн', 'Go visible')}
        </button>
      </div>
      {visible && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-neutral-400">{tr('Du bist für andere Spieler hier sichtbar. Andere Bereiche zeigen dich nicht als online.', 'Ты виден другим игрокам только здесь.', 'You are visible to players in this lobby only.')}</p>
          {available.length === 0 && <p className="text-xs text-neutral-400">{tr('Noch keine anderen Spieler verfügbar.', 'Других доступных игроков пока нет.', 'No other players available yet.')}</p>}
          {available.map(id => (
            <div key={id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="min-w-0 truncate text-sm">{profiles[id] || tr('Spieler', 'Игрок', 'Player')}</span>
              <button type="button" disabled={!!pendingTarget} className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-neutral-950 disabled:opacity-50"
                onClick={() => challenge(id)}>{pendingTarget === id ? tr('Warten…', 'Ожидание…', 'Waiting…') : tr('Herausfordern', 'Вызвать', 'Challenge')}</button>
            </div>
          ))}
          {!!pendingTarget && <button type="button" className="text-xs underline underline-offset-4" onClick={() => {
            socket?.emit('cancel_matchmaking'); setPendingTarget(null); setPendingRoom(null);
          }}>{tr('Einladung abbrechen', 'Отменить приглашение', 'Cancel invitation')}</button>}
        </div>
      )}
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
