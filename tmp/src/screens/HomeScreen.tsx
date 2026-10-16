import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import { Play, Trophy, Rewind, FastForward, ChevronLeft, ChevronRight as NextMove } from 'lucide-react';
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

  // User preferences applied automatically via ThemeContext

  return (
    <div className="flex flex-col min-h-full xl:h-full w-full xl:overflow-hidden items-center justify-start xl:justify-center bg-transparent transition-all relative home-screen-root">
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
          filter: brightness(3.0) drop-shadow(0 2px 4px rgba(0,0,0,0.4));
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
        @media (max-width: 767px) {
          .home-screen-root .board-container {
            max-width: calc(100vw - 8px) !important;
          }
          /* On mobile Home, render black pieces with their original SVG colors,
             exactly as on Analysis. Preserve the existing desktop filter. */
          .home-screen-root .home-board img[src$="bK.svg"],
          .home-screen-root .home-board img[src$="bQ.svg"],
          .home-screen-root .home-board img[src$="bR.svg"],
          .home-screen-root .home-board img[src$="bB.svg"],
          .home-screen-root .home-board img[src$="bN.svg"],
          .home-screen-root .home-board img[src$="bP.svg"] {
            filter: none;
          }
        }
      `}</style>

      {/* 2-Column Layout */}
      <div className="w-full max-w-[85rem] flex flex-col xl:flex-row items-center justify-center gap-5 xl:gap-12 z-10 h-full px-2 sm:px-8 md:px-12 xl:px-16 py-2 xl:py-0 overflow-y-auto xl:overflow-visible max-md:px-1 max-md:gap-3 max-md:justify-start">

        {/* LEFT: Chessboard */}
        <div className="flex flex-col items-center xl:items-end w-full xl:w-[57%] max-w-[320px] md:max-w-[600px] shrink-0 relative perspective-1000 board-container xl:-mt-12">
          <div className="relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] overflow-hidden shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 xl:rotate-y-[12deg] xl:rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0 board-perspective home-board home-board-frame max-md:hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] to-transparent pointer-events-none z-10" />
            <ChessBoard overrideBoardTheme="Classic Wood" className="!border-none !p-1 md:!p-3" />
          </div>
          <MobileHomeBoard />
        </div>

        {/* RIGHT: Premium Dashboard Container */}
        <div className="flex-1 w-full flex flex-col justify-center items-center xl:items-stretch max-w-2xl xl:max-w-[420px] z-20 gap-2 md:gap-4 mb-4 xl:mb-0 -mt-6 md:-mt-0 xl:-mt-10 xl:ml-8 max-md:order-first max-md:flex-none max-md:mt-0 max-md:mb-0 max-md:px-1">
          
          {/* Premium Flags Block */}
          <div className="flex items-center justify-center gap-2 md:gap-7 py-2 md:py-5 px-5 md:px-12 rounded-[1.5rem] md:rounded-[2.2rem] bg-[linear-gradient(135deg,rgba(6,182,212,0.10),rgba(7,15,17,0.98)_42%,rgba(7,15,17,0.98))] border-[2px] border-cyan-500/[0.34] transition-colors shadow-[0_0_12px_rgba(6,182,212,0.08)] self-center w-auto shrink-0 z-30 mb-0 md:mb-2 scale-[0.8] md:scale-100 max-md:hidden">
             <GermanyFlag />
             <AzerbaijanFlag />
             <TurkeyFlag />
          </div>

          {/* Premium Dashboard Card */}
          <div className="mobile-home-arena w-full flex flex-col justify-center gap-2 md:gap-4 bg-[#121212]/98 p-3 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border-[2px] border-cyan-500/[0.18] border-b-[4px] border-b-cyan-500/[0.11] transition-colors relative shadow-[0_16px_34px_-18px_rgba(0,0,0,0.75)]">


          {/* 1. Hero Brand Header */}
          <div className="flex flex-col">
            <h1 className="text-[2.2rem] md:text-[2.5rem] xl:text-[2.9rem] font-black text-glow-cycle leading-[0.95] tracking-[-0.03em] italic">
              Chess<span className="text-chess-active"> Arena</span>
            </h1>
          </div>

          {/* 2. Premium Play Now CTA */}
          <Link
            to="/play"
            className="mobile-home-play group relative flex items-center justify-between gap-4 px-5 py-3.5 btn-glow-cycle border border-white/20 text-black rounded-2xl hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.99] transition-all duration-200 transform-gpu overflow-hidden w-full"
          >
            {/* Shimmer sweep on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className="w-9 h-9 bg-black/[0.14] rounded-xl flex items-center justify-center shadow-inner flex-shrink-0">
                <Play fill="currentColor" size={15} className="group-hover:scale-110 transition-transform duration-200 ml-0.5" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="font-black text-[0.95rem] tracking-tight uppercase italic text-shadow-cycle">{t('home.playNow')}</span>
                <span className="text-[0.5rem] font-black opacity-50 tracking-[0.22em] uppercase mt-0.5">{t('home.playNow.subtitle')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 relative z-10 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300">
              <div className="h-5 w-px bg-black/20" />
              <ChevronRight size={17} />
            </div>
          </Link>

          {/* 3. Rating / Profile Card */}
          <div className="hidden md:block">
            <FeatureCard
              to="/profile"
              icon={<Trophy size={16} />}
              title={t('home.cards.profile.title')}
              desc={t('home.cards.profile.desc')}
              color="text-chess-gold"
              bg="bg-chess-gold/[0.08]"
              border="border-chess-gold/[0.18]"
            />
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// The desktop board keeps its existing independent behaviour.
function MobileHomeBoard() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [review, setReview] = useState<{ moves: string[]; index: number }>({ moves: [], index: 0 });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const game = useMemo(() => {
    const position = new Chess();
    for (const move of review.moves.slice(0, review.index)) position.move(move);
    return position;
  }, [review]);

  const onMove = (from: string, to: string, promotion = 'q') => {
    const next = new Chess();
    const moves = review.moves.slice(0, review.index);
    for (const move of moves) next.move(move);
    try {
      const move = next.move({ from, to, promotion });
      setReview({ moves: [...moves, move.san], index: moves.length + 1 });
      return true;
    } catch {
      return false;
    }
  };

  if (!isMobile) return null;

  const controlClass = 'min-h-11 flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] text-neutral-200 shadow-sm transition-[color,background-color,transform] duration-150 hover:bg-cyan-500/10 hover:text-cyan-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60';
  const atStart = review.index === 0;
  const atEnd = review.index === review.moves.length;
  const goTo = (index: number) => setReview(current => ({ ...current, index }));

  return (
    <div className="md:hidden w-full min-w-0 space-y-2">
      <div className="home-board w-full aspect-square overflow-hidden rounded-lg ring-1 ring-white/10 shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)]">
        <ChessBoard game={game} onMove={onMove} overrideBoardTheme="Classic Wood" className="!border-none !p-0" />
      </div>
      <nav aria-label="Move navigation" className="grid grid-cols-4 gap-2 p-1 rounded-2xl border border-white/[0.06] bg-black/20">
        <button type="button" aria-label="First position" title="First position" className={controlClass} disabled={atStart} onClick={() => goTo(0)}><Rewind size={22} /></button>
        <button type="button" aria-label="Previous move" title="Previous move" className={controlClass} disabled={atStart} onClick={() => goTo(review.index - 1)}><ChevronLeft size={24} /></button>
        <button type="button" aria-label="Next move" title="Next move" className={controlClass} disabled={atEnd} onClick={() => goTo(review.index + 1)}><NextMove size={24} /></button>
        <button type="button" aria-label="Last position" title="Last position" className={controlClass} disabled={atEnd} onClick={() => goTo(review.moves.length)}><FastForward size={22} /></button>
      </nav>
    </div>
  );
}

function FeatureCard({
  to, icon, title, desc, color, bg, border,
}: {
  to: string; icon: React.ReactNode; title: string; desc: string;
  color: string; bg: string; border: string;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'group relative flex items-center gap-3 bg-white/[0.025] rounded-2xl p-3.5 border hover:bg-white/[0.05] transition-colors duration-150 active:scale-95 overflow-hidden',
        border,
      )}
    >
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

function GermanyFlag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="62" height="44" viewBox="0 0 5 3" className="rounded-md shrink-0 ring-1 ring-white/10 shadow-lg premium-flag-glow premium-flag-1 transition-all duration-500">
      <rect width="5" height="3" y="0" x="0" fill="#000"/>
      <rect width="5" height="2" y="1" x="0" fill="#D00"/>
      <rect width="5" height="1" y="2" x="0" fill="#FFCE00"/>
    </svg>
  );
}

function TurkeyFlag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="62" height="44" viewBox="0 0 1200 800" className="rounded-md shrink-0 ring-1 ring-white/10 shadow-lg premium-flag-glow premium-flag-2 transition-all duration-500">
      <rect width="1200" height="800" fill="#E30A17"/>
      <circle cx="425" cy="400" r="200" fill="#fff"/>
      <circle cx="475" cy="400" r="160" fill="#E30A17"/>
      <polygon points="709.84,203.21 644.39,404.54 815.82,279.99 603.86,279.99 775.29,404.54" fill="#fff"/>
    </svg>
  );
}

function AzerbaijanFlag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="62" height="44" viewBox="0 0 1200 600" className="rounded-md shrink-0 ring-1 ring-white/10 shadow-lg premium-flag-glow premium-flag-3 transition-all duration-500">
      <rect width="1200" height="200" fill="#00b5e2"/>
      <rect width="1200" height="200" y="200" fill="#ef3340"/>
      <rect width="1200" height="200" y="400" fill="#509e2f"/>
      <circle cx="560" cy="300" r="75" fill="#fff"/>
      <circle cx="585" cy="300" r="60" fill="#ef3340"/>
      <path fill="#fff" d="M660,260 L665,285 L690,280 L675,300 L690,320 L665,315 L660,340 L650,315 L625,320 L640,300 L625,280 L650,285 Z" />
    </svg>
  );
}


