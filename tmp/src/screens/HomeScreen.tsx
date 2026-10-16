import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import { Rewind, FastForward, ChevronLeft, ChevronRight as NextMove } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

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
        .home-board img[src^="/pieces/mobile/neo/"],
        .home-board img[src^="/pieces/mobile/tournament/"] {
          filter: none;
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
        /* Desktop-only Arena redesign: Dark Luxury graphite + Premium Gold. */
        @media (min-width: 1280px) {
          .home-screen-root .desktop-home-slogan {
            width: min(100%, 388px);
            min-height: 98px;
            padding: 24px 32px;
            border-radius: 9999px;
            border: 1px solid rgba(217, 182, 110, 0.38);
            background:
              radial-gradient(ellipse at 50% 0%, rgba(217, 182, 110, 0.1), transparent 65%),
              radial-gradient(ellipse at 85% 100%, rgba(139, 92, 246, 0.06), transparent 65%),
              linear-gradient(145deg, #111419 0%, #16181f 54%, #1B1B22 100%);
            box-shadow:
              0 18px 36px -18px rgba(0, 0, 0, 0.85),
              0 0 16px rgba(184, 138, 67, 0.08),
              inset 0 1px 0 rgba(244, 220, 156, 0.14),
              inset 0 -1px 0 rgba(0, 0, 0, 0.45);
          }
          .home-screen-root .desktop-home-slogan > svg {
            display: none;
          }
          .home-screen-root .desktop-home-slogan-text {
            display: block;
            width: 100%;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: clamp(1.02rem, 1.15vw, 1.15rem);
            font-weight: 600;
            letter-spacing: 0.045em;
            line-height: 1.2;
            color: #EAD29A;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
          }
          .home-screen-root .desktop-home-arena {
            width: calc(100% + 12px);
            margin-inline: -6px;
            min-height: 242px;
            padding: 30px 28px;
            gap: 24px;
            border: 1px solid rgba(217, 182, 110, 0.36);
            background:
              radial-gradient(ellipse at 18% 0%, rgba(217, 182, 110, 0.09), transparent 58%),
              radial-gradient(ellipse at 92% 100%, rgba(139, 92, 246, 0.07), transparent 62%),
              linear-gradient(145deg, #111419 0%, #16181f 54%, #1B1B22 100%);
            box-shadow:
              0 24px 48px -22px rgba(0, 0, 0, 0.88),
              0 0 18px rgba(184, 138, 67, 0.08),
              inset 0 1px 0 rgba(244, 220, 156, 0.14),
              inset 0 0 24px rgba(184, 138, 67, 0.04);
            transition: border-color 280ms ease, box-shadow 280ms ease;
          }
          .home-screen-root .desktop-home-arena::before {
            border-color: rgba(217, 182, 110, 0.32);
            box-shadow: inset 0 0 14px rgba(217, 182, 110, 0.05), 0 0 10px rgba(184, 138, 67, 0.08);
          }
          .home-screen-root .desktop-home-arena::after {
            border-color: rgba(184, 138, 67, 0.2);
            box-shadow: inset 0 0 16px rgba(139, 92, 246, 0.04);
          }
          .home-screen-root .desktop-home-arena h1 {
            font-size: clamp(2.65rem, 3.3vw, 3.15rem);
            line-height: 1.08;
            background-image: linear-gradient(
              110deg,
              #B8863B 0%,
              #D4A552 22%,
              #F5DFA7 48%,
              #D4A552 74%,
              #F0D18C 90%,
              #B8863B 100%
            );
            background-size: 220% 100%;
            background-position: 0% 50%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            text-shadow: none;
          }
          .home-screen-root .desktop-home-arena h1 .text-chess-active {
            color: inherit;
            -webkit-text-fill-color: transparent;
          }
          .home-screen-root .desktop-home-play {
            width: 100%;
            min-height: 62px;
            border: 1px solid rgba(217, 182, 110, 0.4);
            background: linear-gradient(135deg, #171B22 0%, #1D1D26 52%, #23202A 100%);
            color: #F1D9A1;
            box-shadow:
              0 12px 26px -14px rgba(0, 0, 0, 0.85),
              0 0 14px rgba(184, 138, 67, 0.08),
              inset 0 1px 0 rgba(244, 220, 156, 0.16),
              inset 0 -1px 0 rgba(0, 0, 0, 0.45);
            transition:
              transform 200ms ease,
              border-color 220ms ease,
              background 220ms ease,
              box-shadow 220ms ease;
          }
          .home-screen-root .desktop-home-play::before,
          .home-screen-root .desktop-home-play::after {
            content: none;
            animation: none;
            opacity: 0;
          }
          .home-screen-root .desktop-home-play .text-shadow-cycle {
            color: #F1D9A1;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
            transition: color 220ms ease, text-shadow 220ms ease;
          }
          .home-screen-root .desktop-home-play:hover {
            transform: translateY(-2px);
            border-color: rgba(244, 220, 156, 0.62);
            background: linear-gradient(135deg, #1D222B 0%, #24232E 52%, #2B2733 100%);
            box-shadow:
              0 16px 32px -14px rgba(0, 0, 0, 0.9),
              0 0 20px rgba(217, 182, 110, 0.18),
              inset 0 1px 0 rgba(244, 220, 156, 0.24),
              inset 0 -1px 0 rgba(0, 0, 0, 0.45);
          }
          .home-screen-root .desktop-home-play:hover .text-shadow-cycle {
            color: #F7E5B7;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75), 0 0 12px rgba(217, 182, 110, 0.22);
          }
          .home-screen-root .desktop-home-play:active {
            transform: translateY(0) scale(0.99);
            border-color: rgba(217, 182, 110, 0.48);
            box-shadow:
              0 8px 18px -12px rgba(0, 0, 0, 0.85),
              0 0 12px rgba(217, 182, 110, 0.12),
              inset 0 2px 4px rgba(0, 0, 0, 0.45);
          }
          .home-screen-root .desktop-home-play:focus-visible {
            outline: 2px solid #D9B66E;
            outline-offset: 3px;
          }
        }
        @media (min-width: 1280px) and (prefers-reduced-motion: no-preference) {
          .home-screen-root .desktop-home-arena h1 {
            animation: desktopArenaGoldShimmer 8.5s ease-in-out infinite alternate;
          }
          @keyframes desktopArenaGoldShimmer {
            0% {
              background-position: 0% 50%;
            }
            100% {
              background-position: 100% 50%;
            }
          }
        }
        @media (min-width: 1280px) and (prefers-reduced-motion: reduce) {
          .home-screen-root .desktop-home-arena,
          .home-screen-root .desktop-home-play,
          .home-screen-root .desktop-home-play .text-shadow-cycle {
            transition: none;
          }
          .home-screen-root .desktop-home-arena h1 {
            animation: none;
            background-position: 35% 50%;
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
          
          {/* Premium Flags / Desktop Slogan Block */}
          <div className="desktop-home-slogan flex items-center justify-center gap-2 md:gap-7 py-2 md:py-5 px-5 md:px-12 rounded-[1.5rem] md:rounded-[2.2rem] bg-[linear-gradient(135deg,rgba(6,182,212,0.10),rgba(7,15,17,0.98)_42%,rgba(7,15,17,0.98))] border-[2px] border-cyan-500/[0.34] transition-colors shadow-[0_0_12px_rgba(6,182,212,0.08)] self-center w-auto shrink-0 z-30 mb-0 md:mb-2 scale-[0.8] md:scale-100 max-md:hidden">
             <GermanyFlag />
             <AzerbaijanFlag />
             <TurkeyFlag />
             <span className="desktop-home-slogan-text hidden">{t('home.slogan')}</span>
          </div>

          {/* Premium Dashboard Card */}
          <div className="mobile-home-arena desktop-home-arena w-full flex flex-col justify-center gap-2 md:gap-4 bg-[#121212]/98 p-3 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border-[2px] border-cyan-500/[0.18] border-b-[4px] border-b-cyan-500/[0.11] transition-colors relative shadow-[0_16px_34px_-18px_rgba(0,0,0,0.75)]">


          {/* 1. Hero Brand Header */}
          <div className="flex flex-col">
            <h1 className="text-[2.2rem] md:text-[2.5rem] xl:text-[2.9rem] font-black text-glow-cycle leading-[0.95] tracking-[-0.03em] italic">
              Chess<span className="text-chess-active"> Arena</span>
            </h1>
          </div>

          {/* Text-only play action, shared with the mobile Arena. */}
          <Link
            to="/play"
            className="mobile-home-play desktop-home-play group relative flex items-center justify-center gap-0 px-4 py-2.5 md:py-3 min-h-[52px] md:min-h-[56px] btn-glow-cycle border border-white/20 text-black rounded-[0.875rem] md:rounded-2xl hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.99] transition-all duration-200 transform-gpu overflow-hidden w-[94%] self-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
            <span className="relative z-10 w-full text-center font-extrabold text-[clamp(1rem,4.6vw,1.125rem)] tracking-[0.05em] uppercase not-italic leading-tight text-shadow-cycle">{t('home.playChessNow')}</span>
          </Link>
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



