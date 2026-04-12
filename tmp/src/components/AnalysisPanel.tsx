import { useLanguage } from '../context/LanguageContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Trophy, Compass, Activity, Ghost, AlertCircle, Cpu, Gauge, Zap, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-8 animate-pulse bg-black/20">
        <div className="relative">
           <Compass size={96} className="text-chess-active animate-spin-slow opacity-20" />
           <div className="absolute inset-0 flex items-center justify-center">
              <Cpu size={40} className="text-chess-active animate-bounce" />
           </div>
        </div>
        <div className="flex flex-col items-center gap-4">
           <span className="text-[0.75rem] font-black text-white uppercase tracking-[0.4em] italic leading-none">{t('game.analysis.engineLoading')}</span>
           <div className="w-56 h-2 bg-white/5 rounded-full overflow-hidden shadow-inner ring-1 ring-white/10">
              <div className="h-full bg-chess-active w-1/3 animate-shimmer" />
           </div>
        </div>
      </div>
    );
  }

  if (noMoves) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-10 opacity-30 group cursor-default bg-black/20">
         <Ghost size={80} className="text-neutral-500 group-hover:scale-110 transition-transform duration-700 hover:text-chess-active group-hover:rotate-6" />
         <div className="flex flex-col items-center gap-3">
            <span className="text-[0.75rem] font-black text-neutral-400 uppercase tracking-[0.4em] italic">{t('game.analysis.nomoves')}</span>
            <span className="text-[0.6rem] font-black text-neutral-700 tracking-[0.2em] uppercase">{t('game.analysis.engineAwaiting')}</span>
         </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-8 text-red-500/50 bg-red-500/5">
         <AlertCircle size={64} className="animate-pulse" />
         <div className="flex flex-col items-center gap-3">
            <span className="text-[0.75rem] font-black uppercase tracking-[0.4em] italic">{t('game.analysis.unavailable')}</span>
            <span className="text-[0.6rem] font-black text-red-900 tracking-[0.2em] uppercase">{t('game.analysis.engineFault')}</span>
         </div>
      </div>
    );
  }

  const getQualityBadge = (scoreVal: number): { label: string, color: string, bg: string, icon: any, shadow: string } => {
    const abs = Math.abs(scoreVal);
    if (abs > 3.5) return { label: t('game.analysis.quality.blunder'), color: 'text-rose-500', bg: 'bg-rose-500/20', icon: XCircle, shadow: 'shadow-rose-500/20' };
    if (abs > 3.0) return { label: t('game.analysis.quality.best'), color: 'text-chess-active', bg: 'bg-chess-active/20', icon: Zap, shadow: 'shadow-chess-active/20' };
    if (abs > 1.2) return { label: t('game.analysis.quality.good'), color: 'text-emerald-400', bg: 'bg-emerald-400/20', icon: CheckCircle2, shadow: 'shadow-emerald-400/20' };
    if (abs > 0.5) return { label: t('game.analysis.quality.inaccurate'), color: 'text-yellow-400', bg: 'bg-yellow-400/20', icon: Info, shadow: 'shadow-yellow-400/20' };
    return { label: t('game.analysis.quality.mistake'), color: 'text-orange-500', bg: 'bg-orange-500/20', icon: AlertTriangle, shadow: 'shadow-orange-500/20' };
  };

  const quality = getQualityBadge(score);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar animate-fade-in bg-black/20 relative group">
      
      {/* Premium Engine Header */}
      <header className="flex items-center justify-between border-b border-white/[0.04] pb-2 shrink-0">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-chess-active/10 rounded-xl flex items-center justify-center text-chess-active border border-chess-active/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
               <Gauge size={20} />
            </div>
            <div>
               <h4 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-[0.3em] italic">{t('game.analysis.engineStatus')}</h4>
               <p className="text-[0.7rem] font-black text-white italic uppercase tracking-tighter mt-0.5">{t('game.analysis.engineLabel')}</p>
            </div>
         </div>
         <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
            <span className="text-[0.6rem] font-black text-emerald-500 uppercase tracking-widest leading-none">{t('game.analysis.processActive')}</span>
         </div>
      </header>

      {/* Analytics Dashboard Grid */}
      <section className="space-y-3 shrink-0">
         <div className="flex items-center gap-3 mb-2 opacity-50">
            <div className="w-1.5 h-4 bg-chess-active rounded-full shadow-[0_0_10px_#00ced1]" />
            <h4 className="text-[0.6rem] font-black text-neutral-400 uppercase tracking-[0.4em] italic">{t('game.analysis.dashboard')}</h4>
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.03] p-3 rounded-[1.25rem] border border-white/5 space-y-1 group/card hover:bg-white/[0.07] transition-all duration-500 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-chess-gold/5 blur-3xl rounded-full -mr-12 -mt-12 transition-colors group-hover/card:bg-chess-gold/10" />
                <span className="text-[0.6rem] font-black text-neutral-600 uppercase tracking-[0.3em] flex items-center gap-2 relative z-10 italic">
                   <Trophy size={14} className="text-chess-gold" /> {t('game.analysis.bestMove')}
                </span>
                <div className="text-xl font-black text-white italic tracking-tighter uppercase group-hover/card:translate-x-1 transition-transform relative z-10 drop-shadow-2xl">{bestMove || '---'}</div>
            </div>
            <div className="bg-white/[0.03] p-3 rounded-[1.25rem] border border-white/5 space-y-1 group/card hover:bg-white/[0.07] transition-all duration-500 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-chess-active/5 blur-3xl rounded-full -mr-12 -mt-12 transition-colors group-hover/card:bg-chess-active/10" />
                <span className="text-[0.6rem] font-black text-neutral-600 uppercase tracking-[0.3em] flex items-center gap-2 relative z-10 italic">
                   <Activity size={14} className="text-chess-active" /> {t('game.analysis.depth')}
                </span>
                <div className="text-xl font-black text-chess-active italic tracking-tighter uppercase group-hover/card:translate-x-1 transition-transform relative z-10 drop-shadow-2xl">{depth}</div>
            </div>
         </div>
      </section>

      {/* Main evaluation card - Enhanced Fidelity */}
      <section className="space-y-3">
         <div className="flex items-center justify-between p-4 bg-black/40 rounded-[1.5rem] border border-white/10 group/eval hover:border-chess-active/40 transition-all duration-700 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden ring-1 ring-white/5 border-b-[4px] border-black/60">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-chess-active/[0.05] blur-[80px] rounded-full group-hover/eval:bg-chess-active/[0.1] transition-all duration-1000" />
            <div className="flex flex-col relative z-10 gap-3">
               <span className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-[0.4em] italic">{t('game.analysis.qualityLabel')}</span>
               <div className={cx(
                  "flex items-center gap-3 px-6 py-3 rounded-[1.75rem] text-[0.75rem] font-black italic uppercase tracking-[0.2em] border border-transparent group-hover/eval:border-white/10 transition-all shadow-2xl", 
                  quality.color, quality.bg, quality.shadow
               )}>
                  <quality.icon size={20} strokeWidth={2.5} />
                  {quality.label}
               </div>
            </div>
            <div className="flex flex-col items-end relative z-10">
               <span className="text-[0.6rem] font-black text-neutral-600 uppercase tracking-[0.35em] mb-2 italic">{t('game.analysis.detail')}</span>
               <div className="bg-neutral-900 px-6 py-2 rounded-[1rem] text-2xl font-black text-white italic shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)] border border-white/5 ring-1 ring-white/5 flex items-baseline gap-2 tabular-nums">
                  {mate != null ? (<>
                     <span className="text-[0.6rem] text-neutral-700 font-black not-italic uppercase tracking-[0.4em] mr-2">MATE</span>
                     #{Math.abs(mate)}
                  </>) : (<>
                     <span className="text-[0.6rem] text-neutral-700 font-black not-italic uppercase tracking-[0.4em] mr-2">CP</span>
                     {score > 0 ? `+${score}` : score}
                  </>)}
               </div>
            </div>
         </div>
      </section>

      {/* Tactical Variations - Professional List */}
      <section className="space-y-3 flex-1 min-h-0 flex flex-col pt-1">
         <div className="flex items-center justify-between pb-2 border-b border-white/[0.03]">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-chess-gold rounded-full shadow-[0_0_20px_#dfb06240]" />
               <h4 className="font-black text-white text-[0.7rem] tracking-[0.2em] italic uppercase leading-none">{t('game.analysis.variations')}</h4>
            </div>
            <span className="text-[0.55rem] font-black text-neutral-700 uppercase tracking-[0.2em] italic">{t('game.analysis.multiLine')}</span>
         </div>
          <div className="space-y-3 overflow-y-auto pr-3 custom-scrollbar flex-1 pb-4 overscroll-none">
            {(candidates || [
               ['Nf3', 'd5', 'd4', 'c5', 'Nc3', 'cxd4'],
               ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
               ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6']
            ]).map((line, idx) => (
              <div key={idx} className="p-3 bg-white/[0.02] border border-white/5 rounded-[1.25rem] flex flex-col gap-3 group/line hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-1 cursor-default shadow-xl ring-1 ring-white/5 group-hover:opacity-60 hover:!opacity-100">
                 <div className="flex items-center justify-between">
                    <div className="w-8 h-8 shrink-0 bg-neutral-950 rounded-[0.75rem] flex items-center justify-center text-[0.7rem] font-black text-neutral-600 shadow-2xl border border-white/5 group-hover/line:text-chess-gold group-hover/line:border-chess-gold/30 transition-all italic leading-none">
                       {idx + 1}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-black/40 rounded-full border border-white/5 opacity-40 group-hover/line:opacity-100 transition-opacity">
                       <Gauge size={10} className="text-neutral-700" strokeWidth={2.5} />
                       <span className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-widest font-mono">{t('game.analysis.lineLabel')} {idx + 1}</span>
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-x-3 gap-y-1.5 pl-2">
                    {line.map((m, mi) => (
                      <div key={mi} className="flex items-center gap-2">
                        {mi % 2 === 0 && <span className="text-[0.7rem] font-black text-neutral-700 italic">{(mi/2)+1}</span>}
                        <span className={cx(
                           "text-sm font-black transition-colors uppercase tracking-tight relative", 
                           mi % 2 === 0 ? "text-neutral-300 group-hover/line:text-white" : "text-neutral-500/80 font-bold"
                        )}>
                           {m}
                           {mi % 2 === 0 && <div className="absolute -bottom-1 left-0 w-full h-px bg-white/5" />}
                        </span>
                      </div>
                    ))}
                 </div>
              </div>
            ))}
         </div>
      </section>

      {/* Role Confirmation Footer */}
      <footer className="shrink-0 pt-3 border-t border-white/[0.03] mt-1">
         <div className="bg-chess-active/[0.03] border border-chess-active/[0.08] rounded-[1.5rem] p-4 flex flex-col items-center gap-3 text-center group/footer hover:bg-chess-active/[0.06] transition-all duration-700 shadow-3xl ring-1 ring-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-chess-active/[0.02] to-transparent pointer-events-none" />
            <div className="p-3 bg-chess-active/10 rounded-[1rem] text-chess-active shadow-2xl border border-chess-active/20 group-hover/footer:scale-110 group-hover/footer:rotate-3 transition-all duration-700 flex items-center justify-center relative z-10">
               <Compass size={24} strokeWidth={2.5} />
            </div>
            <p className="text-[0.6rem] text-neutral-600 font-bold leading-relaxed px-4 italic uppercase tracking-[0.2em] group-hover/footer:text-neutral-400 transition-colors relative z-10">
               {t('game.analysis.hint')}
            </p>
         </div>
      </footer>

    </div>
  );
}
