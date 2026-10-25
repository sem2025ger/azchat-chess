import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import ChessBoard from '../components/ChessBoard';
import MobileFriendTimeControl from '../components/MobileFriendTimeControl';
import { toServerTimeControl } from '../components/OnlineLobby';
import ArenaPlayPanel from '../components/ArenaPlayPanel';
import MobileOpponentSearchOverlay from '../components/MobileOpponentSearchOverlay';

import { X, Loader2, Swords, Clock, Copy, Check } from 'lucide-react';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type AccentTheme = 'gold' | 'cyan' | 'violet';

function countryCodeToFlag(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

export default function PlayScreen() {
  const { t } = useLanguage();
  const [timeControl, setTimeControl] = useState('3 min.');
  const [isSearching, setIsSearching] = useState(false);
  const [waitingForSocket, setWaitingForSocket] = useState(false);
  const [waitingForFriendSocket, setWaitingForFriendSocket] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const accentTheme: AccentTheme = 'gold';

  const [isPrivateCreating, setIsPrivateCreating] = useState(false);
  const [privateRoomId, setPrivateRoomId] = useState<string | null>(null);
  const [isJoiningPrivate, setIsJoiningPrivate] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [searchParams] = useSearchParams();
  const hasAutoJoinedRef = useRef(false);
  const mobileInviteReset = useRef<(() => void) | null>(null);
  const mobileFriendOpen = useRef<(() => void) | null>(null);
  const roomParam = searchParams.get('room');

  const navigate = useNavigate();
  const { socket, isConnected, authError } = useSocket();
  const { user, profile, session, isLoading: authIsLoading } = useAuth();
  const { boardTheme, confirmMobileMoves } = useThemeContext();

  // Primary colors based on theme
  const accentColors = {
    gold: {
      primary: 'text-amber-400',
      bg: 'bg-amber-400',
      border: 'border-amber-400/50',
      shadow: 'shadow-amber-400/20',
      gradient: 'from-amber-400 via-yellow-500 to-amber-600',
      glow: 'after:bg-amber-400/20',
      dot: 'bg-[#dfb062]'
    },
    cyan: {
      primary: 'text-cyan-400',
      bg: 'bg-cyan-400',
      border: 'border-cyan-400/50',
      shadow: 'shadow-cyan-400/20',
      gradient: 'from-cyan-400 via-cyan-500 to-cyan-600',
      glow: 'after:bg-cyan-400/20',
      dot: 'bg-cyan-400'
    },
    violet: {
      primary: 'text-violet-400',
      bg: 'bg-violet-400',
      border: 'border-violet-400/50',
      shadow: 'shadow-violet-400/20',
      gradient: 'from-violet-400 via-purple-500 to-violet-600',
      glow: 'after:bg-violet-400/20',
      dot: 'bg-violet-400'
    }
  };

  // User preferences applied automatically via ThemeContext

  useEffect(() => {
    if (!socket) return;
    const onMatchFound = (data: any) => {
      setIsSearching(false);
      setWaitingForSocket(false);
      setIsPrivateCreating(false);
      setIsJoiningPrivate(false);
      navigate(`/play?roomId=${data.roomId}&color=${data.color}`);
    };
    
    const onPrivateRoomCreated = (data: { roomId: string }) => {
      setPrivateRoomId(data.roomId);
    };
    
    const onJoinFailed = (data: { reason: string }) => {
      setIsJoiningPrivate(false);
      if (data.reason === 'storage_unavailable') {
        setIsSearching(false);
        setIsPrivateCreating(false);
        setJoinError('Game storage is unavailable. Please try again shortly.');
      }
      else if (data.reason === 'room_not_found') setJoinError("Room not found or expired.");
      else if (data.reason === 'room_full') setJoinError("This room is already full.");
      else if (data.reason === 'already_in_room') setJoinError("You are already in this room.");
      else setJoinError("Failed to join room.");
      
      setTimeout(() => setJoinError(null), 5000);
    };

    socket.on('match_found', onMatchFound);
    socket.on('private_room_created', onPrivateRoomCreated);
    socket.on('join_failed', onJoinFailed);
    
    return () => { 
      socket.off('match_found', onMatchFound); 
      socket.off('private_room_created', onPrivateRoomCreated);
      socket.off('join_failed', onJoinFailed);
    };
  }, [socket, navigate]);

  useEffect(() => {
    if (!roomParam || hasAutoJoinedRef.current) return;
    if (authIsLoading && window.matchMedia('(max-width: 767px)').matches) return;
    if (!session) {
      hasAutoJoinedRef.current = true;
      if (window.matchMedia('(max-width: 767px)').matches) {
        navigate(`/profile?returnTo=${encodeURIComponent(`/play?room=${encodeURIComponent(roomParam)}`)}`);
        return;
      }
      setJoinError('Sign in required to join a private room.');
      setTimeout(() => setJoinError(null), 5000);
      return;
    }
    if (socket && isConnected) {
      hasAutoJoinedRef.current = true;
      setIsJoiningPrivate(true);
      socket.emit('join_private_room', { roomId: roomParam });
    }
  }, [roomParam, socket, isConnected, session, authIsLoading, navigate]);

  useEffect(() => {
    if (authError === 'unauthorized') {
      setJoinError('Session expired. Please sign in again.');
      setIsSearching(false);
      setWaitingForSocket(false);
      setIsPrivateCreating(false);
      setIsJoiningPrivate(false);
      const timer = setTimeout(() => setJoinError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  useEffect(() => {
    let interval: any;
    if (isSearching) {
      interval = setInterval(() => setSearchTime(prev => prev + 1), 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  // A sleeping multiplayer backend can take time to establish its first WebSocket.
  // Queue exactly once after connection, unless the player cancels or times out.
  useEffect(() => {
    if (!waitingForSocket || !isConnected || !socket) return;
    setWaitingForSocket(false);
    socket.emit('join_queue', { timeControl: toServerTimeControl(timeControl) });
  }, [waitingForSocket, isConnected, socket, timeControl]);

  useEffect(() => {
    if (!waitingForSocket) return;
    const timer = setTimeout(() => {
      setWaitingForSocket(false);
      setIsSearching(false);
      setJoinError('Connection unavailable. Please try again shortly.');
    }, 65000);
    return () => clearTimeout(timer);
  }, [waitingForSocket]);

  useEffect(() => {
    if (!waitingForFriendSocket || !socket || !isConnected) return;
    setWaitingForFriendSocket(false);
    setIsPrivateCreating(true);
    setPrivateRoomId(null);
    socket.emit('create_private_room', { timeControl: toServerTimeControl(timeControl) });
  }, [waitingForFriendSocket, socket, isConnected, timeControl]);

  useEffect(() => {
    if (!waitingForFriendSocket) return;
    const timeout = setTimeout(() => {
      setWaitingForFriendSocket(false);
      setIsPrivateCreating(false);
      setJoinError('Connection unavailable. Please try again shortly.');
    }, 65000);
    return () => clearTimeout(timeout);
  }, [waitingForFriendSocket]);

  const cancelMatchmaking = () => {
    if (socket && isConnected) socket.emit('cancel_matchmaking');
    setWaitingForSocket(false);
    setWaitingForFriendSocket(false);
    setIsSearching(false);
    setIsPrivateCreating(false);
    setIsJoiningPrivate(false);
    setPrivateRoomId(null);
    setJoinError(null);
    setCopiedLink(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const timePresets = {
    Bullet: ['1 min.', '1 | 1', '2 | 1'],
    Blitz: ['3 min.', '3 | 2', '5 min.'],
    Rapid: ['10 min.', '15 | 10', '30 min.'],
  };

  return (
    <div className="play-lobby-screen min-h-full lg:h-full w-full bg-transparent flex flex-col items-center justify-start lg:justify-center p-2 lg:p-3 overflow-y-auto relative pb-6 lg:pb-3 max-md:px-1">
      

      <div className="w-full max-w-[1500px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_430px] gap-2 lg:gap-4 items-start justify-center flex-1 min-h-0 max-lg:flex-none max-lg:min-h-fit pt-0 lg:pt-0">

        {/* ── Left Side: Chess Board ────────────────────────────── */}
        <div className="w-full flex flex-col gap-1 md:gap-1.5 animate-fade-in-up min-h-0">
          {/* Opponent Info */}
          <div className="flex items-center gap-2 px-1 shrink-0">
            <div className="w-8 h-8 bg-neutral-900 rounded-lg border border-white/10 flex items-center justify-center text-base shadow-2xl relative text-neutral-500">
               ?
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 leading-none">
                <span className="font-black text-white text-xs italic tracking-tighter uppercase">{t('play.opponent')}</span>
              </div>
              <span className="text-[0.45rem] text-neutral-600 font-bold uppercase tracking-[0.2em] italic mt-0.5">{t('play.waiting')}</span>
            </div>
          </div>

          <div className="relative group/board flex-1 flex flex-col min-h-0 justify-center">
            {joinError && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-2xl backdrop-blur-md animate-fade-in text-center pointer-events-none whitespace-nowrap">
                {joinError}
              </div>
            )}
            {/* Search on phones has its own typography and visual hierarchy. */}
            {isSearching && (
              <MobileOpponentSearchOverlay
                title={t('play.searching')}
                description={t('play.searchingDesc')}
                elapsed={formatTime(searchTime)}
                cancelLabel={t('play.cancel')}
                onCancel={cancelMatchmaking}
              />
            )}
            {/* Keep the established desktop and private-room overlays unchanged. */}
            {(isSearching || isPrivateCreating || isJoiningPrivate) && (
              <div className={isSearching ? "absolute inset-0 z-50 hidden md:flex items-center justify-center rounded-[2rem] overflow-hidden" : "absolute inset-0 z-50 flex items-center justify-center rounded-[2rem] overflow-hidden"}>
                <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl transition-all duration-700" />
                <div className="relative z-10 flex flex-col items-center text-center p-4 animate-scale-up scale-75 lg:scale-90">
                  <div className="w-20 h-20 mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden group/loader shadow-2xl">
                    <Loader2 size={40} className={cx("animate-spin-slow absolute opacity-20", accentColors[accentTheme].primary)} />
                    <Swords size={28} className={cx("animate-bounce", accentColors[accentTheme].primary)} />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase italic skew-x-[-6deg] mb-1 tracking-tighter">
                    {isSearching ? t('play.searching') : isJoiningPrivate ? "Joining private room..." : "Waiting for friend..."}
                  </h2>
                  <p className="text-neutral-500 text-[0.55rem] font-black uppercase tracking-[0.2em] mb-6 opacity-60 italic">
                    {isSearching ? t('play.searchingDesc') : "Get ready for a great match"}
                  </p>
                  
                  {isSearching && (
                    <div className="bg-white/[0.03] px-8 py-3 rounded-xl border border-white/10 font-mono text-2xl font-bold text-white mb-6 shadow-inner flex items-center gap-2">
                      <Clock size={16} className="text-neutral-600" />
                      {formatTime(searchTime)}
                    </div>
                  )}
                  
                  {isPrivateCreating && privateRoomId && (
                    <div className="bg-white/[0.03] px-4 py-3 rounded-xl border border-white/10 w-full max-w-[300px] mb-6 flex flex-col items-center gap-3">
                      <span className="text-[0.6rem] font-black text-neutral-400 uppercase tracking-widest">Share this link:</span>
                      <div className="flex items-center w-full gap-2 bg-black/40 border border-white/5 rounded-lg p-1">
                        <input 
                          readOnly 
                          value={`${window.location.origin}/play?room=${privateRoomId}`}
                          className="bg-transparent text-white text-[0.6rem] font-mono px-2 py-1 w-full outline-none truncate"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/play?room=${privateRoomId}`);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors shrink-0"
                        >
                          {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white" />}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={cancelMatchmaking}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg font-black text-[0.65rem] uppercase tracking-widest transition-all active:scale-95 shadow-2xl group/cancel"
                  >
                    <X size={14} className="group-hover:rotate-90 transition-transform" /> {t('play.cancel')}
                  </button>
                </div>
              </div>
            )}

            <div 
              className="play-lobby-board w-full aspect-square bg-neutral-900 rounded-[2rem] border-[6px] border-neutral-800/50 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden ring-1 ring-white/10 relative transition-all duration-700 group-hover/board:border-neutral-800 self-center max-w-[94vw] sm:max-w-[560px] lg:max-w-[min(630px,calc(100dvh-120px))] max-md:max-w-none max-md:border-2 max-md:rounded-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10" />
              <ChessBoard confirmMovesMobile={confirmMobileMoves} overrideBoardTheme={boardTheme} className="border-none p-0 bg-transparent shadow-none max-md:[&_[draggable]_img]:scale-110" />
            </div>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-2 px-1 opacity-60 hover:opacity-100 transition-opacity shrink-0">
            <div className="w-8 h-8 bg-neutral-900 rounded-lg border border-white/10 flex items-center justify-center text-base shadow-2xl relative">
              {profile?.countryCode && countryCodeToFlag(profile.countryCode) ? (
                <span aria-label={profile.countryCode}>{countryCodeToFlag(profile.countryCode)}</span>
              ) : (
                <span className="text-neutral-500" aria-label="Country not specified">●</span>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 leading-none">
                <span className="font-black text-white text-xs italic tracking-tighter uppercase">{profile?.username || user?.user_metadata?.username || 'Guest'}</span>
                <span className={cx("bg-opacity-20 text-[0.4rem] px-1 py-0.5 rounded-sm font-black uppercase tracking-[0.15em] border", accentColors[accentTheme].bg, accentColors[accentTheme].primary, accentColors[accentTheme].border)}>YOU</span>
              </div>
              <span className="text-[0.45rem] text-neutral-600 font-bold uppercase tracking-[0.2em] italic mt-0.5">{(profile?.username || user?.user_metadata?.username) ? t('play.playerMode') : t('play.guestMode')}</span>
            </div>
          </div>
        </div>

        {/* ── Right Side: Control Panel ────────────────────────── */}
        <div className="w-full flex flex-col animate-fade-in-right lg:h-full lg:justify-center lg:-ml-4">
          {/* Spacer: aligns panel top with board top */}
          <div className="h-0 md:h-[10px] shrink-0" />
          <MobileFriendTimeControl timeControl={timeControl} onTimeChange={setTimeControl} presets={timePresets} resetRef={mobileInviteReset} openRef={mobileFriendOpen} controlsHidden />
          <ArenaPlayPanel
            timeControl={timeControl}
            onTimeChange={setTimeControl}
            onStart={() => {
              mobileInviteReset.current?.();
              if (authIsLoading) return;
              if (!session) { navigate('/profile?returnTo=%2Fplay'); return; }
              if (!socket || !isConnected) {
                if (authError === 'unauthorized') {
                  setJoinError('Session expired. Please sign in again.');
                  return;
                }
                setWaitingForSocket(true);
                setIsSearching(true);
                return;
              }
              setWaitingForSocket(false);
              setIsSearching(true);
              socket.emit('join_queue', { timeControl: toServerTimeControl(timeControl) });
            }}
            onFriend={() => {
              if (window.matchMedia('(max-width: 767px)').matches) {
                mobileFriendOpen.current?.();
                return;
              }
              if (authIsLoading) return;
              if (!session) { navigate('/profile?returnTo=%2Fplay'); return; }
              if (!socket || !isConnected) {
                if (authError === 'unauthorized') { setJoinError('Session expired. Please sign in again.'); return; }
                setWaitingForFriendSocket(true);
                setIsPrivateCreating(true);
                return;
              }
              setWaitingForFriendSocket(false);
              setIsPrivateCreating(true);
              setPrivateRoomId(null);
              socket.emit('create_private_room', { timeControl: toServerTimeControl(timeControl) });
            }}
          />
          {/* Spacer: matches user footer height so panel bottom aligns with board bottom */}
          <div className="h-0 md:h-[38px] shrink-0" />
        </div>
      </div>

    </div>
  );
}

