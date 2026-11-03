import { useMemo } from 'react';
import { positionMap, formatPositionPlan } from '../../utils/positionMap';
import type { EngineResult } from '../../utils/StockfishEngine';
import type { Language } from '../../translations';
import { positionMapLabel, positionMapLineLabel } from './positionMapLabels';

interface Props {
  fen: string;
  result: EngineResult | null;
  language: Language;
  failed: boolean;
  onSelectLine?: (moves: string[]) => void;
}

export default function PositionMapVariations({ fen, result, language, failed, onSelectLine }: Props) {
  const map = useMemo(() => positionMap(fen, result), [fen, result]);
  const score = (evaluation: number, mate?: number) =>
    mate != null ? `${mate < 0 ? '−' : ''}M${Math.abs(mate)}` : `${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;
  const unavailable: Record<Language, string> = {
    ru: 'Нет доступных продолжений', de: 'Keine Fortsetzungen verfügbar',
    en: 'No continuations available', az: 'Davam variantları yoxdur',
    tr: 'Devam yolları bulunamadı', ua: 'Немає доступних продовжень',
  };
  return <section className="analysis-position-map min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4 text-sm" aria-label={positionMapLabel[language]}>
    {map.plans.length === 0 && <p role="status" className="position-map-note">{unavailable[language]}{failed ? ' · Stockfish' : ''}</p>}
    <div className="flex flex-col gap-2">
      {map.plans.slice(0, 3).map((plan, index) => <button
        key={plan.id}
        type="button"
        className="position-map-plan text-left"
        onClick={() => onSelectLine?.(plan.moves.slice(0, 10).map(move => move.san))}
        aria-label={`${positionMapLineLabel[language]} ${index + 1}: ${formatPositionPlan(fen, plan.moves)}`}
      >
        <span className="flex items-center justify-between gap-3">
          <strong>{positionMapLineLabel[language]} {index + 1}</strong>
          <span className="font-mono shrink-0">{score(plan.evaluation, plan.mate)}</span>
        </span>
        <span className="mt-2 block leading-relaxed">{formatPositionPlan(fen, plan.moves)}</span>
      </button>)}
    </div>
  </section>;
}
