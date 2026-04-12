import { useState, useEffect } from 'react';
import { Target, Trophy, Swords, Zap, Activity, Calendar, MapPin, ChevronRight, Award, LogOut, Loader2, KeyRound, Mail, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { session, profile, isLoading, signOut, user } = useAuth();

  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState({ wins: 0, losses: 0, draws: 0, rate: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from('matches').select('*, profiles!white_id(username, countryCode), black_profile:profiles!black_id(username, countryCode)')
      .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if(data) {
           let w=0, l=0, d=0;
           const fmt = data.map(m => {
             const isWhite = m.white_id === user.id;
             let res = 'draw';
             if (m.winner_id === user.id) { res='win'; w++; }
             else if (m.winner_id && m.winner_id !== user.id) { res='loss'; l++; }
             else if (m.status === 'draw') { res='draw'; d++; }
             
             const oppName = isWhite ? m.black_id?.slice(0,6) || 'Guest' : m.white_id?.slice(0,6) || 'Guest';
             
             return { 
               result: res, 
               opp: oppName, 
               r1: '?', 
               r2: '?', 
               type: m.time_control || '10+0', 
               date: new Date(m.created_at).toLocaleDateString(), 
               flag: '🌐' 
             };
           });
           setRecentGames(fmt);
           const total = w+l+d;
           setDbStats({ wins: w, losses: l, draws: d, rate: total > 0 ? Number(((w/total)*100).toFixed(1)) : 0 });
        }
      });
  }, [user]);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stats = [
    { label: 'Blitz', value: profile?.ratingBlitz || '1200', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/5', border: 'border-amber-400/20' },
    { label: 'Rapid', value: profile?.ratingRapid || '1200', icon: Target, color: 'text-chess-active', bg: 'bg-chess-active/5', border: 'border-chess-active/20' },
    { label: 'Bullet', value: profile?.ratingBullet || '1200', icon: Swords, color: 'text-rose-400', bg: 'bg-rose-400/5', border: 'border-rose-400/20' },
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg('');

    // Pre-flight check for missing environment keys causing fetch crashes
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('mock-url') || import.meta.env.VITE_SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
      setErrorMsg('CONFIGURATION ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing or set to placeholder in tmp/.env. Please configure them to enable authentication.');
      setAuthLoading(false);
      return;
    }

    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        if (error) throw error;
      }
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
         setErrorMsg('NETWORK ERROR: Failed to reach Supabase. Check if your VITE_SUPABASE_URL is valid, or if you have an active internet connection.');
      } else {
         setErrorMsg(err.message || 'Authentication error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 h-full bg-[#161512]">
        <Loader2 size={48} className="text-chess-gold animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 overflow-hidden bg-[#161512] h-full flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-br from-chess-gold/5 via-transparent to-chess-active/5 pointer-events-none" />
        
        <div className="w-full max-w-md bg-neutral-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] animate-fade-in-up relative overflow-hidden ring-1 ring-white/5">
          <div className="absolute -left-20 -top-20 w-[400px] h-[400px] bg-chess-gold/10 blur-[120px] pointer-events-none" />
          
          <h2 className="text-3xl font-black text-white italic tracking-tighter text-center mb-8 relative z-10 uppercase transform-gpu skew-x-[-2deg]">
            {isLoginMode ? 'Sign In' : 'Create Account'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-5 relative z-10">
            {!isLoginMode && (
              <div className="space-y-1">
                <label className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-widest pl-2">Username</label>
                <div className="relative group">
                  <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-chess-gold transition-colors" />
                  <input required value={username} onChange={e => setUsername(e.target.value)} type="text" placeholder="QaraQaplan_99" className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-neutral-700 font-bold focus:outline-none focus:border-chess-gold transition-all shadow-inner" />
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-widest pl-2">Email Address</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-chess-gold transition-colors" />
                <input required value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="player@aztr.com" className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-neutral-700 font-bold focus:outline-none focus:border-chess-gold transition-all shadow-inner" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-widest pl-2">Password</label>
              <div className="relative group">
                <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-chess-gold transition-colors" />
                <input required value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-neutral-700 font-bold focus:outline-none focus:border-chess-gold transition-all shadow-inner" />
              </div>
            </div>

            {errorMsg && (
              <div className="text-center p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest rounded-xl">
                {errorMsg}
              </div>
            )}

            <button disabled={authLoading} type="submit" className="w-full py-4 mt-2 bg-gradient-to-r from-chess-gold via-amber-400 to-amber-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-black rounded-2xl font-black text-lg shadow-[0_10px_30px_-5px_rgba(223,176,98,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95">
              {authLoading ? <Loader2 size={20} className="animate-spin" /> : null}
              {isLoginMode ? 'AUTHENTICATE' : 'SECURE REGISTRATION'}
            </button>
          </form>

          <div className="mt-6 text-center text-[0.65rem] font-black tracking-widest uppercase relative z-10">
            <span className="text-neutral-600">{isLoginMode ? "Don't have an account? " : "Already registered? "}</span>
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-chess-gold hover:text-white transition-colors underline decoration-chess-gold/30 underline-offset-4">
              {isLoginMode ? 'Create one now' : 'Sign in here'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-2 md:px-8 md:py-3 overflow-hidden bg-[#161512] h-full">

      {/* Profile Identity - High Fidelity */}
      <div className="bg-neutral-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-5 md:p-7 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] animate-fade-in-up flex flex-col md:flex-row items-center gap-6 mb-4 relative overflow-hidden ring-1 ring-white/5 group">

        {/* Glow behind profile */}
        <div className="absolute -left-20 -top-20 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] pointer-events-none group-hover:bg-chess-gold/10 transition-colors duration-1000" />
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-chess-active/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 shrink-0">
          <div className="w-28 h-28 bg-neutral-800 rounded-[1.75rem] flex items-center justify-center overflow-hidden shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8)] border-[3px] border-chess-gold/40 relative group/avatar transform hover:scale-105 transition-transform duration-700 ring-4 ring-black/50">
            <span className="text-5xl group-hover/avatar:scale-110 transition-transform">{profile?.countryCode === 'TR' ? '🇹🇷' : '🇦🇿'}</span>
          </div>
          <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-black p-2.5 rounded-xl shadow-2xl border-4 border-[#161512] animate-bounce z-20">
            <Zap size={14} fill="currentColor" />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left relative z-10 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter transform-gpu skew-x-[-1deg]">{profile?.username || user?.user_metadata?.username || 'Guest'}</h1>
                <span className="bg-chess-gold font-black text-black text-[0.6rem] px-3 py-1 rounded-xl uppercase tracking-widest shadow-lg shadow-chess-gold/20 animate-pulse">{profile?.role?.toUpperCase() || 'PLAYER'}</span>
              </div>
              <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-black text-[0.6rem] uppercase tracking-widest hidden md:flex active:scale-95">
                <LogOut size={14} /> SIGN OUT
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-neutral-500 font-black text-[0.65rem] uppercase tracking-[0.25em]">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-full backdrop-blur-md">
                <MapPin size={12} className="text-chess-active" /> {profile?.countryCode || 'AZ'}
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-full backdrop-blur-md">
                <Calendar size={12} className="text-chess-gold" /> {t('profile.memberSince')} {(profile as any)?.created_at ? new Date((profile as any).created_at).getFullYear() : '2024'}
              </div>
            </div>
            <button onClick={signOut} className="mt-4 mx-auto flex md:hidden items-center justify-center gap-2 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all font-black text-[0.6rem] uppercase tracking-widest">
              <LogOut size={16} /> Sign Out
            </button>
          </div>

          {/* Rating Dashboard Section */}
          <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto md:mx-0">
            {stats.map((s, i) => (
              <div key={i} className={cx(
                "flex flex-col p-3 rounded-[1.5rem] border transition-all duration-500 hover:scale-[1.05] shadow-2xl group/stat ring-1",
                s.bg, s.border, s.border.replace('border-', 'ring-')
              )}>
                <div className={cx("flex items-center gap-1.5 text-[0.55rem] font-black uppercase tracking-[0.2em] mb-1.5", s.color)}>
                  <s.icon size={12} /> {s.label}
                </div>
                <span className="text-2xl font-black text-white italic tracking-tighter tabular-nums group-hover/stat:translate-x-1 transition-transform">{s.value}</span>
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={cx("h-full w-2/3 group-hover/stat:w-3/4 transition-all duration-1000", s.color.replace('text-', 'bg-'))} />
                  </div>
                  <span className={cx("text-[0.45rem] font-black uppercase", s.color)}>{t('profile.topPercent')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left Column: Stats & Performance */}
        <div className="space-y-4 animate-fade-in-up delay-200">
          <div className="bg-neutral-900/40 backdrop-blur-3xl border border-white/5 p-5 rounded-[2rem] shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/5 space-y-4 group/perform">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                <div className="p-2 bg-chess-active/10 rounded-xl text-chess-active group-hover/perform:scale-110 transition-transform">
                  <Activity size={18} />
                </div>
                {t('profile.performance')}
              </h2>
              <div className="px-2.5 py-1 bg-white/5 rounded-full border border-white/5 text-[0.5rem] font-black text-neutral-500 tracking-widest uppercase">{t('profile.globalRank')}: #452</div>
            </div>

            {/* Extended Win/Loss/Draw Dashboard */}
            <div className="space-y-3">
              <div className="flex justify-between text-[0.6rem] font-black uppercase tracking-widest text-neutral-500">
                <div className="flex flex-col gap-0.5">
                  <span className="text-emerald-400">{t('profile.wins')}</span>
                  <span className="text-xl text-white">{dbStats.wins}</span>
                </div>
                <div className="flex flex-col gap-0.5 items-center">
                  <span className="text-neutral-500">{t('profile.draws')}</span>
                  <span className="text-xl text-white text-center">{dbStats.draws}</span>
                </div>
                <div className="flex flex-col gap-0.5 items-end">
                  <span className="text-rose-400">{t('profile.losses')}</span>
                  <span className="text-xl text-white">{dbStats.losses}</span>
                </div>
              </div>
              <div className="relative h-4 w-full bg-black/40 rounded-full overflow-hidden flex shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] border border-white/5 ring-1 ring-white/5">
                <div style={{ width: `${Math.max(1, (dbStats.wins/(dbStats.wins+dbStats.losses+dbStats.draws||1))*100)}%` }} className="bg-emerald-500 relative group/win transition-all duration-700 hover:opacity-80"></div>
                <div style={{ width: `${Math.max(1, (dbStats.draws/(dbStats.wins+dbStats.losses+dbStats.draws||1))*100)}%` }} className="bg-neutral-500 relative group/draw transition-all duration-700 hover:opacity-80"></div>
                <div style={{ width: `${Math.max(1, (dbStats.losses/(dbStats.wins+dbStats.losses+dbStats.draws||1))*100)}%` }} className="bg-rose-500 relative group/loss transition-all duration-700 hover:opacity-80"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent pointer-events-none" />
              </div>
              <div className="flex justify-center">
                <span className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-widest italic flex items-center gap-2">{t('profile.winRate')}: {dbStats.rate}% <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" /></span>
              </div>
            </div>

            {/* Achievements/Trophies Showcase */}
            <div className="pt-3 border-t border-white/[0.03]">
              <h3 className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3 flex items-center justify-between italic">
                {t('profile.recentTrophies')}
                <Award size={12} className="text-chess-gold" />
              </h3>
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-transparent text-amber-500 rounded-[1rem] flex items-center justify-center border border-amber-500/30 shadow-[0_20px_40px_-5px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/10 group-hover/perform:rotate-3 transition-all duration-700 scale-105">
                  <Trophy size={24} />
                </div>
                <div className="w-12 h-12 bg-white/5 text-neutral-500 rounded-[1rem] flex items-center justify-center border border-white/5 opacity-40 hover:opacity-100 transition-opacity">
                  <span className="font-black text-sm">#1</span>
                </div>
                <div className="w-12 h-12 bg-white/5 text-neutral-500 rounded-[1rem] flex items-center justify-center border border-white/5 opacity-40 hover:opacity-100 transition-opacity">
                  <span className="font-black text-sm">X10</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Historical Overview */}
        <div className="lg:col-span-2 space-y-3 animate-fade-in-up delay-300">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">{t('profile.recentGames')}</h2>
            <button className="text-[0.6rem] font-black text-chess-active uppercase tracking-widest hover:translate-x-1 transition-transform inline-flex items-center gap-2 group">
              {t('profile.viewHistory')} <ChevronRight size={14} className="group-hover:scale-110" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentGames.map((g, i) => (
              <div key={i} className="bg-neutral-900/40 backdrop-blur-3xl border border-white/5 px-5 py-4 rounded-[1.75rem] flex items-center justify-between hover:bg-neutral-900/60 transition-all cursor-pointer group/game shadow-xl ring-1 ring-white/5">
                <div className="flex items-center gap-5">
                  <div className={cx(
                    "w-12 h-12 rounded-[1rem] flex items-center justify-center font-black text-lg shadow-2xl transition-all duration-500 group-hover/game:scale-110 group-hover/game:rotate-3 border border-current shrink-0",
                    g.result === 'win' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10" :
                      g.result === 'loss' ? "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10" : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                  )}>
                    {g.result === 'win' ? '1-0' : g.result === 'loss' ? '0-1' : '½-½'}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-sm border border-white/5 shadow-lg group-hover/game:translate-y-[-2px] transition-transform">{g.flag}</div>
                      <div className="font-black text-base text-white tracking-tight italic group-hover/game:text-chess-active transition-colors flex items-center gap-2 underline decoration-white/5 group-hover/game:decoration-chess-active/30">
                        vs {g.opp}
                        <span className="text-[0.6rem] font-black text-neutral-500 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 normal-case tracking-normal italic">{g.r2} ELO</span>
                      </div>
                    </div>
                    <div className="text-[0.6rem] text-neutral-500 font-black uppercase tracking-widest ml-9 flex items-center gap-2">
                      <span className="text-neutral-400">{g.type}</span>
                      <div className="w-1 h-1 rounded-full bg-neutral-800" />
                      <span className="opacity-60">{g.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pr-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[0.6rem] font-black text-neutral-500 uppercase tracking-widest border border-white/5 opacity-0 group-hover/game:opacity-100 transition-all hover:bg-chess-active/10 hover:text-chess-active hover:border-chess-active/20 group/rev">
                    {t('profile.review')}
                    <ChevronRight size={12} className="group-hover/rev:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
