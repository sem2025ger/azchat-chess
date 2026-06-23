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
    <div className="max-w-6xl mx-auto px-4 py-2 md:px-8 md:py-3 overflow-y-auto lg:overflow-hidden bg-transparent h-full min-h-0 overscroll-y-contain touch-pan-y pb-28 lg:pb-0 lg:h-full">

      {/* Profile Identity - High Fidelity */}
      <div className="bg-neutral-950/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-[0_0_100px_-20px_rgba(0,0,0,1)] animate-fade-in-up flex flex-col md:flex-row items-center gap-8 mb-6 relative overflow-hidden ring-1 ring-white/10 group">

        {/* Glow behind profile */}
        <div className="absolute -left-20 -top-20 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] pointer-events-none group-hover:bg-chess-gold/15 transition-colors duration-1000" />
        <div className="absolute right-0 bottom-0 w-[500px] h-[500px] bg-chess-active/5 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

        <div className="relative z-10 shrink-0">
          <div className="w-32 h-32 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-[2rem] flex items-center justify-center overflow-hidden shadow-[0_20px_50px_-10px_rgba(0,0,0,1)] border border-white/10 relative group/avatar transform hover:scale-105 transition-transform duration-700 ring-4 ring-black/50">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500 group-hover/avatar:scale-110 transition-transform">
              {(profile?.username || user?.user_metadata?.username || user?.email || 'G').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="absolute -bottom-4 -right-4 bg-gradient-to-br from-emerald-400 to-emerald-600 text-black p-3 rounded-2xl shadow-2xl border-[3px] border-[#161512] animate-bounce z-20">
            <Zap size={16} fill="currentColor" />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left relative z-10 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col md:items-start items-center gap-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter drop-shadow-2xl">
                    {profile?.username || user?.user_metadata?.username || 'Guest'}
                  </h1>
                  {profile?.role && (
                    <span className="bg-chess-gold/20 border border-chess-gold/30 text-chess-gold font-black text-[0.65rem] px-3 py-1 rounded-xl uppercase tracking-widest shadow-lg shadow-chess-gold/10">
                      {profile.role}
                    </span>
                  )}
                </div>
                {user?.email && (
                  <div className="text-sm font-semibold text-neutral-500 tracking-wide">
                    {user.email}
                  </div>
                )}
              </div>
              <button onClick={signOut} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-black text-[0.65rem] uppercase tracking-widest hidden md:flex active:scale-95 shadow-lg shadow-red-500/5">
                <LogOut size={16} /> SIGN OUT
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-neutral-400 font-black text-[0.65rem] uppercase tracking-[0.2em]">
              {profile?.countryCode && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-inner ring-1 ring-white/5">
                  <MapPin size={14} className="text-chess-active" /> {profile.countryCode}
                </div>
              )}
              {!profile?.countryCode && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-inner ring-1 ring-white/5 opacity-60">
                  <MapPin size={14} className="text-neutral-500" /> {t('profile.countryNotSet')}
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/5 rounded-full backdrop-blur-md shadow-inner ring-1 ring-white/5">
                <Calendar size={14} className="text-chess-gold" /> {(profile as any)?.created_at ? `${t('profile.memberSince')} ${new Date((profile as any).created_at).getFullYear()}` : t('profile.newPlayer')}
              </div>
            </div>
            <button onClick={signOut} className="mt-4 mx-auto flex md:hidden items-center justify-center gap-2 w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all font-black text-[0.65rem] uppercase tracking-widest shadow-lg shadow-red-500/5">
              <LogOut size={16} /> Sign Out
            </button>
          </div>

          {/* Rating Dashboard Section */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto md:mx-0">
            {stats.map((s, i) => (
              <div key={i} className={cx(
                "flex flex-col p-4 md:p-5 rounded-[1.75rem] border transition-all duration-500 hover:scale-[1.03] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] group/stat ring-1 backdrop-blur-md relative overflow-hidden",
                s.bg, s.border, s.border.replace('border-', 'ring-')
              )}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className={cx("flex items-center gap-2 text-[0.6rem] md:text-xs font-black uppercase tracking-[0.2em] mb-2 z-10", s.color)}>
                  <s.icon size={14} /> {s.label}
                </div>
                <span className="text-2xl md:text-3xl font-black text-white italic tracking-tighter tabular-nums group-hover/stat:translate-x-1 transition-transform z-10">
                  {s.value}
                </span>
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
              <div className="px-2.5 py-1 bg-white/5 rounded-full border border-white/5 text-[0.5rem] font-black text-neutral-500 tracking-widest uppercase">{t('profile.rankingUnavailable')}</div>
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

            </div>
        </div>

        {/* Right Column: Historical Overview */}
        <div className="lg:col-span-2 space-y-3 animate-fade-in-up delay-300">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">{t('profile.recentGames')}</h2>
          </div>

          <div className="space-y-2.5">
            {recentGames.map((g, i) => (
              <div key={i} className="bg-neutral-900/40 backdrop-blur-3xl border border-white/5 px-5 py-4 rounded-[1.75rem] flex items-center justify-between hover:bg-neutral-900/60 transition-all group/game shadow-xl ring-1 ring-white/5">
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
                      <div className="font-black text-base text-white tracking-tight italic group-hover/game:text-chess-active transition-colors flex items-center gap-2 underline decoration-white/5 group-hover/game:decoration-chess-active/30">
                        vs {g.opp}
                      </div>
                    </div>
                    <div className="text-[0.6rem] text-neutral-500 font-black uppercase tracking-widest ml-9 flex items-center gap-2">
                      <span className="text-neutral-400">{g.type}</span>
                      <div className="w-1 h-1 rounded-full bg-neutral-800" />
                      <span className="opacity-60">{g.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
