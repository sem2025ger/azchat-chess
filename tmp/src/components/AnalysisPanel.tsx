import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Ghost, Cpu, AlertCircle, ScanSearch } from 'lucide-react';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface AnalysisPanelProps {
  score: number;
  bestMove?: string;
  depth: number;
  mate?: number;
  candidates?: string[][];
  lines?: {
    evaluation: number;
    mate?: number;
    depth: number;
    moves: string[];
    hasMore?: boolean;
  }[];
  loading?: boolean;
  error?: boolean;
  noMoves?: boolean;
  reviewLayout?: boolean;
}

export default function AnalysisPanel({ score, bestMove, depth, mate, candidates, lines, loading, error, noMoves, reviewLayout = false }: AnalysisPanelProps) {
  const { t } = useLanguage();
  // Stockfish already calculates up to three MultiPV lines; select how many to show.
  const [visiblePvLines, setVisiblePvLines] = useState(3);
  const displayedLines = reviewLayout ? lines?.slice(0, visiblePvLines) : lines;

  if (noMoves) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 opacity-40 group cursor-default">
         <Ghost size={48} className="text-neutral-600" />
         <span className="text-[0.7rem] font-semibold text-neutral-500 uppercase tracking-widest">{t('game.analysis.nomoves')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 text-red-500/50">
         <AlertCircle size={40} />
         <span className="text-[0.7rem] font-semibold uppercase tracking-widest">{t('game.analysis.unavailable')}</span>
      </div>
    );
  }

  const pv = candidates && candidates[0] && candidates[0].length > 0 ? candidates[0] : null;

  return (
    <div className="analysis-engine-content h-auto flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar animate-fade-in">
      {/* Decorative Title */}
      <div className="analysis-engine-decoration panel-glow-cycle relative flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-neutral-950/85 px-4">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/[0.04] via-cyan-500/[0.06] to-violet-500/[0.04]"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/40 shadow-inner">
            <ScanSearch
              size={16}
              className="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]"
              aria-hidden="true"
            />
          </div>

          <span className="text-glow-cycle text-[0.72rem] font-black uppercase tracking-[0.28em]">
            {t('game.tabs.analysis')}
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="analysis-engine-status flex items-center justify-between border-b border-white/[0.04] pb-3 shrink-0">
         <div className="flex items-center gap-2.5">
            <Cpu size={16} className={cx("text-neutral-400", loading && "animate-pulse")} />
            <span className="text-[0.75rem] font-bold text-neutral-300">Stockfish</span>
            {depth > 0 && <span className="text-[0.65rem] font-semibold text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">depth {depth}</span>}
         </div>
         <div className="flex items-center gap-1.5">
            {reviewLayout && (
              <div className="hidden lg:inline-flex items-center gap-0.5 rounded-lg border border-[#8f7749]/50 bg-[#101116] p-0.5" role="group" aria-label="Количество линий Stockfish">
                {([1, 2, 3] as const).map(count => (
                  <button key={count} type="button" aria-label={`Показать ${count} ${count === 1 ? 'линию' : 'линии'} анализа`} aria-pressed={visiblePvLines === count}
                    onClick={() => setVisiblePvLines(count)}
                    className={cx(
                      "min-h-7 min-w-7 rounded-md border px-1.5 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200",
                      visiblePvLines === count
                        ? "border-[#d0aa65]/60 bg-gradient-to-b from-[#41382b] via-[#28231d] to-[#111217] text-[#f8dfab] shadow-[inset_0_1px_0_rgba(255,228,158,0.35),0_0_8px_rgba(214,169,84,0.19)]"
                        : "border-transparent bg-[#17171c] text-[#a8a196] hover:border-[#af945f]/45 hover:text-[#f2dfbd]"
                    )}
                  >{count}</button>
                ))}
              </div>
            )}
            {loading ? (
              <>
                 <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/80 animate-pulse" />
                 <span className="text-[0.6rem] font-bold text-neutral-500 uppercase tracking-wider">{t('game.analysis.analyzing')}</span>
              </>
            ) : (
              <>
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                 <span className="text-[0.6rem] font-bold text-neutral-500 uppercase tracking-wider">{t('game.analysis.ready')}</span>
              </>
            )}
         </div>
      </header>

      {/* Main evaluation row */}
      <section className="analysis-engine-variations flex flex-col gap-3 shrink-0">
         {displayedLines && displayedLines.length > 0 ? (
           displayedLines.map((line, idx) => (
             <div key={idx} className="analysis-engine-line flex items-start gap-4">
                <div className={cx(
                  "analysis-engine-score px-2.5 py-1 rounded-lg font-mono text-[0.95rem] leading-5 font-black shadow-md min-w-[3.5rem] text-center shrink-0 border md:px-3 md:py-1.5 md:text-[1.1rem] md:leading-normal md:min-w-[4rem]",
                  line.mate != null ? "bg-chess-gold/10 text-chess-gold border-chess-gold/30" : 
                  line.evaluation > 0 ? "bg-white text-black border-white" : 
                  line.evaluation < 0 ? "bg-black text-white border-white/20" :
                  "bg-neutral-800 text-neutral-300 border-neutral-600"
                )}>
                   {line.mate != null ? (line.mate < 0 ? `-M${Math.abs(line.mate)}` : `M${line.mate}`) : (line.evaluation > 0 ? `+${line.evaluation.toFixed(2)}` : line.evaluation.toFixed(2))}
                </div>
                
                <div className="analysis-engine-pv flex-1 flex flex-col pt-0.5">
                   <div className="analysis-engine-moves text-[0.8rem] font-medium text-neutral-300 leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
                      {line.moves.length > 0 ? line.moves.map((move, i) => (
                        <span key={i} className={i <= 1 ? "font-bold text-white" : "text-neutral-400"}>{move}</span>
                      )) : (
                        <span className="text-[0.7rem] text-neutral-600 italic">{t('game.analysis.analyzing_position')}</span>
                      )}
                      {line.hasMore && <span className="text-[0.8rem] text-neutral-500 font-bold">…</span>}
                   </div>
                </div>
             </div>
           ))
         ) : (
           <div className="analysis-engine-line flex items-start gap-4">
              <div className={cx(
                "analysis-engine-score px-2.5 py-1 rounded-lg font-mono text-[0.95rem] leading-5 font-black shadow-md min-w-[3.5rem] text-center shrink-0 border md:px-3 md:py-1.5 md:text-[1.1rem] md:leading-normal md:min-w-[4rem]",
                mate != null ? "bg-chess-gold/10 text-chess-gold border-chess-gold/30" : 
                score > 0 ? "bg-white text-black border-white" : 
                score < 0 ? "bg-black text-white border-white/20" :
                "bg-neutral-800 text-neutral-300 border-neutral-600"
              )}>
                 {mate != null ? (mate < 0 ? `-M${Math.abs(mate)}` : `M${mate}`) : (score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2))}
              </div>
              
              <div className="analysis-engine-pv flex-1 flex flex-col pt-0.5">
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-[0.65rem] font-bold text-neutral-500 uppercase tracking-wider">{t('game.analysis.bestMove')}:</span>
                    {bestMove ? (
                       <span className="text-[0.8rem] font-black text-chess-active">{bestMove}</span>
                    ) : (
                       <span className="text-[0.7rem] italic text-neutral-600">...</span>
                    )}
                 </div>
                 <div className="analysis-engine-moves text-[0.8rem] font-medium text-neutral-300 leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
                    {pv ? pv.map((move, i) => (
                      <span key={i} className={i === 0 ? "font-bold text-white" : "text-neutral-400"}>{move}</span>
                    )) : (
                      <span className="text-[0.7rem] text-neutral-600 italic">{t('game.analysis.analyzing_position')}</span>
                    )}
                 </div>
              </div>
           </div>
         )}
      </section>
    </div>
  );
}
