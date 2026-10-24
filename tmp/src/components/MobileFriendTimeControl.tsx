import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Clock, Copy, Link2, Loader2, Share2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../context/SocketContext';

type Props = {
  controlsHidden?: boolean;
  openRef?: RefObject<(() => void) | null>;
  timeControl: string;
  onTimeChange: (value: string) => void;
  presets: Record<string, string[]>;
  resetRef: RefObject<(() => void) | null>;
};

// Mount the invitation flow only on mobile. Desktop keeps its existing controls.
export default function MobileFriendTimeControl(props: Props) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile ? <MobileControl {...props} /> : null;
}

function MobileControl({ timeControl, onTimeChange, presets, resetRef, controlsHidden, openRef }: Props) {
  const { t } = useLanguage();
  const { socket, isConnected, authError } = useSocket();
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'time' | 'invite' | null>(() => params.get('invite') === '1' ? 'invite' : null);
  const [creating, setCreating] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [roomTime, setRoomTime] = useState(timeControl);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const requestPending = useRef(false);
  const requestedControl = useRef('');
  const ownedRoom = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const friendButtonRef = useRef<HTMLButtonElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateRef = useRef(t);
  translateRef.current = t;
  const category = Object.entries(presets).find(([, values]) => values.includes(timeControl))?.[0] || 'Blitz';
  const url = room ? `${window.location.origin}/play?room=${encodeURIComponent(room)}` : '';

  useEffect(() => {
    const requestedTime = params.get('tc');
    if (params.get('invite') === '1' && requestedTime && Object.values(presets).flat().includes(requestedTime)) {
      onTimeChange(requestedTime);
    }
    // Apply the invitation's return context once when this mobile control mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket) return;
    const fail = (message: string) => {
      if (!requestPending.current && !ownedRoom.current) return;
      requestPending.current = false;
      ownedRoom.current = false;
      if (requestTimer.current) clearTimeout(requestTimer.current);
      setCreating(false);
      setRoom(null);
      setError(message);
    };
    const onCreated = (data: { roomId: string; timeControl?: string }) => {
      if (!requestPending.current) return;
      requestPending.current = false;
      if (requestTimer.current) clearTimeout(requestTimer.current);
      // Older servers do not confirm the selected time: don't share a misleading link.
      if (data.timeControl !== requestedControl.current) {
        socket.emit('cancel_matchmaking');
        setCreating(false);
        setError(translateRef.current('invite.unavailable'));
        return;
      }
      ownedRoom.current = true;
      setRoom(data.roomId);
      setCreating(false);
    };
    const onMatch = () => {
      ownedRoom.current = false;
      requestPending.current = false;
      if (requestTimer.current) clearTimeout(requestTimer.current);
    };
    const onFailed = () => fail(translateRef.current('invite.failed'));
    const onDisconnect = () => fail(translateRef.current('invite.disconnected'));
    const onRateLimit = (data: { action: string }) => {
      if (data.action === 'create_private_room') fail(translateRef.current('invite.failed'));
    };
    socket.on('private_room_created', onCreated);
    socket.on('match_found', onMatch);
    socket.on('join_failed', onFailed);
    socket.on('disconnect', onDisconnect);
    socket.on('rate_limit_exceeded', onRateLimit);
    return () => {
      socket.off('private_room_created', onCreated);
      socket.off('match_found', onMatch);
      socket.off('join_failed', onFailed);
      socket.off('disconnect', onDisconnect);
      socket.off('rate_limit_exceeded', onRateLimit);
      if (requestTimer.current) clearTimeout(requestTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (requestPending.current || ownedRoom.current) socket.emit('cancel_matchmaking');
      requestPending.current = false;
      ownedRoom.current = false;
    };
  }, [socket]);

  useEffect(() => {
    if (!mode) return;
    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode(null);
      if (event.key !== 'Tab' || !panel) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input'));
      const first = controls[0];
      const last = controls.at(-1);
      if (!panel.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      const originalButton = (mode === 'time' ? timeButtonRef : friendButtonRef).current;
      (controlsHidden ? opener : originalButton)?.focus();
    };
  }, [mode, controlsHidden]);

  useEffect(() => {
    if (!openRef) return;
    openRef.current = () => { setError(null); setMode('invite'); };
    return () => { openRef.current = null; };
  }, [openRef]);

  const cancelInvitation = () => {
    if (requestPending.current || ownedRoom.current) socket?.emit('cancel_matchmaking');
    if (requestTimer.current) clearTimeout(requestTimer.current);
    requestPending.current = false;
    ownedRoom.current = false;
    setRoom(null);
    setCreating(false);
    setCopied(false);
    setError(null);
  };

  const createInvitation = () => {
    if (isLoading || requestPending.current) return;
    if (!session || authError === 'unauthorized') {
      const returnTo = `/play?invite=1&tc=${encodeURIComponent(timeControl)}`;
      navigate(`/profile?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (!socket || !isConnected) { setError(t('invite.disconnected')); return; }
    const [minutes, increment = '0'] = timeControl.replace(' min.', '').split(' | ');
    setError(null);
    setCopied(false);
    setRoomTime(timeControl);
    setCreating(true);
    requestPending.current = true;
    requestedControl.current = `${minutes}+${increment}`;
    socket.emit('create_private_room', { timeControl: `${minutes}+${increment}` });
    requestTimer.current = setTimeout(() => {
      if (!requestPending.current) return;
      socket.emit('cancel_matchmaking');
      requestPending.current = false;
      setCreating(false);
      setError(t('invite.failed'));
    }, 12000);
  };

  // Starting a public match cancels this pending invitation before joining the queue.
  // The desktop caller has no mobile control mounted, so its ref stays null.
  useEffect(() => {
    resetRef.current = cancelInvitation;
    return () => { resetRef.current = null; };
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(null);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch { setError(t('invite.copyFailed')); }
  };

  const shareLink = async () => {
    if (!navigator.share) { await copyLink(); return; }
    try { await navigator.share({ title: 'Chessaz.De', text: t('invite.shareText'), url }); }
    catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(t('invite.copyFailed'));
    }
  };

  const buttonClass = 'min-h-11 rounded-xl border px-3 py-2 font-bold text-sm transition-colors duration-150 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50';
  const primaryClass = `${buttonClass} bg-gradient-to-r from-[#e3c77d] to-[#84d4c9] text-[#121b19] border-white/20`;
  return (
    <div className="md:hidden">
      <div className="flex items-stretch gap-2" hidden={controlsHidden} style={controlsHidden ? { display: 'none' } : undefined}>
        <button ref={timeButtonRef} type="button" disabled={creating || !!room} aria-label={t('invite.chooseTime')} aria-haspopup="dialog" aria-expanded={mode === 'time'}
          onClick={() => { setError(null); setMode('time'); }}
          className="flex-1 min-w-0 flex items-center justify-center gap-3 px-3 py-3 rounded-xl border border-white/5 bg-[#181818] active:bg-[#202020] touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
          <Clock size={21} className="text-chess-gold shrink-0" />
          <span className="flex flex-col items-center gap-1 leading-none">
            <span className="text-xl font-black italic uppercase tracking-tight text-glow-cycle">{timeControl}</span>
            <span className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-[0.2em]">{category}</span>
          </span>
          <ChevronDown size={16} className="text-neutral-400 shrink-0" />
        </button>
        <button ref={friendButtonRef} type="button" aria-haspopup="dialog" aria-expanded={mode === 'invite'} onClick={() => { setError(null); setMode('invite'); }}
          className="w-[36%] min-w-[104px] max-w-[156px] flex items-center justify-center gap-2 px-2 py-3 rounded-xl border border-[#70c7c0]/35 bg-gradient-to-br from-[#26332c] to-[#142b2b] text-[#b4e5dc] text-[0.8rem] font-bold active:bg-[#24413d] touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
          <Link2 size={19} className="shrink-0" /><span>{t('invite.withFriend')}</span>
        </button>
      </div>
      {mode && createPortal(
        <div className="fixed inset-0 z-[999] md:hidden flex items-center justify-center bg-black/80 px-3 py-[max(0.5rem,env(safe-area-inset-top))]" onClick={() => setMode(null)}>
          <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="mobile-time-invite-title" onClick={event => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[#8bc7b8]/30 bg-gradient-to-br from-[#1b2520] to-[#111715] p-4 shadow-2xl [@media(max-height:600px)]:p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 id="mobile-time-invite-title" className="text-xl font-bold text-[#f1efdf] leading-tight">{t(mode === 'time' ? 'invite.chooseTime' : room ? 'invite.ready' : 'invite.title')}</h2>
                <p className="text-xs text-[#b6c3bb] mt-1">{room ? roomTime : timeControl} · {category}</p>
              </div>
              <button type="button" aria-label={t('invite.close')} onClick={() => setMode(null)} className="w-11 h-11 shrink-0 rounded-xl border border-white/10 flex items-center justify-center text-neutral-300 active:bg-white/10"><X size={21} /></button>
            </div>
            {room ? (
              <div className="space-y-3">
                <p className="text-sm text-[#bdcbc3] leading-relaxed">{t('invite.sendLink')}</p>
                <input aria-label={t('invite.link')} readOnly value={url} onFocus={event => event.target.select()} className="w-full h-12 min-w-0 px-3 rounded-xl bg-black/25 border border-white/15 text-sm text-[#e4ece6] font-mono focus:outline focus:outline-1 focus:outline-cyan-300" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={copyLink} className={`${primaryClass} flex items-center justify-center gap-2`}>
                    {copied ? <Check size={17} /> : <Copy size={17} />} {t(copied ? 'invite.copied' : 'invite.copy')}
                  </button>
                  <button type="button" onClick={shareLink} className={`${buttonClass} flex items-center justify-center gap-2 border-[#83b9ac]/30 text-[#c5dfd2] bg-white/[0.03]`}><Share2 size={17} />{t('invite.share')}</button>
                </div>
                <p role="status" className="rounded-xl border border-[#83b9ac]/15 bg-[#14231c] px-3 py-3 text-sm text-[#b7cfbe] flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#9bc6ab] shrink-0" />{t('invite.waiting')}</p>
                <button type="button" onClick={cancelInvitation} className={`${buttonClass} w-full text-[#c7c2b6] border-white/10`}>{t('invite.cancel')}</button>
              </div>
            ) : (
              <>
                <div className="space-y-3 [@media(max-height:600px)]:space-y-2">
                  {Object.entries(presets).map(([name, items]) => (
                    <section key={name} aria-label={name}>
                      <h3 className="text-[0.65rem] font-bold tracking-[0.14em] uppercase text-[#b4c5b9] mb-1.5">{name}</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {items.map(item => <button key={item} type="button" disabled={creating} aria-pressed={timeControl === item}
                          onClick={() => { onTimeChange(item); setError(null); if (mode === 'time') setMode(null); }}
                          className={`${buttonClass} min-h-[48px] [@media(max-height:600px)]:min-h-11 ${timeControl === item ? 'bg-[#e0c47b]/10 border-[#e0c47b]/65 text-[#f0dda4]' : 'bg-white/[0.025] border-white/10 text-[#d3ddd5]'}`}>{item}</button>)}
                      </div>
                    </section>
                  ))}
                </div>
                {mode === 'invite' && <button type="button" disabled={creating || isLoading} onClick={createInvitation} className={`${primaryClass} mt-4 w-full flex items-center justify-center gap-2`}>
                  {creating ? <Loader2 size={18} className="motion-safe:animate-spin" /> : <Link2 size={18} />}{t(creating ? 'invite.creating' : 'invite.create')}
                </button>}
              </>
            )}
            {error && <p role="alert" className="mt-3 text-xs leading-relaxed text-[#f2c5a7]">{error}</p>}
          </div>
        </div>, document.body
      )}
    </div>
  );
}
