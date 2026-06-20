import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import ChessBoard from '../components/ChessBoard';

import { Shield, Zap, Users, Trophy, X, Loader2, Sparkles, Swords, Clock, ChevronDown, Copy, Check } from 'lucide-react';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type AccentTheme = 'gold' | 'cyan' | 'violet';

export default function PlayScreen() {
  const { t } = useLanguage();
  const [timeControl, setTimeControl] = useState('3 min.');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const accentTheme: AccentTheme = 'gold';
  const [isTimeExpanded, setIsTimeExpanded] = useState(false);

  const [isPrivateCreating, setIsPrivateCreating] = useState(false);
  const [privateRoomId, setPrivateRoomId] = useState<string | null>(null);
  const [isJoiningPrivate, setIsJoiningPrivate] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [searchParams] = useSearchParams();
  const hasAutoJoinedRef = useRef(false);
  const roomParam = searchParams.get('room');

  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user, profile } = useAuth();

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
      setIsPrivateCreating(false);
      setIsJoiningPrivate(false);
      navigate(`/game?roomId=${data.roomId}&color=${data.color}`);
    };
    
    const onPrivateRoomCreated = (data: { roomId: string }) => {
      setPrivateRoomId(data.roomId);
    };
    
    const onJoinFailed = (data: { reason: string }) => {
      setIsJoiningPrivate(false);
      if (data.reason === 'room_not_found') setJoinError("Room not found or expired.");
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
    if (roomParam && socket && isConnected && !hasAutoJoinedRef.current) {
      hasAutoJoinedRef.current = true;
      setIsJoiningPrivate(true);
      socket.emit('join_private_room', { roomId: roomParam });
    }
  }, [roomParam, socket, isConnected]);

  useEffect(() => {
    let interval: any;
    if (isSearching) {
      interval = setInterval(() => setSearchTime(prev => prev + 1), 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

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

  const getCategory = (tc: string): string => {
    for (const [cat, items] of Object.entries(timePresets)) {
      if (items.includes(tc)) return cat;
    }
    return 'Blitz';
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    Bullet: <Zap size={14} className="text-orange-400" />,
    Blitz:  <Sparkles size={14} className="text-yellow-400" />,
    Rapid:  <Shield size={14} className="text-emerald-400" />,
  };

  return (
    <div className="min-h-full lg:h-full w-full bg-transparent flex flex-col items-center justify-start lg:justify-center p-2 lg:p-3 overflow-y-auto lg:overflow-hidden relative pb-6 lg:pb-3">
      

      <div className="w-full max-w-[1500px] grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] gap-2 lg:gap-4 items-start justify-center flex-1 min-h-0 pt-0 lg:pt-0">

        {/* ── Left Side: Chess Board ────────────────────────────── */}
        <div className="w-full flex flex-col gap-1 md:gap-1.5 animate-fade-in-up min-h-0">
          {/* Opponent Info */}
          <div className="flex items-center gap-2 px-1 shrink-0">
            <div className="w-8 h-8 bg-neutral-900 rounded-lg border border-white/10 flex items-center justify-center text-base shadow-2xl relative">
               🇦🇿
               <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0a0a0a]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 leading-none">
                <span className="font-black text-white text-xs italic tracking-tighter uppercase">{t('play.opponent')}</span>
                <span className="bg-white/10 text-white/40 text-[0.4rem] px-1 py-0.5 rounded-sm font-black uppercase tracking-[0.15em] border border-white/5">GM</span>
              </div>
              <span className="text-[0.45rem] text-neutral-600 font-bold uppercase tracking-[0.2em] italic mt-0.5">{t('play.eliteRating')}</span>
            </div>
          </div>

          <div className="relative group/board flex-1 flex flex-col min-h-0 justify-center">
            {joinError && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-2xl backdrop-blur-md animate-fade-in text-center pointer-events-none whitespace-nowrap">
                {joinError}
              </div>
            )}
            {/* Matchmaking Overlay */}
            {(isSearching || isPrivateCreating || isJoiningPrivate) && (
              <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[2rem] overflow-hidden">
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
                    onClick={() => {
                      if (socket && isConnected) {
                        socket.emit('cancel_matchmaking');
                      }

                      setIsSearching(false);
                      setIsPrivateCreating(false);
                      setIsJoiningPrivate(false);
                      setPrivateRoomId(null);
                      setJoinError(null);
                      setCopiedLink(false);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg font-black text-[0.65rem] uppercase tracking-widest transition-all active:scale-95 shadow-2xl group/cancel"
                  >
                    <X size={14} className="group-hover:rotate-90 transition-transform" /> {t('play.cancel')}
                  </button>
                </div>
              </div>
            )}

            <div 
              className="w-full aspect-square bg-neutral-900 rounded-[2rem] border-[6px] border-neutral-800/50 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden ring-1 ring-white/10 relative transition-all duration-700 group-hover/board:border-neutral-800 self-center max-w-[94vw] sm:max-w-[560px] lg:max-w-[min(600px,calc(100vh-130px))]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10" />
              <ChessBoard overrideBoardTheme="Classic Green" className="border-none p-0 bg-transparent shadow-none" />
            </div>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-2 px-1 opacity-60 hover:opacity-100 transition-opacity shrink-0">
            <div className="w-8 h-8 bg-neutral-900 rounded-lg border border-white/10 flex items-center justify-center text-base shadow-2xl relative">🇹🇷</div>
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
          <div className="bg-[#121212] rounded-[2rem] md:rounded-[2.5rem] border-[2px] border-transparent overflow-hidden flex flex-col relative group/panel border-b-[4px] border-black/40 panel-glow-cycle transition-all">
            
            {/* Dynamic Background Glow removed since panel-glow-cycle handles it */}


            <div className="p-2 space-y-2 overflow-y-auto custom-scrollbar relative z-10">

              {/* ── Collapsible Time Control Accordion ─────────────── */}
              <div className="space-y-2">

                {/* Summary / Toggle Button */}
                <button
                  onClick={() => setIsTimeExpanded(v => !v)}
                  className={cx(
                    "w-full flex items-center justify-center gap-3 md:gap-4 px-3 py-3 md:px-4 md:py-4 rounded-xl md:rounded-2xl border transition-all duration-200 group/tc active:scale-[0.98]",
                    isTimeExpanded
                      ? cx("bg-white/[0.04] border-white/10", accentColors[accentTheme].border)
                      : "bg-[#181818] border-white/5 hover:border-white/10 hover:bg-[#1e1e1e]"
                  )}
                >
                  {/* Category icon */}
                  <div className={cx(
                    "w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 transition-all duration-300 shrink-0",
                    isTimeExpanded ? "bg-white/[0.06]" : "bg-white/[0.03]"
                  )}>
                    {categoryIcons[getCategory(timeControl)]}
                  </div>
                  {/* Selected time + category label — centered */}
                  <div className="flex flex-col items-center leading-none gap-1">
                    <span className="text-xl font-black italic uppercase tracking-tight text-glow-cycle">
                      {timeControl}
                    </span>
                    <span className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-[0.2em]">
                      {getCategory(timeControl)}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cx(
                      "text-neutral-500 transition-transform duration-300 group-hover/tc:text-neutral-300 shrink-0",
                      isTimeExpanded ? "rotate-180" : ""
                    )}
                  />
                </button>

                {/* Expanded Grid */}
                {isTimeExpanded && (
                  <div className="space-y-2 pt-1">
                    {Object.entries(timePresets).map(([category, items]) => (
                      <div key={category} className="space-y-1.5">
                        <div className="flex items-center gap-1.5 px-0.5 opacity-50">
                          <div className="w-4 h-4 flex items-center justify-center rounded-md bg-white/[0.03] border border-white/5">
                            {category === 'Bullet' && <Zap size={10} className="text-orange-400" />}
                            {category === 'Blitz' && <Sparkles size={10} className="text-yellow-400" />}
                            {category === 'Rapid' && <Shield size={10} className="text-emerald-400" />}
                          </div>
                          <span className="text-[0.6rem] font-black text-glow-cycle uppercase tracking-[0.12em] italic">{category}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {items.map(item => (
                            <button
                              key={item}
                              onClick={() => { setTimeControl(item); setIsTimeExpanded(false); }}
                              className={cx(
                                "py-2 rounded-lg text-[0.72rem] font-black transition-all duration-150 border shadow-2xl relative group/btn overflow-hidden active:scale-95",
                                timeControl === item
                                  ? cx("bg-white/[0.06] text-white border-opacity-60 ring-1", accentColors[accentTheme].border, accentTheme === 'gold' ? 'ring-amber-500/20' : accentTheme === 'cyan' ? 'ring-cyan-500/20' : 'ring-violet-500/20')
                                  : "bg-[#181818] border-white/5 text-neutral-500 hover:border-white/10 hover:text-neutral-300 hover:bg-[#1a1a1a]"
                              )}
                            >
                              <div className={cx(
                                "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300",
                                accentColors[accentTheme].gradient,
                                timeControl === item ? 'opacity-10' : 'group-hover/btn:opacity-5'
                              )} />
                              <span className={cx("relative z-10 tracking-tight italic uppercase", timeControl === item ? "text-glow-cycle" : "")}>{item}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* CTA Area */}
            <div className="p-2 bg-black/60 border-t border-white/10 space-y-1.5 relative z-10 shadow-[0_-15px_30px_rgba(0,0,0,0.6)] backdrop-blur-md shrink-0">
               <button
                  onClick={() => {
                    setIsSearching(true);
                    if (socket) socket.emit('join_queue');
                  }}
                  className={cx(
                    "w-full py-2.5 rounded-[2rem] relative overflow-hidden transition-all duration-[150ms] group/cta active:scale-[0.97] border border-white/20 btn-glow-cycle"
                  )}
               >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/cta:opacity-100 transition-opacity duration-[150ms]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <span className="text-shadow-cycle font-black text-base italic tracking-tighter uppercase leading-none transform group-hover:scale-105 transition-transform duration-500">{t('play.startGame')}</span>
                    <div className="px-2 py-0.5 bg-black/90 backdrop-blur-xl rounded-lg text-white font-black text-[0.65rem] shadow-2xl border border-white/10 flex items-center gap-1.5">
                      <Clock size={11} className="text-neutral-500" />
                      {timeControl}
                    </div>
                  </div>
               </button>
            </div>

            {/* Footer Buttons */}
            <div className="p-2 xl:min-h-[96px] xl:items-center grid grid-cols-2 gap-2 bg-black/40 border-t border-white/5 shrink-0">
              <FooterActionBtn 
                icon={<Users size={14} />} 
                label={t('play.friend')} 
                sublabel={t('play.directLink')} 
                onClick={() => {
                  if (socket && isConnected) {
                    setIsPrivateCreating(true);
                    setPrivateRoomId(null);
                    socket.emit('create_private_room');
                  } else {
                    setJoinError("Connection not ready. Please try again.");
                    setTimeout(() => setJoinError(null), 5000);
                  }
                }}
              />
              <FooterActionBtn 
                icon={<Trophy size={14} />} 
                label={t('play.tournaments')} 
                sublabel={t('play.communityLabel')} 
                disabled={true}
              />
            </div>

          </div>
          {/* Spacer: matches user footer height so panel bottom aligns with board bottom */}
          <div className="h-0 md:h-[38px] shrink-0" />
        </div>
      </div>
    </div>
  );
}

function FooterActionBtn({ icon, label, sublabel, onClick, disabled }: { icon: React.ReactNode, label: string, sublabel: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      aria-disabled={disabled ? "true" : undefined}
      onClick={onClick}
      className={cx(
        "flex items-center gap-1.5 p-1.5 bg-white/[0.02] border border-white/5 rounded-xl transition-all duration-150 group/fbtn shadow-2xl text-left relative overflow-hidden xl:min-h-[52px]",
        disabled
          ? "cursor-not-allowed"
          : "hover:bg-white/[0.05] hover:border-white/10 active:scale-95"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div
        className={cx(
          "w-7 h-7 xl:w-9 xl:h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 shadow-xl relative z-10 shrink-0 transition-all duration-200",
          disabled
            ? "text-neutral-600"
            : "text-neutral-500 group-hover/fbtn:scale-110 group-hover/fbtn:text-white group-hover/fbtn:bg-white/10"
        )}
      >
        {icon}
      </div>
      <div className="flex flex-col overflow-hidden relative z-10">
        <span className="text-[0.6rem] xl:text-[0.68rem] font-black uppercase tracking-[0.05em] italic truncate text-chess-gold">{label}</span>
        <span className="text-[0.45rem] xl:text-[0.5rem] font-black uppercase tracking-[0.02em] mt-0.5 truncate text-chess-gold opacity-75">{sublabel}</span>
      </div>
    </button>
  );
}
