import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface EvaluationBarProps {
  score: number; // + is white, - is black
  isMate?: boolean;
  mateIn?: number;
  className?: string;
}

export default function EvaluationBar({ score, isMate, mateIn, className }: EvaluationBarProps) {
  // Map score to percentage. 0 means black wins, 1 means white wins.
  // 0.5 is equal.
  // Standardizing: +5 and -5 are near 90/10 respectively.
  
  const getPercentage = () => {
    if (isMate && mateIn) {
      return mateIn > 0 ? 100 : 0;
    }
    const val = Math.max(-5, Math.min(5, score));
    return ((val + 5) / 10) * 100;
  };

  const whiteBarHeight = getPercentage();

  return (
    <div className={cx(
      "w-4 md:w-6 h-full bg-[#1c1b18] rounded-full overflow-hidden flex flex-col-reverse border border-white/5 relative shadow-inner shadow-black/80",
      className
    )}>
      {/* White Advantage Area (Bottom to Top) */}
      <div 
        className="bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-1000 ease-in-out" 
        style={{ height: `${whiteBarHeight}%` }}
      />
      
      {/* Black Advantage Area (Implicitly everything else) */}
      
      {/* Score Label (Middle) */}
      <div className={cx(
        "absolute w-full text-center text-[0.5rem] md:text-[0.65rem] font-black z-10 select-none pointer-events-none drop-shadow-md transition-all duration-1000",
        whiteBarHeight > 50 ? "bottom-2 text-black/60" : "top-2 text-white/60"
      )}>
        {isMate ? `#${mateIn}` : Math.abs(score).toFixed(1)}
      </div>

      {/* Mid Line (Equal indication) */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-neutral-600/50 z-0" />
    </div>
  );
}
