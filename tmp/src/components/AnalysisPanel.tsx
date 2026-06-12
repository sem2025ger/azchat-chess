import { useLanguage } from '../context/LanguageContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Ghost, Cpu, AlertCircle } from 'lucide-react';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface AnalysisPanelProps {
  score: number;
  bestMove?: string;
  depth: number;
  mate?: number;
  candidates?: string[][];
  loading?: boolean;
  error?: boolean;
  noMoves?: boolean;
}

export default function AnalysisPanel({ score, bestMove, depth, mate, candidates, loading, error, noMoves }: AnalysisPanelProps) {
  const { t } = useLanguage();

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
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/[0.04] pb-3 shrink-0">
         <div className="flex items-center gap-2.5">
            <Cpu size={16} className={cx("text-neutral-400", loading && "animate-pulse")} />
            <span className="text-[0.75rem] font-bold text-neutral-300">Stockfish</span>
            {depth > 0 && <span className="text-[0.65rem] font-semibold text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">depth {depth}</span>}
         </div>
         <div className="flex items-center gap-1.5">
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
      <section className="flex flex-col gap-3 shrink-0">
         <div className="flex items-start gap-4">
            <div className={cx(
              "px-3 py-1.5 rounded-lg font-mono text-[1.1rem] font-black shadow-md min-w-[4rem] text-center shrink-0 border",
              mate != null ? "bg-chess-gold/10 text-chess-gold border-chess-gold/30" : 
              score > 0 ? "bg-white text-black border-white" : 
              score < 0 ? "bg-black text-white border-white/20" :
              "bg-neutral-800 text-neutral-300 border-neutral-600"
            )}>
               {mate != null ? (mate < 0 ? `-M${Math.abs(mate)}` : `M${mate}`) : (score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2))}
            </div>
            
            <div className="flex-1 flex flex-col pt-0.5">
               <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.65rem] font-bold text-neutral-500 uppercase tracking-wider">{t('game.analysis.bestMove')}:</span>
                  {bestMove ? (
                     <span className="text-[0.8rem] font-black text-chess-active">{bestMove}</span>
                  ) : (
                     <span className="text-[0.7rem] italic text-neutral-600">...</span>
                  )}
               </div>
               <div className="text-[0.8rem] font-medium text-neutral-300 leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
                  {pv ? pv.map((move, i) => (
                    <span key={i} className={i === 0 ? "font-bold text-white" : "text-neutral-400"}>{move}</span>
                  )) : (
                    <span className="text-[0.7rem] text-neutral-600 italic">{t('game.analysis.analyzing_position')}</span>
                  )}
               </div>
            </div>
         </div>
      </section>
    </div>
  );
}
