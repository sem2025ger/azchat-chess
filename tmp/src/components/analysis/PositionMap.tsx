import { useMemo, useState } from 'react';
import { positionMap } from '../../utils/positionMap';
import type { EngineResult } from '../../utils/StockfishEngine';
import type { Language } from '../../translations';
import type { Square } from 'chess.js';

import { positionMapLabel } from './positionMapLabels';

interface Props { fen: string; result: EngineResult | null; language: Language; failed: boolean; onHighlight: (selection: { fen: string; squares: Square[] } | null) => void }

export default function PositionMap({ fen, result, language, failed, onHighlight }: Props) {
  const ru = language === 'ru';
  const map = useMemo(() => positionMap(fen, result), [fen, result]);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = map.plans.find(plan => plan.id === selected);
  const currentSide = map.turn === 'w' ? (ru ? 'белых' : 'White') : (ru ? 'чёрных' : 'Black');
  const score = (evaluation: number, mate?: number) => mate != null ? `${mate < 0 ? '−' : ''}M${Math.abs(mate)}` : `${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;
  const empty = ru ? 'нет' : 'none';
  return <section className="analysis-position-map min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4 text-sm" aria-label={positionMapLabel[language]}>
    <div className="position-map-facts">
      <h2>{ru ? 'Структура' : 'Structure'}</h2>
      <p>{ru ? 'Пешки' : 'Pawns'}: {ru ? 'белые' : 'White'} {map.white.pawns} · {ru ? 'чёрные' : 'Black'} {map.black.pawns}</p>
      <p>{ru ? 'Изолированные' : 'Isolated'}: {ru ? 'белые' : 'White'} {map.white.isolated.join(', ') || empty} · {ru ? 'чёрные' : 'Black'} {map.black.isolated.join(', ') || empty}</p>
      <p>{ru ? 'Сдвоенные на вертикалях' : 'Doubled on files'}: {ru ? 'белые' : 'White'} {map.white.doubled.join(', ') || empty} · {ru ? 'чёрные' : 'Black'} {map.black.doubled.join(', ') || empty}</p>
      <h2>{ru ? 'Линии' : 'Files'}</h2>
      <p>{ru ? 'Открытые' : 'Open'}: {map.openFiles.join(', ') || empty}</p>
      <p>{ru ? 'Полуоткрытые' : 'Semi-open'}: {ru ? 'у белых' : 'White'} {map.white.semiOpen.join(', ') || empty} · {ru ? 'у чёрных' : 'Black'} {map.black.semiOpen.join(', ') || empty}</p>
      <h2>{ru ? 'Дисбалансы' : 'Imbalances'}</h2>
      <p>{ru ? 'Материал (пешка 1, конь/слон 3, ладья 5, ферзь 9)' : 'Material (pawn 1, knight/bishop 3, rook 5, queen 9)'}: {map.white.material} : {map.black.material}</p>
      <p>{ru ? 'Слоны' : 'Bishops'}: {map.white.bishops} : {map.black.bishops}</p>
    </div>
    <h2 className="mt-5">{ru ? `Планы ${currentSide}` : `${currentSide} plans`}</h2>
    <p className="position-map-note">{ru ? 'Кандидатные продолжения Stockfish. Выберите вариант — его поля подсветятся на доске. Оценка дана за белых.' : 'Stockfish candidate continuations. Select a line to highlight its squares. Scores are from White’s perspective.'}</p>
    {map.plans.length === 0 && <p role="status" className="position-map-note">{map.ended ? (ru ? 'Партия завершена: продолжений нет.' : 'The game is over: no continuations.') : failed ? (ru ? 'Stockfish недоступен. Структура показана по текущей доске.' : 'Stockfish is unavailable. Structure is based on the current board.') : (ru ? 'Расчёт вариантов для этой позиции…' : 'Calculating continuations for this position…')}</p>}
    {map.plans.map((plan, index) => <button key={plan.id} type="button" className="position-map-plan" aria-pressed={selected === plan.id} onClick={() => {
      const next = selected === plan.id ? null : plan.id;
      setSelected(next);
      onHighlight(next ? { fen, squares: [...new Set(plan.moves.slice(0, 6).flatMap(move => [move.from, move.to]))] } : null);
    }}>
      <span className="flex items-center justify-between gap-2"><strong>{ru ? 'Вариант' : 'Line'} {index + 1} · {plan.moves[0].san}</strong><span className="font-mono">{score(plan.evaluation, plan.mate)}</span></span>
      <span className="mt-2 block leading-relaxed">{plan.moves.slice(0, 10).map(move => move.san).join(' ')}</span>
      <span className="position-map-note">Stockfish · {ru ? 'глубина' : 'depth'} {plan.depth}</span>
    </button>)}
    <h2 className="mt-5">{ru ? (map.turn === 'w' ? 'Ответ чёрных' : 'Ответ белых') : (map.turn === 'w' ? 'Black’s response' : 'White’s response')}</h2>
    <p className="position-map-note">{chosen ? chosen.moves[1] ? `${chosen.moves[0].san} → ${chosen.moves[1].san}${chosen.moves[2] ? ` → ${chosen.moves[2].san}` : ''}` : (ru ? 'После выбранного хода ответов нет.' : 'There is no reply after the selected move.') : (ru ? 'Выберите план выше, чтобы увидеть ответ в том же варианте.' : 'Select a plan above to see the reply in the same line.')}</p>
  </section>;
}
