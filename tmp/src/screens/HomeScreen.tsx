import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard';
import { Play, Trophy, Activity, Users, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function HomeScreen() {
  const { t } = useLanguage();
  useAuth();
  const { setBoardTheme } = useThemeContext();

  // Force Obsidian Night board on this screen
  useEffect(() => { setBoardTheme('Obsidian Gold'); }, []);

  const stats = [
    { label: t('home.stats.players'), value: '34,102', icon: Users, color: 'text-emerald-400' },
    { label: t('home.stats.activeMatches'), value: '12,450', icon: Activity, color: 'text-chess-active' },
    { label: t('home.stats.countries'), value: '3', icon: Globe, color: 'text-chess-gold' },
  ];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden items-center justify-center bg-[#161512] transition-all relative home-screen-root">
      <style>{`
        /* All pieces slightly larger on Home board */
        .home-board img {
          transform: scale(1.16);
        }
        /* Lighten black pieces on Home board — charcoal, not deep black */
        .home-board img[src$="bK.svg"],
        .home-board img[src$="bQ.svg"],
        .home-board img[src$="bR.svg"],
        .home-board img[src$="bB.svg"],
        .home-board img[src$="bN.svg"],
        .home-board img[src$="bP.svg"] {
          filter: brightness(2.5) drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        }
        @media (max-width: 1024px) {
          .board-container {
            max-width: 95vw !important;
            padding: 0 !important;
          }
          .board-perspective {
            transform: none !important;
            rotate: 0 !important;
          }
          /* Force Wood/Brown board theme colors on mobile */
          .bg-\\[\\#ebecd0\\] { background-color: #f0d9b5 !important; }
          .bg-\\[\\#779556\\] { background-color: #b58863 !important; }
          .bg-\\[\\#ececd1\\] { background-color: #f0d9b5 !important; }
          .bg-\\[\\#739552\\] { background-color: #b58863 !important; }
          .text-\\[0\\.55rem\\] {
            font-size: 0.5rem !important;
            opacity: 0.6 !important;
            font-weight: 800 !important;
          }
        }
      `}</style>

      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-8%] w-[600px] h-[600px] bg-chess-active/[0.03] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-8%] w-[600px] h-[600px] bg-chess-gold/[0.03] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[800px] h-[800px] bg-white/[0.006] blur-[200px] rounded-full pointer-events-none" />

      {/* 2-Column Layout */}
      <div className="w-full max-w-[85rem] flex flex-col xl:flex-row items-center justify-center gap-5 xl:gap-12 z-10 h-full px-2 sm:px-8 md:px-12 xl:px-16 py-2 xl:py-0 overflow-y-auto xl:overflow-visible">

        {/* LEFT: Chessboard */}
        <div className="flex flex-col items-center xl:items-end w-full xl:w-[57%] max-w-[660px] shrink-0 relative perspective-1000 board-container xl:-mt-8">
          <div className="relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,1)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 xl:rotate-y-[12deg] xl:rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0 board-perspective home-board">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] to-transparent pointer-events-none z-10" />
            <ChessBoard className="!border-none !p-1 md:!p-3" />
          </div>
        </div>

        {/* RIGHT: Premium Dashboard */}
        <div className="flex-1 w-full flex flex-col justify-center max-w-2xl xl:max-w-[420px] z-20 gap-4 mb-4 xl:mb-0">

          {/* 1. Hero Brand Header */}
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 self-start px-3 py-1 bg-chess-gold/[0.08] border border-chess-gold/[0.18] rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-chess-gold animate-pulse shadow-[0_0_6px_rgba(223,176,98,0.8)]" />
              <span className="text-[0.5rem] font-black text-chess-gold uppercase tracking-[0.35em]">
                {t('home.platformDemo')}
              </span>
            </div>

            <h1 className="text-[2.5rem] xl:text-[2.9rem] font-black text-white leading-[0.95] tracking-[-0.03em] italic">
              Chess<span className="text-chess-active"> Arena</span>
            </h1>

            <p className="text-[0.68rem] text-neutral-500 font-semibold leading-relaxed max-w-[320px]">
              {t('home.subtitle')}
            </p>
          </div>

          {/* 2. Premium Play Now CTA */}
          <Link
            to="/play"
            className="group relative flex items-center justify-between gap-4 px-5 py-3.5 bg-gradient-to-r from-chess-gold via-amber-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 text-black rounded-2xl shadow-[0_14px_40px_-8px_rgba(223,176,98,0.45)] hover:shadow-[0_18px_48px_-6px_rgba(223,176,98,0.65)] hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.99] transition-all duration-300 transform-gpu ring-1 ring-amber-300/20 overflow-hidden w-full"
          >
            {/* Shimmer sweep on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className="w-9 h-9 bg-black/[0.14] rounded-xl flex items-center justify-center shadow-inner flex-shrink-0">
                <Play fill="currentColor" size={15} className="group-hover:scale-110 transition-transform duration-200 ml-0.5" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="font-black text-[0.95rem] tracking-tight uppercase italic">{t('home.playNow')}</span>
                <span className="text-[0.5rem] font-black opacity-50 tracking-[0.22em] uppercase mt-0.5">Quick Match · Ranked</span>
              </div>
            </div>

            <div className="flex items-center gap-2 relative z-10 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300">
              <div className="h-5 w-px bg-black/20" />
              <ChevronRight size={17} />
            </div>
          </Link>

          {/* 3. Stat Blocks */}
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 px-2 py-3 bg-white/[0.025] backdrop-blur-md rounded-2xl border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08] transition-colors duration-300"
              >
                <div className={cx('flex items-center gap-1 font-black text-[0.85rem] tabular-nums leading-none', s.color)}>
                  <s.icon size={11} strokeWidth={2.5} />
                  {s.value}
                </div>
                <span className="text-[0.48rem] font-black text-neutral-600 uppercase tracking-[0.18em] text-center leading-tight">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* 4. Rating / Profile Card */}
          <FeatureCard
            to="/profile"
            icon={<Trophy size={16} />}
            title={t('home.cards.profile.title')}
            desc={t('home.cards.profile.desc')}
            color="text-chess-gold"
            bg="bg-chess-gold/[0.08]"
            border="border-chess-gold/[0.18]"
            accent="bg-chess-gold/30"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  to, icon, title, desc, color, bg, border, accent,
}: {
  to: string; icon: React.ReactNode; title: string; desc: string;
  color: string; bg: string; border: string; accent: string;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'group relative flex items-center gap-3 bg-white/[0.015] backdrop-blur-2xl rounded-2xl p-3.5 border hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-10px_rgba(0,0,0,0.7)] overflow-hidden',
        border,
      )}
    >
      <div className={cx('absolute -top-5 -right-5 w-14 h-14 blur-2xl rounded-full opacity-10 group-hover:opacity-25 transition-opacity duration-700', accent)} />

      <div
        className={cx(
          'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ring-1 transition-all duration-500 group-hover:scale-110',
          bg, color, border.replace('border-', 'ring-'),
        )}
      >
        {icon}
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0 z-10 relative pr-4">
        <h3 className="text-[0.8rem] font-black text-white tracking-tight truncate">{title}</h3>
        <p className="text-[0.6rem] text-neutral-600 font-semibold leading-tight truncate group-hover:text-neutral-400 transition-colors duration-300">
          {desc}
        </p>
      </div>

      <div className="opacity-0 group-hover:opacity-60 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-500 absolute right-3 text-white z-20">
        <ChevronRight size={12} />
      </div>
    </Link>
  );
}

function ChevronRight({ size, className }: { size: number; className?: string }) {
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
