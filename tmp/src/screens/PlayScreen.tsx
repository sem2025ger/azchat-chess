import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import ChessBoard from '../components/ChessBoard';
import { Shield, Zap, Users, Trophy, X, Loader2, Sparkles, Swords, Clock } from 'lucide-react';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function PlayScreen() {
  const { t } = useLanguage();
  const [timeControl, setTimeControl] = useState('10 min');
  const [matchType, setMatchType] = useState('Rated');
  const [region, setRegion] = useState('Global');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!socket) return;
    
    const onMatchFound = (data: any) => {
      setIsSearching(false);
      navigate(`/game?roomId=${data.roomId}&color=${data.color}`);
    };

    socket.on('match_found', onMatchFound);
    return () => {
      socket.off('match_found', onMatchFound);
    };
  }, [socket, navigate]);

  const presets = {
    Bullet: ['1+0', '2+1'],
    Blitz: ['3+0', '3+2', '5+0', '5+3'],
    Rapid: ['10+0', '10+5', '15+10']
  };

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

  return (
    <div className="flex flex-col lg:flex-row h-full w-full p-4 lg:p-6 lg:px-12 gap-8 lg:gap-16 overflow-y-auto lg:overflow-hidden items-center justify-center relative custom-scrollbar bg-[#161512]">

      {/* Board Column - Fixed Center-Left */}
      <div className="w-full max-w-[55vh] lg:max-w-[62vh] xl:max-w-[68vh] flex flex-col justify-center flex-shrink-0 animate-fade-in-up relative group">

        {/* Premium Matchmaking Overlay */}
        {isSearching && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 ring-1 ring-white/10 animate-fade-in" />
            <div className="relative z-10 flex flex-col items-center text-center p-12 transform transition-all duration-700 animate-scale-up">

              <div className="relative mb-10">
                <div className="absolute inset-0 bg-chess-active/20 blur-[80px] rounded-full animate-pulse" />
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/10 relative overflow-hidden group">
                  <Loader2 size={64} className="text-chess-active animate-spin-slow opacity-40 absolute" />
                  <Swords size={40} className="text-chess-active animate-bounce relative z-10" />
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <h2 className="text-4xl font-black text-white tracking-widest uppercase italic transform-gpu skew-x-[-4deg] drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">{t('play.searching')}</h2>
                <p className="text-neutral-500 font-black flex items-center justify-center gap-3 text-[0.7rem] uppercase tracking-[0.3em]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                  {t('play.searchingDesc')}
                </p>
              </div>

              <div className="bg-black/60 px-10 py-5 rounded-[2rem] border border-white/5 font-mono text-4xl font-black text-white mb-12 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 tabular-nums">
                {formatTime(searchTime)}
              </div>

              <button
                onClick={() => setIsSearching(false)}
                className="group flex items-center gap-3 px-10 py-4 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-[1.5rem] transition-all text-neutral-500 hover:text-red-400 font-black text-[0.75rem] uppercase tracking-widest shadow-2xl active:scale-95"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                {t('play.cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-6 px-4 animate-fade-in-up delay-100">
          <div className="flex items-center gap-5">
            <div className="relative group/avatar">
              <div className="w-16 h-16 bg-neutral-900 rounded-[1.25rem] border border-white/5 flex items-center justify-center text-3xl shadow-2xl transition-all duration-500 group-hover/avatar:scale-110 group-hover/avatar:-rotate-3 relative z-10">🇦🇿</div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-[#161512] shadow-xl z-20" />
              <div className="absolute inset-0 bg-chess-gold/10 blur-xl rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
            </div>
            <div>
              <div className="font-black text-white text-xl leading-none tracking-tight flex items-center gap-3 italic">
                {profile?.username || user?.user_metadata?.username || 'Guest'}
                <span className="bg-chess-gold/20 text-chess-gold text-[0.6rem] px-2.5 py-1 rounded-lg font-black tracking-widest border border-chess-gold/20 shadow-[0_0_15px_rgba(223,176,98,0.2)]">{profile?.role || 'PLAYER'}</span>
              </div>
              <div className="text-[0.65rem] text-neutral-500 font-black uppercase tracking-[0.25em] mt-2 opacity-60">{t('play.eliteRating')}</div>
            </div>
          </div>
        </div>

        <div className="relative rounded-[2.5rem] overflow-hidden shadow-[0_80px_160px_-40px_rgba(0,0,0,1)] ring-1 ring-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none z-10" />
          <ChessBoard />
        </div>

        <div className="flex justify-between items-start mt-6 px-4 animate-fade-in-up delay-100 opacity-20 filter grayscale">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-neutral-900 rounded-[1.25rem] border border-white/5 flex items-center justify-center text-3xl shadow-2xl relative">
              🇹🇷
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-neutral-700 rounded-full border-[3px] border-[#161512] shadow-xl" />
            </div>
            <div>
              <div className="font-black text-white text-xl leading-none tracking-tight italic">{t('play.waiting')}</div>
              <div className="text-[0.65rem] text-neutral-500 font-black uppercase tracking-[0.25em] mt-2">PLAYER_2</div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Setup Column */}
      <div className="w-full max-w-md lg:w-[420px] xl:w-[440px] flex-shrink-0 flex flex-col gap-3 animate-fade-in-right delay-200 lg:pb-0 lg:h-[78vh] 2xl:h-[72vh] max-h-[800px]">

        {/* Main Configuration Card */}
        <div className="bg-neutral-900/60 backdrop-blur-[40px] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col flex-1 border-b-[8px] border-black/60 relative group/card min-h-0">

          <div className="absolute top-0 right-0 w-64 h-64 bg-chess-active/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none group-hover/card:bg-chess-active/10 transition-colors duration-1000" />

          {/* Segmented Tab */}
          <div className="flex bg-black/40 p-2 gap-2 relative z-10 border-b border-white/5 shrink-0">
            <button className="flex-1 py-3 bg-white/10 rounded-2xl text-[0.6rem] font-black text-white border border-white/10 shadow-2xl tracking-[0.2em] uppercase italic transition-all active:scale-95 leading-none">
              {t('play.tabs.play')}
            </button>
            <button className="flex-1 py-3 text-[0.6rem] font-black text-neutral-500 hover:text-white transition-all uppercase tracking-[0.2em] px-2 italic text-center leading-none">
              {t('play.tabs.tournaments')}
            </button>
            <button className="flex-1 py-3 text-[0.6rem] font-black text-neutral-500 hover:text-white transition-all uppercase tracking-[0.2em] px-2 italic text-center leading-none">
              {t('play.tabs.computer')}
            </button>
          </div>

          <div className="p-5 md:p-6 space-y-4 flex-1 relative z-10 custom-scrollbar overflow-y-auto">

            {/* Time Control Dashboard */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/30 px-6 py-4 rounded-[1.5rem] border border-white/5 shadow-inner group/val">
                <span className="text-[0.6rem] text-neutral-500 font-black uppercase tracking-[0.3em] group-hover/val:text-neutral-400 transition-colors uppercase">{t('play.timeControl')}</span>
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-chess-active animate-pulse" />
                  <span className="text-chess-active font-black tracking-tight text-2xl italic leading-none">{timeControl}</span>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(presets).map(([category, times]) => (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center gap-4 text-[0.6rem] font-black text-neutral-500 uppercase tracking-[0.25em] pl-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 border border-white/10 shadow-lg">
                        {category === 'Bullet' && <Zap size={14} className="text-yellow-400" />}
                        {category === 'Blitz' && <Sparkles size={14} className="text-orange-400" />}
                        {category === 'Rapid' && <Shield size={14} className="text-emerald-400" />}
                      </div>
                      <span className="flex-1">{category}</span>
                      <div className="h-px w-10 bg-white/[0.05]" />
                    </div>
                    <div className="grid grid-cols-4 gap-3 px-1">
                      {times.map(time => (
                        <button
                          key={time}
                          onClick={() => setTimeControl(time)}
                          className={cx(
                            "py-4 rounded-2xl text-[0.7rem] font-black transition-all border relative overflow-hidden group/btn active:scale-90",
                            timeControl === time
                              ? "bg-chess-active/10 border-chess-active/50 text-white shadow-[0_15px_30px_rgba(0,206,209,0.3)] ring-1 ring-chess-active/20"
                              : "bg-neutral-800/40 border-white/5 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                          )}
                        >
                          <div className={cx("absolute inset-0 bg-chess-active/10 opacity-0 transition-opacity", timeControl === time ? "opacity-100" : "group-hover/btn:opacity-50")} />
                          <span className="relative z-10 tracking-tight">{time}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Match Rules Grid */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-3">
                <label className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-[0.3em] pl-3 italic">{t('play.matchType')}</label>
                <div className="flex bg-black/40 p-1.5 rounded-[1.5rem] border border-white/5 ring-1 ring-white/5">
                  <button onClick={() => setMatchType('Rated')} className={cx("flex-1 py-3 rounded-xl text-[0.6rem] font-black transition-all uppercase tracking-widest leading-none", matchType === 'Rated' ? 'bg-chess-gold/20 text-chess-gold shadow-2xl border border-chess-gold/30' : 'text-neutral-600 hover:text-neutral-300')}>RATED</button>
                  <button onClick={() => setMatchType('Casual')} className={cx("flex-1 py-3 rounded-xl text-[0.6rem] font-black transition-all uppercase tracking-widest leading-none", matchType === 'Casual' ? 'bg-white/10 text-white shadow-2xl border border-white/10' : 'text-neutral-600 hover:text-neutral-300')}>CASUAL</button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-[0.3em] pl-3 italic">{t('play.region')}</label>
                <div className="flex bg-black/40 p-1.5 rounded-[1.5rem] border border-white/5 ring-1 ring-white/5">
                  <button onClick={() => setRegion('Global')} className={cx("flex-1 py-3 rounded-xl text-[0.6rem] font-black transition-all uppercase tracking-widest leading-none", region === 'Global' ? 'bg-white/10 text-white shadow-2xl border border-white/10' : 'text-neutral-600 hover:text-neutral-300')}>GLOBAL</button>
                  <button onClick={() => setRegion('AZ/TR')} className={cx("flex-1 py-3 rounded-xl text-[0.6rem] font-black transition-all uppercase tracking-widest leading-none", region === 'AZ/TR' ? 'bg-chess-active/20 text-chess-active shadow-2xl border border-chess-active/30' : 'text-neutral-600 hover:text-neutral-300')}>AZ/TR</button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 bg-black/60 border-t border-white/10 space-y-4 relative z-10 shadow-2xl shrink-0">
            <button
              onClick={() => {
                if (!isConnected) {
                  return; // show disconnected state to user eventually
                }
                setIsSearching(true);
                socket?.emit('join_queue', { timeControl, userId: user?.id, rating: profile?.ratingBlitz });
              }}
              className="w-full py-4 bg-gradient-to-r from-chess-gold via-amber-400 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-3xl font-black text-xl shadow-[0_20px_40px_-10px_rgba(223,176,98,0.5)] transition-all hover:translate-y-[-2px] active:translate-y-[1px] flex items-center justify-center gap-4 group/play ring-1 ring-white/10"
            >
              <span className="tracking-tighter italic uppercase">{t('play.startGame')}</span>
              <div className="w-[1.5px] h-6 bg-black/15 group-hover/play:scale-y-110 transition-transform" />
              <div className="bg-white/30 px-3 py-1 rounded-xl text-[0.65rem] font-black backdrop-blur-md shadow-inner tracking-widest">{timeControl}</div>
            </button>

            <div className="flex items-center justify-center gap-3">
              <div className="flex-1 h-px bg-white/[0.03]" />
              <div className="flex items-center gap-3 text-[0.65rem] font-black text-neutral-500 tracking-[0.3em] uppercase italic group-hover:text-emerald-400 transition-colors">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_#10b981]" />
                34,102 {t('play.playersOnline')}
              </div>
              <div className="flex-1 h-px bg-white/[0.03]" />
            </div>
          </div>
        </div>

        {/* Action Widgets */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <button className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-[1.5rem] hover:bg-chess-active/5 hover:border-chess-active/20 transition-all group/opt active:scale-95 shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover/opt:scale-110 group-hover/opt:rotate-6 transition-all duration-500 border border-indigo-500/10 shadow-xl shrink-0">
              <Users size={18} />
            </div>
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-[0.55rem] font-black text-white italic uppercase tracking-[0.1em] truncate w-full text-left">{t('play.friend')}</span>
              <span className="text-[0.45rem] font-black text-neutral-500 uppercase tracking-widest mt-0.5 truncate w-full text-left">{t('play.directLink')}</span>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-[1.5rem] hover:bg-chess-gold/5 hover:border-chess-gold/20 transition-all group/opt active:scale-95 shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover/opt:scale-110 group-hover/opt:-rotate-6 transition-all duration-500 border border-amber-500/10 shadow-xl shrink-0">
              <Trophy size={18} />
            </div>
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-[0.55rem] font-black text-white italic uppercase tracking-[0.1em] truncate w-full text-left">{t('play.tournaments')}</span>
              <span className="text-[0.45rem] font-black text-neutral-500 uppercase tracking-widest mt-0.5 truncate w-full text-left">{t('play.communityLabel')}</span>
            </div>
          </button>
        </div>

      </div>

    </div>
  );
}
