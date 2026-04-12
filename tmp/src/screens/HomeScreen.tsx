import { Link } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard';
import { Play, Grid, Trophy, MessageSquare, Activity, Users, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();

  const stats = [
    { label: t('home.stats.players'), value: '34,102', icon: Users, color: 'text-emerald-400' },
    { label: t('home.stats.activeMatches'), value: '12,450', icon: Activity, color: 'text-chess-active' },
    { label: t('home.stats.countries'), value: '3', icon: Globe, color: 'text-chess-gold' },
  ];

  return (
    <div className="flex flex-col h-full w-full px-4 md:px-8 overflow-hidden items-center justify-center bg-[#161512] transition-all relative">

      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-chess-active/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-chess-gold/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Macro 2-Column Layout */}
      <div className="w-full max-w-[85rem] flex flex-col xl:flex-row items-center justify-center gap-8 xl:gap-14 z-10 h-full py-4 max-h-[900px]">

        {/* LEFT COLUMN: Dominant Chessboard Anchor */}
        {/* DO NOT TOUCH CHESSBOARD SIZE, POSITION, OR ALIGNMENT */}
        <div className="hidden lg:flex flex-col items-center xl:items-end w-full xl:w-[48%] max-w-[500px] shrink-0 relative perspective-1000 mt-[5vh] xl:mt-0">
          <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,1)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 rotate-y-[12deg] rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] to-transparent pointer-events-none z-10" />
            <ChessBoard pieceTheme="classic" />
          </div>
          <div className="mt-5 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce-slow ring-1 ring-white/5 z-20 self-center xl:self-end xl:-mr-6">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center shrink-0">
              <span className="font-black text-[0.6rem] text-indigo-400 tracking-tighter">GM</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.7rem] font-black text-white italic tracking-wider">SiberianTiger</span>
              <span className="text-[0.5rem] font-bold text-neutral-500 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                Searching...
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Compact Dashboard + Stats + Features */}
        <div className="flex-1 w-full flex flex-col justify-start content-start max-w-2xl xl:max-w-[620px] gap-3.5 z-20 xl:-mt-2">
          
          {/* 1. Header & CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col items-start gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                <span className="text-[0.55rem] font-black text-neutral-400 uppercase tracking-[0.25em]">{t('home.platformDemo')}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-black text-white tracking-tighter leading-none transform-gpu">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-chess-gold via-white to-white">HubbyChat</span> CHESS
              </h1>
              <p className="text-[0.8rem] text-neutral-400 font-medium leading-relaxed max-w-xs">{t('home.subtitle')}</p>
            </div>
            
            <Link to="/play" className="group flex items-center justify-center gap-2.5 px-7 py-3.5 bg-chess-active text-black font-black text-base rounded-[1.25rem] shadow-[0_20px_50px_-15px_rgba(0,206,209,0.5)] hover:scale-105 hover:bg-cyan-300 transition-all active:scale-95 shrink-0 sm:self-end">
              <Play fill="currentColor" size={18} className="group-hover:rotate-12 transition-transform" />
              {t('home.playNow')}
            </Link>
          </div>

          {/* 2. Mini Stats */}
          <div className="flex items-center justify-between px-5 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 shadow-inner mt-1">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={cx("flex items-center gap-1.5 font-black text-[0.9rem]", s.color)}>
                  <s.icon size={13} />
                  {s.value}
                </div>
                <span className="text-[0.45rem] font-black text-neutral-500 uppercase tracking-widest mt-1">{s.label}</span>
              </div>
            ))}
          </div>

          {/* 3. Action Dashboard (2x2 Compact) */}
          <div className="grid grid-cols-2 gap-3 place-content-start mt-1">
            {/* Continue Last Game */}
            <Link to="/game" className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2.5 xl:p-3 rounded-[1.25rem] hover:bg-white/[0.06] hover:border-white/15 transition-all group shadow-md">
              <div className="w-10 h-10 rounded-[0.8rem] bg-chess-active/10 border border-chess-active/20 flex flex-col items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                <span className="text-[0.45rem] font-black text-chess-active uppercase tracking-widest leading-none mb-0.5">VS</span>
                <span className="text-[0.5rem] font-bold text-white">PRO</span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[0.55rem] font-black text-neutral-500 uppercase tracking-widest italic">{t('home.dashboard.continue')}</span>
                <span className="text-[0.75rem] font-black text-white truncate group-hover:text-chess-active transition-colors">{profile?.username || user?.user_metadata?.username || 'Guest'}</span>
              </div>
            </Link>

            {/* Last Analysis */}
            <Link to="/game" className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2.5 xl:p-3 rounded-[1.25rem] hover:bg-white/[0.06] hover:border-white/15 transition-all group shadow-md">
              <div className="w-10 h-10 rounded-[0.8rem] bg-chess-gold/10 border border-chess-gold/20 flex flex-col items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                <span className="text-[0.45rem] font-black text-chess-gold uppercase tracking-widest leading-none mb-0.5">EVAL</span>
                <span className="text-[0.5rem] font-bold text-white">+1.4</span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[0.55rem] font-black text-neutral-500 uppercase tracking-widest italic">{t('home.dashboard.analysis')}</span>
                <span className="text-[0.75rem] font-black text-white truncate group-hover:text-chess-gold transition-colors">Sicilian Defense</span>
              </div>
            </Link>

            {/* Community Activity */}
            <Link to="/chat" className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2.5 xl:p-3 rounded-[1.25rem] hover:bg-white/[0.06] hover:border-white/15 transition-all group shadow-md">
              <div className="w-10 h-10 rounded-[0.8rem] bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[0.55rem] font-black text-neutral-500 uppercase tracking-widest italic">{t('home.dashboard.community')}</span>
                <span className="text-[0.75rem] font-black text-white truncate group-hover:text-emerald-400 transition-colors">4 {t('play.friend')} Online</span>
              </div>
            </Link>

            {/* Daily Tournament */}
            <Link to="/play" className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2.5 xl:p-3 rounded-[1.25rem] hover:bg-white/[0.06] hover:border-white/15 transition-all group shadow-md">
              <div className="w-10 h-10 rounded-[0.8rem] bg-purple-500/10 border border-purple-500/20 flex flex-col items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                <span className="text-[0.45rem] font-black text-purple-400 uppercase tracking-widest leading-none mb-0.5">IN</span>
                <span className="text-[0.5rem] font-bold text-white">2H</span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[0.55rem] font-black text-neutral-500 uppercase tracking-widest italic">{t('home.dashboard.tournament')}</span>
                <span className="text-[0.75rem] font-black text-white truncate group-hover:text-purple-400 transition-colors">Global Arena Blitz</span>
              </div>
            </Link>
          </div>

          {/* 4. Feature Cards (2x2 Horizontal Layout for Density) */}
          <div className="grid grid-cols-2 gap-3 content-start">
            <FeatureCard
              to="/play" icon={<Play size={18} />} title={t('home.cards.play.title')}
              desc={t('home.cards.play.desc')} color="text-chess-active"
              bg="bg-chess-active/10" border="border-chess-active/20"
              accent="bg-chess-active/40"
            />
            <FeatureCard
              to="/game" icon={<Grid size={18} />} title={t('home.cards.game.title')}
              desc={t('home.cards.game.desc')} color="text-chess-gold"
              bg="bg-chess-gold/10" border="border-chess-gold/20"
              accent="bg-chess-gold/40"
            />
            <FeatureCard
              to="/profile" icon={<Trophy size={18} />} title={t('home.cards.profile.title')}
              desc={t('home.cards.profile.desc')} color="text-purple-400"
              bg="bg-purple-500/10" border="border-purple-500/20"
              accent="bg-purple-500/40"
            />
            <FeatureCard
              to="/chat" icon={<MessageSquare size={18} />} title={t('home.cards.chat.title')}
              desc={t('home.cards.chat.desc')} color="text-emerald-400"
              bg="bg-emerald-500/10" border="border-emerald-500/20"
              accent="bg-emerald-500/40"
            />
          </div>

        </div>

      </div>

    </div>
  );
}

function FeatureCard({
  to, icon, title, desc, color, bg, border, accent
}: {
  to: string, icon: React.ReactNode, title: string, desc: string, color: string, bg: string, border: string, accent: string
}) {
  return (
    <Link to={to} className={cx(
      "group relative flex items-center gap-3 bg-neutral-900/40 backdrop-blur-2xl rounded-[1.25rem] p-2.5 xl:p-3 border hover:bg-neutral-900/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden",
      border
    )}>
      {/* Card Decoration */}
      <div className={cx("absolute -top-4 -right-4 w-12 h-12 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-700", accent)} />

      <div className={cx(
        "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-lg ring-1 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3",
        bg, color, border.replace('border-', 'ring-')
      )}>
        {icon}
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0 z-10 relative pr-4">
        <h3 className="text-[0.85rem] font-black text-white italic tracking-tight truncate">{title}</h3>
        <p className="text-[0.65rem] text-neutral-500 font-bold leading-tight truncate group-hover:text-neutral-400 transition-colors">{desc}</p>
      </div>

      <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-500 absolute right-3 text-white z-20">
        <ChevronRight size={14} />
      </div>
    </Link>
  );
}

function ChevronRight({ size, className }: { size: number, className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
