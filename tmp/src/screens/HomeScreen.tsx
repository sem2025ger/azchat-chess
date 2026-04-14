import { Link } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard';
import { Play, Trophy, Activity, Users, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function HomeScreen() {
  const { t } = useLanguage();
  useAuth();

  const stats = [
    { label: t('home.stats.players'), value: '34,102', icon: Users, color: 'text-emerald-400' },
    { label: t('home.stats.activeMatches'), value: '12,450', icon: Activity, color: 'text-chess-active' },
    { label: t('home.stats.countries'), value: '3', icon: Globe, color: 'text-chess-gold' },
  ];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden items-center justify-center bg-[#161512] transition-all relative home-screen-root">
      {/* 
        Mobile Board Overrides
        Hiding the layout header and forcing wood/brown theme colors only on mobile Home.
      */}
      <style>{`
        @media (max-width: 1024px) {
          /* Hide global header controls */
          header.shrink-0 { 
            display: none !important; 
          }
          /* Enlarge board container and remove perspective on mobile */
          .board-container {
            max-width: 95vw !important;
            padding: 0 !important;
          }
          .board-perspective {
            transform: none !important;
            rotate: 0 !important;
          }
          /* Force Wood/Brown Board Theme Colors */
          .bg-\\[\\#ebecd0\\] { background-color: #f0d9b5 !important; } /* light Green -> light Brown */
          .bg-\\[\\#779556\\] { background-color: #b58863 !important; } /* dark Green -> dark Brown */
          .bg-\\[\\#ececd1\\] { background-color: #f0d9b5 !important; } /* light Tournament -> light Brown */
          .bg-\\[\\#739552\\] { background-color: #b58863 !important; } /* dark Tournament -> dark Brown */
          
          /* Refined Coordinates */
          .text-\\[0\\.55rem\\] { 
            font-size: 0.5rem !important; 
            opacity: 0.6 !important; 
            font-weight: 800 !important;
          }
        }
      `}</style>

      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-8%] w-[600px] h-[600px] bg-chess-active/[0.03] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-8%] w-[600px] h-[600px] bg-chess-gold/[0.03] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[800px] h-[800px] bg-white/[0.006] blur-[200px] rounded-full pointer-events-none" />

      {/* Macro 2-Column Layout - Vertical stack on mobile/tablet, Row on XL */}
      <div className="w-full max-w-[85rem] flex flex-col xl:flex-row items-center justify-center gap-6 xl:gap-14 z-10 h-full px-2 sm:px-8 md:px-12 xl:px-16 py-4 xl:py-4 max-h-none xl:max-h-[900px] overflow-y-auto xl:overflow-visible">

        {/* LEFT COLUMN: Dominant Chessboard Anchor */}
        <div className="flex flex-col items-center xl:items-end w-full xl:w-[55%] max-w-[590px] shrink-0 relative perspective-1000 mt-2 xl:mt-0 board-container">
          <div className="relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,1)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 xl:rotate-y-[12deg] xl:rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0 board-perspective">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] to-transparent pointer-events-none z-10" />
            <ChessBoard className="!border-none !p-1 md:!p-3" />
          </div>
        </div>

        {/* RIGHT COLUMN: Dashboard */}
        <div className="flex-1 w-full flex flex-col justify-start content-start max-w-2xl xl:max-w-[500px] z-20 xl:-mt-24 gap-6 mb-4 xl:mb-0">

          {/* 1. Main CTA */}
          <div className="flex flex-col gap-4">
            <Link to="/play" className="group flex items-center justify-center gap-2.5 px-8 py-4 bg-chess-active text-black font-black text-[1rem] rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,206,209,0.5)] hover:scale-[1.03] hover:bg-cyan-300 transition-all duration-300 active:scale-95 w-full sm:w-auto sm:self-start transform-gpu">
              <Play fill="currentColor" size={20} className="group-hover:rotate-12 transition-transform" />
              {t('home.playNow')}
            </Link>
          </div>

          {/* 2. Mini Stats */}
          <div className="flex items-center justify-between px-6 py-3.5 bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/[0.06] shadow-xl">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className={cx("flex items-center gap-1.5 font-black text-[0.95rem] tabular-nums", s.color)}>
                  <s.icon size={14} strokeWidth={2.5} />
                  {s.value}
                </div>
                <span className="text-[0.55rem] font-bold text-neutral-600 uppercase tracking-[0.2em]">{s.label}</span>
              </div>
            ))}
          </div>

          {/* 3. Rating Card (Profile) */}
          <div className="w-full">
            <FeatureCard
              to="/profile" 
              icon={<Trophy size={18} />} 
              title="Рейтинг и Профиль"
              desc="Ваши достижения и статистика" 
              color="text-purple-400"
              bg="bg-purple-500/10" 
              border="border-purple-500/20"
              accent="bg-purple-500/40"
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
      "group relative flex items-center gap-3 bg-white/[0.015] backdrop-blur-2xl rounded-2xl p-3 border hover:bg-white/[0.045] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden",
      border
    )}>
      {/* Card Decoration */}
      <div className={cx("absolute -top-6 -right-6 w-16 h-16 blur-3xl rounded-full opacity-10 group-hover:opacity-30 transition-opacity duration-700", accent)} />

      <div className={cx(
        "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ring-1 transition-all duration-500 group-hover:scale-110",
        bg, color, border.replace('border-', 'ring-')
      )}>
        {icon}
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0 z-10 relative pr-5">
        <h3 className="text-[0.82rem] font-black text-white tracking-tight truncate">{title}</h3>
        <p className="text-[0.62rem] text-neutral-600 font-semibold leading-tight truncate group-hover:text-neutral-400 transition-colors duration-300">{desc}</p>
      </div>

      <div className="opacity-0 group-hover:opacity-60 group-hover:translate-x-0 -translate-x-2 transition-all duration-500 absolute right-3 text-white z-20">
        <ChevronRight size={13} />
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