import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, LoaderCircle, UserRound, Users, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabase';

type Profile = { id: string; username: string; rating_blitz: number | null };
type Invitation = { roomId: string; fromUserId: string; timeControl: string };
type Props = { timeControl: string };

const toServerTime = (value: string) => {
  const match = /^(\d+)\s*(?:min\.|\|\s*(\d+))$/.exec(value);
  if (!match) return '3+0';
  return match[2] === undefined ? `${match[1]}+0` : `${match[1]}+${match[2]}`;
};

export default function OnlinePlayersLobby({ timeControl }: Props) {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const { language } = useLanguage();
  const german = language === 'de';
  const russian = language === 'ru';
  const label = (de: string, ru: string, en: string) => german ? de : russian ? ru : en;
  const [ids, setIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [incoming, setIncoming] = useState<Invitation | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const targetRef = useRef<string | null>(null);
  const pendingRoomRef = useRef<string | null>(null);
  const selectedControlRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeRef = useRef(timeControl);
  timeRef.current = timeControl;

  const players = useMemo(() => ids.map(id => profiles[id]).filter((p): p is Profile => Boolean(p)), [ids, profiles]);

  useEffect(() => {
    if (!socket || !isConnected || !user) {
      setIds([]);
      return;
    }
    const onPresence = (value: { userIds?: string[] }) => {
      setIds(Array.isArray(value?.userIds) ? value.userIds.filter(id => typeof id === 'string' && id !== user.id).slice(0, 100) : []);
    };
    const onInvite = (value: Invitation) => {
      if (!value || typeof value.roomId !== 'string' || typeof value.fromUserId !== 'string') return;
      if (pendingRoomRef.current) {
        socket.emit('decline_lobby_invitation', { roomId: value.roomId });
        return;
      }
      setIncoming(previous => {
        if (previous) {
          socket.emit('decline_lobby_invitation', { roomId: value.roomId });
          return previous;
        }
        return value;
      });
    };
    const onCreated = (value: { roomId: string; timeControl: string }) => {
      if (!targetRef.current) return;
      if (value.timeControl !== selectedControlRef.current) {
        socket.emit('cancel_matchmaking');
        setNotice(label('Zeitkontrolle stimmt nicht überein.', 'Контроль времени не совпадает.', 'Time control mismatch.'));
        targetRef.current = null;
        setPendingTarget(null);
        return;
      }
      pendingRoomRef.current = value.roomId;
      setPendingRoom(value.roomId);
      socket.emit('invite_lobby_player', { roomId: value.roomId, targetUserId: targetRef.current });
    };
    const onSent = () => setNotice(label('Einladung gesendet.', 'Приглашение отправлено.', 'Invitation sent.'));
    const onFailed = (value: { reason?: string }) => {
      if (!targetRef.current) return;
      setNotice(value?.reason === 'player_unavailable'
        ? label('Spieler ist nicht mehr verfügbar.', 'Игрок уже недоступен.', 'Player no longer available.')
        : label('Einladung fehlgeschlagen.', 'Не удалось отправить приглашение.', 'Invitation failed.'));
      if (pendingRoomRef.current) socket.emit('cancel_matchmaking');
      targetRef.current = null;
      pendingRoomRef.current = null;
      setPendingTarget(null);
      setPendingRoom(null);
    };
    const onDeclined = (value: { roomId: string }) => {
      if (pendingRoomRef.current !== value.roomId) return;
      setNotice(label('Einladung abgelehnt.', 'Приглашение отклонено.', 'Invitation declined.'));
      socket.emit('cancel_matchmaking');
      pendingRoomRef.current = null;
      targetRef.current = null;
      setPendingTarget(null);
      setPendingRoom(null);
    };
    const onMatch = () => {
      pendingRoomRef.current = null;
      targetRef.current = null;
      setPendingTarget(null);
      setPendingRoom(null);
      setIncoming(null);
    };
    socket.on('lobby_presence', onPresence);
    socket.on('lobby_game_invitation', onInvite);
    socket.on('private_room_created', onCreated);
    socket.on('invitation_sent', onSent);
    socket.on('invitation_failed', onFailed);
    socket.on('invitation_declined', onDeclined);
    socket.on('join_failed', onFailed);
    socket.on('match_found', onMatch);
    socket.emit('lobby_presence_enter');
    return () => {
      socket.emit('lobby_presence_leave');
      if (pendingRoomRef.current) socket.emit('cancel_matchmaking');
      socket.off('lobby_presence', onPresence);
      socket.off('lobby_game_invitation', onInvite);
      socket.off('private_room_created', onCreated);
      socket.off('invitation_sent', onSent);
      socket.off('invitation_failed', onFailed);
      socket.off('invitation_declined', onDeclined);
      socket.off('join_failed', onFailed);
      socket.off('match_found', onMatch);
      if (timerRef.current) clearTimeout(timerRef.current);
      targetRef.current = null;
      pendingRoomRef.current = null;
    };
  }, [socket, isConnected, user?.id]);

  useEffect(() => {
    if (!ids.length) return;
    let current = true;
    const unknown = ids.filter(id => !profiles[id]);
    if (!unknown.length) return;
    void supabase.from('profiles').select('id,username,rating_blitz')
      .in('id', unknown.slice(0, 100)).then(({ data, error }) => {
        if (!current || error) return;
        const next = Object.fromEntries((data ?? []).map(p => [p.id, p as Profile]));
        setProfiles(previous => ({ ...previous, ...next }));
      });
    return () => { current = false; };
  }, [ids, profiles]);

  const invite = (targetUserId: string) => {
    if (!socket || !isConnected || pendingTarget || targetRef.current || !user) return;
    setNotice('');
    const selected = toServerTime(timeRef.current);
    selectedControlRef.current = selected;
    targetRef.current = targetUserId;
    setPendingTarget(targetUserId);
    socket.emit('create_private_room', { timeControl: selected });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!targetRef.current) return;
      if (pendingRoomRef.current) socket.emit('cancel_matchmaking');
      targetRef.current = null;
      pendingRoomRef.current = null;
      setPendingTarget(null);
      setPendingRoom(null);
      setNotice(label('Einladung abgelaufen.', 'Время приглашения истекло.', 'Invitation expired.'));
    }, 60000);
  };
  const cancel = () => {
    if (pendingRoomRef.current) socket?.emit('cancel_matchmaking');
    if (timerRef.current) clearTimeout(timerRef.current);
    targetRef.current = null;
    pendingRoomRef.current = null;
    setPendingTarget(null);
    setPendingRoom(null);
    setNotice('');
  };
  const respond = (accept: boolean) => {
    if (!incoming || !socket) return;
    if (accept) socket.emit('join_private_room', { roomId: incoming.roomId });
    else socket.emit('decline_lobby_invitation', { roomId: incoming.roomId });
    setIncoming(null);
  };

  return (
    <section className="mt-3 rounded-2xl border border-white/10 bg-[#171b1c] p-3 text-neutral-100 shadow-xl" aria-label={label('Spieler online', 'Игроки онлайн', 'Online players')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={17} className="text-emerald-300" />
          {label('Spieler online', 'Игроки онлайн', 'Players online')}</h2>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs tabular-nums text-emerald-200">{players.length}</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-neutral-400">
        {label('Spieler in der Spiellobby. Lade einen Spieler zu einer privaten Partie ein.',
          'Игроки в игровом лобби. Пригласите конкретного игрока на партию.',
          'Players in the game lobby. Invite someone to a private match.')}
      </p>
      {!isConnected || !user ? (
        <p className="text-xs text-neutral-400">{label('Zum Anzeigen anmelden und verbinden.', 'Войдите в аккаунт и подключитесь к серверу.', 'Sign in and connect to see online players.')}</p>
      ) : players.length === 0 ? (
        <p className="rounded-xl bg-white/[0.035] px-3 py-3 text-xs text-neutral-400">
          {label('Momentan wartet niemand. Nutze die automatische Spielersuche.', 'Сейчас никого нет. Используйте автоматический поиск соперника.', 'Nobody is available right now. Try automatic matchmaking.')}
        </p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {players.map(p => <div key={p.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.035] p-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200"><UserRound size={16} /></span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{p.username}</span>
            <span className="text-xs tabular-nums text-neutral-400">{p.rating_blitz ?? '—'}</span>
            <button type="button" onClick={() => invite(p.id)} disabled={Boolean(pendingTarget)}
              className="min-h-9 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-40">
              {label('Einladen', 'Вызвать', 'Invite')}
            </button>
          </div>)}
        </div>
      )}
      {pendingTarget && <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 p-2 text-xs">
        <LoaderCircle size={15} className="animate-spin" /><span className="flex-1">
          {pendingRoom ? label('Warte auf Antwort…', 'Ожидание ответа…', 'Waiting for reply…')
            : label('Einladung wird erstellt…', 'Создание приглашения…', 'Creating invitation…')}
        </span><button type="button" onClick={cancel} className="flex min-h-9 items-center gap-1 px-2"><X size={15} />{label('Abbrechen', 'Отмена', 'Cancel')}</button>
      </div>}
      {notice && <p className="mt-2 text-xs text-amber-200" role="status">{notice}</p>}
      {incoming && <div role="alertdialog" aria-modal="false" aria-label={label('Spieleinladung', 'Приглашение на игру', 'Game invitation')}
        className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} />
          {label('Spieleinladung', 'Вас пригласили сыграть', 'Game invitation')} · {incoming.timeControl}
        </div>
        <p className="mb-3 text-xs text-neutral-300">{profiles[incoming.fromUserId]?.username ??
          label('Ein Spieler', 'Игрок', 'A player')}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => respond(true)} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-400 text-neutral-950"><Check size={16} />{label('Annehmen', 'Принять', 'Accept')}</button>
          <button type="button" onClick={() => respond(false)} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-white/20"><X size={16} />{label('Ablehnen', 'Отклонить', 'Decline')}</button>
        </div>
      </div>}
    </section>
  );
}
