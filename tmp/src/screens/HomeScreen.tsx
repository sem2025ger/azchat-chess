import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { t } = useLanguage();
  useAuth();

  // Use the same replay state for desktop and mobile Home boards.
  const [review, setReview] = useState<HomeBoardReview>({ moves: [], index: 0 });
  const homeGame = useMemo(() => {
    const position = new Chess();
    for (const move of review.moves.slice(0, review.index)) position.move(move);
    return position;
  }, [review]);

  const handleHomeMove = (from: string, to: string, promotion = 'q') => {
    const next = new Chess();
    const moves = review.moves.slice(0, review.index);
    for (const move of moves) next.move(move);
    try {
      const move = next.move({ from, to, promotion });
      if (!move) return false;
      setReview({ moves: [...moves, move.san], index: moves.length + 1 });
      return true;
    } catch {
      return false;
    }
  };

  const goToHomeMove = (index: number) =>
    setReview(current => ({
      ...current,
      index: Math.min(current.moves.length, Math.max(0, index)),
    }));

  // User preferences applied automatically via ThemeContext

  return (
    <div className="flex flex-col min-h-full xl:h-full w-full xl:overflow-hidden items-center justify-start xl:justify-center bg-transparent transition-all relative home-screen-root">
      <style>{`
        /* Keep the existing mobile Home piece scaling; match Analysis on desktop. */
        @media (max-width: 767px) {
          .home-board img {
            transform: scale(1.16);
          }
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
            width: min(100%, 420px);
            min-height: 98px;
            padding: 24px 22px;
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
            /* Larger single-line Roman serif, inspired by the owner's golden reference. */
            font-family: Georgia, 'Times New Roman', serif;
            font-size: clamp(1.36rem, 1.7vw, 1.57rem);
            font-style: normal;
            font-weight: 500;
            letter-spacing: -0.014em;
            line-height: 1.2;
            color: #E7C47F;
            text-shadow: 0 1px 1px rgba(0, 0, 0, 0.95), 0 0 8px rgba(173, 118, 46, 0.14);
          }
          .home-screen-root .desktop-home-arena {
            width: calc(100% + 12px);
            margin-inline: -6px;
            min-height: 242px;
            padding: 30px 28px;
            gap: 24px;
            border: 1px solid rgba(200, 157, 89, 0.58);
            /* Fine, translucent mineral grain over the approved obsidian palette.
               Keep the underlying colors and shape unchanged; desktop only. */
            background:
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.73' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.72 0 0 0 0 0.61 0 0 0 0 0.47 0.18 0 0 0 -0.055'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23grain)'/%3E%3C/svg%3E") center / 180px 180px repeat,
              radial-gradient(ellipse at 22% 6%, rgba(119, 78, 31, 0.14), transparent 63%),
              radial-gradient(ellipse at 86% 90%, rgba(92, 56, 24, 0.09), transparent 60%),
              repeating-linear-gradient(132deg, rgba(220, 180, 113, 0.009) 0px, transparent 2px, transparent 7px),
              linear-gradient(138deg, #080807 0%, #14110E 38%, #110F0D 68%, #070706 100%);
            box-shadow:
              0 24px 48px -22px rgba(0, 0, 0, 0.88),
              0 0 14px rgba(168, 113, 49, 0.11),
              inset 0 1px 0 rgba(222, 186, 117, 0.14),
              inset 0 -18px 38px rgba(0, 0, 0, 0.42);
            transition: border-color 280ms ease, box-shadow 280ms ease;
          }
          .home-screen-root .desktop-home-arena::before {
            border-color: rgba(209, 168, 96, 0.34);
            box-shadow: inset 0 0 14px rgba(193, 144, 65, 0.035), 0 0 10px rgba(160, 108, 46, 0.07);
          }
          .home-screen-root .desktop-home-arena::after {
            border-color: rgba(194, 147, 72, 0.2);
            box-shadow: inset 0 0 18px rgba(168, 109, 42, 0.04);
          }
          .home-screen-root .desktop-home-arena h1 {
            /* Center the wordmark within the rounded Arena card and optically lift it. */
            width: 100%;
            margin: 0;
            text-align: center;
            white-space: nowrap;
            position: relative;
            top: -3px;
            font-size: clamp(2.65rem, 3.3vw, 3.15rem);
            line-height: 1.08;
            /* Reference-inspired classical upright Roman serif lettering. */
            font-family: Georgia, 'Times New Roman', serif;
            font-style: normal;
            font-weight: 700;
            letter-spacing: -0.045em;
            -webkit-text-stroke: 0.35px rgba(116, 68, 21, 0.46);
            filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.85)) drop-shadow(0 -1px 0 rgba(255, 222, 146, 0.13));
            background-image: linear-gradient(
              180deg,
              #FFF1BA 0%,
              #F0D38E 26%,
              #CD923D 57%,
              #F3CE79 77%,
              #A46A29 100%
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
            font-family: inherit;
            font-style: inherit;
            font-weight: inherit;
            letter-spacing: inherit;
            color: inherit;
            -webkit-text-fill-color: transparent;
          }
          .home-screen-root .desktop-home-play {
            width: 65%;
            min-height: 55px;
            padding: 10px 8px;
            border: 1px solid #C9A45F;
            background: linear-gradient(115deg, #B88A45 0%, #E4C782 42%, #DABC78 58%, #C9A45F 100%);
            color: #15171C;
            box-shadow:
              0 9px 20px -12px rgba(0, 0, 0, 0.75),
              inset 0 1px 0 rgba(255, 244, 211, 0.5),
              inset 0 -1px 0 rgba(103, 73, 30, 0.22);
            transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
          }
          .home-screen-root .desktop-home-play > div {
            display: none;
          }
          .home-screen-root .desktop-home-play::before,
          .home-screen-root .desktop-home-play::after {
            content: none;
            animation: none;
            opacity: 0;
          }
          .home-screen-root .desktop-home-play::after {
            /* Full-surface color crossfade; no moving streak, scale or positional animation. */
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 1;
            background: linear-gradient(145deg, #1B1713 0%, #332618 32%, #67461F 61%, #211911 100%);
            opacity: 0;
          }
          .home-screen-root .desktop-home-play .text-shadow-cycle {
            color: #15171C;
            font-size: clamp(0.75rem, 0.9vw, 0.875rem);
            letter-spacing: 0.025em;
            white-space: nowrap;
            text-shadow: none;
          }
          .home-screen-root .desktop-home-play:hover {
            transform: translateY(-2px);
            border-color: #E4C782;
            box-shadow:
              0 12px 24px -12px rgba(0, 0, 0, 0.8),
              inset 0 1px 0 rgba(255, 244, 211, 0.65),
              inset 0 -1px 0 rgba(103, 73, 30, 0.22);
          }
          .home-screen-root .desktop-home-play:active {
            transform: translateY(0) scale(0.99);
            border-color: #B88A45;
            box-shadow: 0 4px 10px -8px rgba(0, 0, 0, 0.75), inset 0 2px 4px rgba(103, 73, 30, 0.2);
          }
          .home-screen-root .desktop-home-play:focus-visible {
            outline: 2px solid #E4C782;
            outline-offset: 4px;
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
          .home-screen-root .desktop-home-play::after {
            animation: desktopArenaMetalColorBlend 9s ease-in-out infinite;
          }
          .home-screen-root .desktop-home-play .text-shadow-cycle {
            animation: desktopArenaMetalLabelBlend 9s ease-in-out infinite;
          }
          @keyframes desktopArenaMetalColorBlend {
            0%, 100% { opacity: 0; }
            45%, 55% { opacity: 0.97; }
          }
          @keyframes desktopArenaMetalLabelBlend {
            0%, 100% {
              color: #15171C;
              text-shadow: none;
            }
            45%, 55% {
              color: #F8DEAB;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
            }
          }
        }
        @media (min-width: 1280px) and (prefers-reduced-motion: reduce) {
          .home-screen-root .desktop-home-arena,
          .home-screen-root .desktop-home-play,
          .home-screen-root .desktop-home-play .text-shadow-cycle,
          .home-screen-root .desktop-home-play::after {
            transition: none;
          }
          .home-screen-root .desktop-home-play::after,
          .home-screen-root .desktop-home-play .text-shadow-cycle {
            animation: none;
          }
          .home-screen-root .desktop-home-play::after {
            opacity: 0;
          }
          .home-screen-root .desktop-home-play:hover,
          .home-screen-root .desktop-home-play:active {
            transform: none;
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
      <div className="w-full max-w-[85rem] flex flex-col xl:flex-row items-center justify-center gap-5 xl:gap-6 z-10 h-full px-2 sm:px-8 md:px-12 xl:px-7 py-2 xl:py-0 overflow-y-auto xl:overflow-visible max-md:px-1 max-md:gap-3 max-md:justify-start">

        {/* LEFT: Chessboard */}
        <div className="flex flex-col items-center xl:items-end w-full xl:w-[60%] max-w-[320px] md:max-w-[600px] xl:max-w-[min(630px,calc(100dvh-120px))] shrink-0 relative perspective-1000 board-container xl:-mt-12">
          <div className="relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] overflow-hidden shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 xl:rotate-y-[12deg] xl:rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0 board-perspective home-board home-board-frame max-md:hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] to-transparent pointer-events-none z-10" />
            <ChessBoard game={homeGame} onMove={handleHomeMove} overrideBoardTheme="Classic Wood" className="!border-none !p-1 md:!p-3" />
          </div>
          <HomeMoveControls review={review} goTo={goToHomeMove} className="hidden md:grid mt-3" />
          <MobileHomeBoard game={homeGame} onMove={handleHomeMove} review={review} goTo={goToHomeMove} />
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
          <div className="mobile-home-arena desktop-home-arena w-full flex flex-col justify-center gap-2 max-md:gap-0 md:gap-4 bg-[#121212]/98 p-3 max-md:py-5 max-md:px-4 md:p-6 rounded-[2rem] max-md:rounded-[1.75rem] md:rounded-[2.5rem] border-[2px] border-cyan-500/[0.18] border-b-[4px] border-b-cyan-500/[0.11] transition-colors relative shadow-[0_16px_34px_-18px_rgba(0,0,0,0.75)]">


          {/* 1. Hero Brand Header */}
          <div className="flex flex-col">
            <h1 className="text-[2.2rem] max-md:text-center md:text-[2.5rem] xl:text-[2.9rem] font-black text-glow-cycle leading-[0.95] tracking-[-0.03em] italic">
              Chess<span className="text-chess-active"> Arena</span>
            </h1>
          </div>

          {/* Text-only play action, shared with the mobile Arena. */}
          <Link
            to="/play"
            className="hidden md:flex mobile-home-play desktop-home-play group relative items-center justify-center gap-0 px-4 py-2.5 md:py-3 min-h-[44px] md:min-h-[56px] btn-glow-cycle border border-white/20 text-black rounded-[0.875rem] md:rounded-2xl hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.99] transition-all duration-200 transform-gpu overflow-hidden w-[72%] md:w-[94%] self-center"
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

type HomeBoardReview = { moves: string[]; index: number };

function HomeMoveControls({
  review,
  goTo,
  className,
  compactMobile = false,
}: {
  review: HomeBoardReview;
  goTo: (index: number) => void;
  className: string;
  compactMobile?: boolean;
}) {
  const { t } = useLanguage();
  const premiumButtonClass =
    'group flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#CDA35A]/60 ' +
    'bg-[linear-gradient(135deg,#42321E_0%,#201B15_48%,#352818_100%)] px-3 py-2 ' +
    'text-[0.8125rem] font-extrabold tracking-[0.055em] text-[#F4D69A] ' +
    'shadow-[inset_0_1px_0_rgba(255,227,161,0.23),0_6px_18px_rgba(0,0,0,0.37)] ' +
    'transition-[border-color,box-shadow,color,filter] duration-150 ' +
    'hover:border-[#F8D791] hover:text-[#FFF2D5] hover:shadow-[inset_0_1px_0_rgba(255,227,161,0.3),0_0_18px_rgba(205,163,90,0.24)] ' +
    'active:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:shadow-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F8D791]';

  return (
    <nav aria-label={t('home.board.moveNavigation')} className={`w-full px-1 ${compactMobile ? 'grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_minmax(0,0.8fr)] gap-2' : 'grid-cols-2 gap-2.5'} ${className}`}>
      <button
        type="button"
        className={compactMobile ? `${premiumButtonClass} !min-h-11 !px-1 !gap-0` : premiumButtonClass}
        aria-label={t('home.board.previousMove')}
        title={t('home.board.previousMove')}
        onClick={() => goTo(review.index - 1)}
        disabled={review.index === 0}
      >
        <ChevronLeft size={21} strokeWidth={2.5} aria-hidden="true" />
        <span className={compactMobile ? 'sr-only' : undefined}>{t('home.board.previousMove')}</span>
      </button>
      {compactMobile && (
        <Link
          to="/play"
          className="mobile-home-play group relative flex min-h-11 min-w-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 btn-glow-cycle px-2 py-2 text-black shadow-[0_8px_18px_-10px_rgba(0,0,0,0.45)] transition-[transform,box-shadow] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80"
        >
          <span className="relative z-10 w-full text-center font-extrabold text-[clamp(0.64rem,2.7vw,0.79rem)] leading-tight tracking-[0.01em] uppercase text-shadow-cycle">
            {t('home.playChessNow')}
          </span>
        </Link>
      )}
      <button
        type="button"
        className={compactMobile ? `${premiumButtonClass} !min-h-11 !px-1 !gap-0` : premiumButtonClass}
        aria-label={t('home.board.nextMove')}
        title={t('home.board.nextMove')}
        onClick={() => goTo(review.index + 1)}
        disabled={review.index === review.moves.length}
      >
        <span className={compactMobile ? 'sr-only' : undefined}>{t('home.board.nextMove')}</span>
        <ChevronRight size={21} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </nav>
  );
}

function MobileHomeBoard({
  game,
  onMove,
  review,
  goTo,
}: {
  game: Chess;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  review: HomeBoardReview;
  goTo: (index: number) => void;
}) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="md:hidden w-full min-w-0 space-y-2">
      <div className="home-board w-full aspect-square overflow-hidden rounded-lg ring-1 ring-white/10 shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)]">
        <ChessBoard game={game} onMove={onMove} overrideBoardTheme="Classic Wood" className="!border-none !p-0" />
      </div>
      <HomeMoveControls review={review} goTo={goTo} className="grid" compactMobile />
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



