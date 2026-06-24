import { useState, useEffect } from 'react';
import { Target, Swords, Zap, Activity, Calendar, MapPin, LogOut, Loader2 } from 'lucide-react';
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
               type: m.time_control || '10+0', 
               date: new Date(m.created_at).toLocaleDateString()
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
  const [authMessage, setAuthMessage] = useState('');

  const stats = [
    { label: 'Blitz', value: profile?.ratingBlitz ?? t('profile.unrated'), icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/5', border: 'border-amber-400/20' },
    { label: 'Rapid', value: profile?.ratingRapid ?? t('profile.unrated'), icon: Target, color: 'text-chess-active', bg: 'bg-chess-active/5', border: 'border-chess-active/20' },
    { label: 'Bullet', value: profile?.ratingBullet ?? t('profile.unrated'), icon: Swords, color: 'text-rose-400', bg: 'bg-rose-400/5', border: 'border-rose-400/20' },
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg('');
    setAuthMessage('');

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

  const handleForgotPassword = async () => {
    setErrorMsg('');
    setAuthMessage('');
    if (!email) {
      setErrorMsg(t('auth.emailRequired'));
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`
      });
      if (error) throw error;
      setAuthMessage(t('auth.resetEmailSent'));
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.recoveryError'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setErrorMsg('');
    setAuthMessage('');
    if (!email) {
      setErrorMsg(t('auth.emailRequired'));
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/profile` }
      });
      if (error) throw error;
      setAuthMessage(t('auth.magicLinkSent'));
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.recoveryError'));
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
      <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 overflow-y-auto lg:overflow-hidden bg-transparent h-full min-h-0 touch-pan-y pb-28 lg:pb-0 lg:h-full flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
        
        <div className="w-full md:w-[700px] lg:w-[740px] max-w-[calc(100vw-2rem)] bg-neutral-900/85 backdrop-blur-2xl border-[2px] border-transparent rounded-[1.75rem] p-7 md:p-10 lg:p-11 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)] animate-fade-in-up relative overflow-hidden panel-glow-cycle transition-all">
          <div className="absolute -left-20 -top-20 w-[400px] h-[400px] bg-chess-gold/10 blur-[120px] pointer-events-none" />
          
          <div className="w-full max-w-[560px] mx-auto relative z-10">
            <div className="flex border-b border-white/10 -mt-2 mb-7">
              <button
                type="button"
                onClick={() => setIsLoginMode(true)}
                className={`flex-1 py-4 text-lg font-semibold transition-colors relative focus:outline-none ${
                  isLoginMode ? 'text-chess-gold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t('auth.signIn')}
                {isLoginMode && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-chess-gold" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsLoginMode(false)}
                className={`flex-1 py-4 text-lg font-semibold transition-colors relative focus:outline-none ${
                  !isLoginMode ? 'text-chess-gold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t('auth.register')}
                {!isLoginMode && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-chess-gold" />
                )}
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-5 md:space-y-6">
              {!isLoginMode && (
                <div className="space-y-1">
                  <label className="text-base font-semibold text-neutral-200 block mb-1">
                    {t('auth.usernameLabel')}
                  </label>
                  <input 
                    required 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    type="text" 
                    className="w-full px-5 py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
                  />
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-base font-semibold text-neutral-200 block mb-1">
                  {t('auth.emailLabel')}
                </label>
                <input 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  type="email" 
                  className="w-full px-5 py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-base font-semibold text-neutral-200 block">
                    {t('auth.passwordLabel')}
                  </label>
                  {isLoginMode && (
                    <button type="button" onClick={handleForgotPassword} className="text-sm text-chess-gold hover:text-white transition-colors focus:outline-none">
                      {t('auth.forgotPassword')}
                    </button>
                  )}
                </div>
                <input 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  type="password" 
                  className="w-full px-5 py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
                />
              </div>

              {errorMsg && (
                <div className="text-center p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg mt-4">
                  {errorMsg}
                </div>
              )}

              {authMessage && (
                <div className="text-center p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg mt-4">
                  {authMessage}
                </div>
              )}

              <button disabled={authLoading} type="submit" className="w-full py-4 md:py-5 mt-4 bg-chess-gold/90 hover:bg-chess-gold disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-xl font-bold text-lg shadow-lg shadow-chess-gold/10 transition-colors active:scale-[0.99] flex items-center justify-center gap-2">
                {authLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                {isLoginMode ? t('auth.submitLogin') : t('auth.submitRegister')}
              </button>

              {isLoginMode && (
                <>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-sm text-neutral-500 uppercase tracking-widest">{t('auth.or')}</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                  </div>
                  <button type="button" onClick={handleMagicLink} disabled={authLoading} className="w-full py-4 md:py-5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg border border-white/5 transition-colors active:scale-[0.99] flex items-center justify-center gap-2">
                    {authLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                    {t('auth.emailLinkLogin')}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-2 md:px-6 md:py-4 overflow-y-auto lg:overflow-hidden bg-transparent h-full min-h-0 overscroll-y-contain touch-pan-y pb-28 lg:pb-0 lg:h-full">

      {/* Profile Identity - Compact Professional Header */}
      <div className="bg-neutral-950/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-5 md:p-6 shadow-[0_0_80px_-20px_rgba(0,0,0,1)] animate-fade-in-up flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-8 mb-5 relative overflow-hidden ring-1 ring-white/10 group">

        {/* Glow behind profile */}
        <div className="absolute -left-20 -top-20 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] pointer-events-none group-hover:bg-chess-gold/15 transition-colors duration-1000" />
        <div className="absolute right-0 bottom-0 w-[500px] h-[500px] bg-chess-active/5 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

        <div className="flex items-center gap-6 z-10 w-full md:w-auto md:border-r border-white/10 md:pr-8">
          <div className="relative shrink-0">
            <div className="w-24 h-24 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-[1.5rem] flex items-center justify-center overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,1)] border border-white/10 relative group/avatar transform hover:scale-105 transition-transform duration-700 ring-4 ring-black/50">
              <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500 group-hover/avatar:scale-110 transition-transform">
                {(profile?.username || user?.user_metadata?.username || user?.email || 'G').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute -bottom-3 -right-3 bg-gradient-to-br from-emerald-400 to-emerald-600 text-black p-2.5 rounded-[0.85rem] shadow-2xl border-[3px] border-[#161512] animate-bounce z-20">
              <Zap size={14} fill="currentColor" />
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-col md:items-start items-start gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter drop-shadow-xl line-clamp-1">
                  {profile?.username || user?.user_metadata?.username || 'Guest'}
                </h1>
                {profile?.role && (
                  <span className="bg-chess-gold/20 border border-chess-gold/30 text-chess-gold font-black text-[0.6rem] px-2.5 py-0.5 rounded-lg uppercase tracking-widest shadow-md">
                    {profile.role}
                  </span>
                )}
              </div>
              {user?.email && (
                <div className="text-xs font-semibold text-neutral-500 tracking-wide line-clamp-1">
                  {user.email}
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 text-neutral-400 font-black text-[0.6rem] uppercase tracking-[0.15em] pt-1">
              {profile?.countryCode && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-inner ring-1 ring-white/5">
                  <MapPin size={12} className="text-chess-active" /> {profile.countryCode}
                </div>
              )}
              {!profile?.countryCode && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-inner ring-1 ring-white/5 opacity-60">
                  <MapPin size={12} className="text-neutral-500" /> {t('profile.countryNotSet')}
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-inner ring-1 ring-white/5">
                <Calendar size={12} className="text-chess-gold" /> {(profile as any)?.created_at ? `${t('profile.memberSince')} ${new Date((profile as any).created_at).getFullYear()}` : t('profile.newPlayer')}
              </div>
            </div>
          </div>
        </div>

        {/* Rating Dashboard Section */}
        <div className="flex-1 flex flex-col justify-center z-10">
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s, i) => (
              <div key={i} className={cx(
                "flex flex-col p-3 md:p-4 rounded-[1.25rem] border transition-all duration-500 hover:scale-[1.03] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] group/stat ring-1 backdrop-blur-md relative overflow-hidden",
                s.bg, s.border, s.border.replace('border-', 'ring-')
              )}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className={cx("flex items-center gap-1.5 text-[0.55rem] md:text-[0.65rem] font-black uppercase tracking-[0.2em] mb-1 z-10", s.color)}>
                  <s.icon size={12} /> {s.label}
                </div>
                <span className="text-xl md:text-2xl font-black text-white italic tracking-tighter tabular-nums group-hover/stat:translate-x-1 transition-transform z-10">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="hidden md:flex items-center z-10 border-l border-white/10 pl-6 shrink-0">
          <button onClick={signOut} aria-label="Sign out" title="Sign out" className="flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-black text-[0.65rem] uppercase tracking-widest active:scale-95 shadow-lg shadow-red-500/5">
            <LogOut size={16} />
            <span className="hidden xl:inline">SIGN OUT</span>
          </button>
        </div>
        
        <button onClick={signOut} className="flex md:hidden items-center justify-center gap-2 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-black text-[0.65rem] uppercase tracking-widest shadow-lg shadow-red-500/5 z-10">
          <LogOut size={14} /> SIGN OUT
        </button>
      </div>

      {/* Main Content Layout - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">

        {/* Left/Main Column: Stats & Recent Games */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-4 animate-fade-in-up delay-200">
          
          <div className="bg-neutral-950/80 backdrop-blur-3xl border border-white/10 p-5 md:p-6 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,1)] ring-1 ring-white/10 space-y-5 group/perform relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            
            <div className="flex items-center justify-between relative z-10">
              <h2 className="text-base md:text-lg font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                <div className="p-2 md:p-2.5 bg-gradient-to-br from-chess-active/20 to-chess-active/5 rounded-xl text-chess-active group-hover/perform:scale-110 transition-transform shadow-lg shadow-chess-active/10 border border-chess-active/20">
                  <Activity size={18} />
                </div>
                {t('profile.performance')}
              </h2>
              <div className="px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-[0.5rem] md:text-[0.55rem] font-black text-neutral-500 tracking-widest uppercase shadow-inner ring-1 ring-white/5">{t('profile.rankingUnavailable')}</div>
            </div>

            {/* Extended Win/Loss/Draw Dashboard */}
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between text-[0.6rem] md:text-[0.65rem] font-black uppercase tracking-widest text-neutral-500 bg-black/20 p-3.5 md:p-4 rounded-2xl border border-white/5">
                <div className="flex flex-col gap-1">
                  <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{t('profile.wins')}</span>
                  <span className="text-xl md:text-2xl text-white font-black">{dbStats.wins}</span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-neutral-400">{t('profile.draws')}</span>
                  <span className="text-xl md:text-2xl text-white font-black">{dbStats.draws}</span>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]">{t('profile.losses')}</span>
                  <span className="text-xl md:text-2xl text-white font-black">{dbStats.losses}</span>
                </div>
              </div>
              <div className="relative h-4 md:h-5 w-full bg-black/60 rounded-full overflow-hidden flex shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] border border-white/10 ring-1 ring-white/5">
                <div style={{ width: `${Math.max(1, (dbStats.wins/(dbStats.wins+dbStats.losses+dbStats.draws||1))*100)}%` }} className="bg-gradient-to-r from-emerald-600 to-emerald-400 relative group/win transition-all duration-700 hover:opacity-80"></div>
                <div style={{ width: `${Math.max(1, (dbStats.draws/(dbStats.wins+dbStats.losses+dbStats.draws||1))*100)}%` }} className="bg-gradient-to-r from-neutral-600 to-neutral-400 relative group/draw transition-all duration-700 hover:opacity-80"></div>
                <div style={{ width: `${Math.max(1, (dbStats.losses/(dbStats.wins+dbStats.losses+dbStats.draws||1))*100)}%` }} className="bg-gradient-to-r from-rose-600 to-rose-400 relative group/loss transition-all duration-700 hover:opacity-80"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
              </div>
              <div className="flex justify-center pt-1">
                <span className="text-[0.55rem] md:text-[0.6rem] font-black text-neutral-400 uppercase tracking-widest italic flex items-center gap-2">
                  {t('profile.winRate')}: <span className="text-white drop-shadow-md">{dbStats.rate}%</span> 
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-3 md:space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg md:text-xl font-black text-white italic tracking-tighter uppercase drop-shadow-md">{t('profile.recentGames')}</h2>
            </div>

            {recentGames.length === 0 ? (
              <div className="w-full bg-neutral-950/80 backdrop-blur-3xl border border-white/10 rounded-[1.5rem] ring-1 ring-white/10 flex items-center gap-4 px-5 py-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                <div className="w-10 h-10 rounded-full bg-black/40 border border-white/5 flex items-center justify-center shadow-inner shrink-0">
                  <Activity size={16} className="text-neutral-600" />
                </div>
                <p className="text-[0.7rem] md:text-xs font-black text-neutral-400 italic tracking-widest uppercase leading-tight">
                  {t('profile.noRecentGames')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentGames.map((g, i) => (
                  <div key={i} className="bg-neutral-950/80 backdrop-blur-3xl border border-white/10 px-5 py-4 md:px-6 md:py-5 rounded-[1.75rem] md:rounded-[2rem] flex items-center justify-between hover:bg-neutral-900/90 transition-all duration-500 group/game shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/10 relative overflow-hidden cursor-default hover:scale-[1.01]">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none opacity-0 group-hover/game:opacity-100 transition-opacity" />
                    
                    <div className="flex items-center gap-4 md:gap-6 relative z-10 w-full">
                      <div className={cx(
                        "w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[1.25rem] flex items-center justify-center font-black text-lg md:text-xl shadow-2xl transition-all duration-500 group-hover/game:scale-110 group-hover/game:rotate-[5deg] border border-current shrink-0",
                        g.result === 'win' ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30 shadow-emerald-500/20" :
                          g.result === 'loss' ? "bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30 shadow-rose-500/20" : "bg-gradient-to-br from-neutral-500/20 to-neutral-500/5 text-neutral-400 border-neutral-500/30 shadow-neutral-500/20"
                      )}>
                        {g.result === 'win' ? '1-0' : g.result === 'loss' ? '0-1' : '½-½'}
                      </div>
                      
                      <div className="space-y-1 md:space-y-1.5 flex-1">
                        <div className="flex items-center justify-between w-full">
                          <div className="font-black text-base md:text-lg text-white tracking-tight italic group-hover/game:text-chess-active transition-colors flex items-center gap-1.5 md:gap-2 drop-shadow-md">
                            <span className="text-neutral-500 text-xs md:text-sm font-bold no-italic">vs</span> {g.opp || t('profile.unknownOpponent')}
                          </div>
                          <div className="text-[0.6rem] md:text-[0.65rem] text-neutral-400 font-black uppercase tracking-widest bg-black/40 px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl border border-white/5 ring-1 ring-white/5">
                            {g.type}
                          </div>
                        </div>
                        
                        <div className="text-[0.55rem] md:text-[0.6rem] text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-2 md:gap-3">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={10} className="opacity-70" /> {g.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-5 lg:space-y-6 animate-fade-in-up delay-300">
          
          {/* Achievements Locked */}
          <div className="bg-neutral-950/80 backdrop-blur-3xl border border-white/10 p-6 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,1)] ring-1 ring-white/10 space-y-4 relative overflow-hidden flex flex-col items-center justify-center py-12 lg:min-h-[160px] group/achievements text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div className="w-14 h-14 rounded-full bg-black/40 border border-white/5 flex items-center justify-center shadow-inner mb-2 group-hover/achievements:scale-110 transition-transform">
              <Zap size={24} className="text-neutral-600" />
            </div>
            <h3 className="text-sm md:text-base font-black text-neutral-400 italic tracking-widest uppercase">{t('profile.achievements')}</h3>
            <p className="text-[0.6rem] md:text-[0.65rem] font-bold text-neutral-600 uppercase tracking-widest max-w-[200px] leading-relaxed">
              {t('profile.achievementsLocked')}
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
