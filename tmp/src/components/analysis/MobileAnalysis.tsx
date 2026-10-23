import type { ReactNode } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { EngineResult } from '../../utils/StockfishEngine';
import { analysisCopy } from './copy';
import { mobileAnalysisCopy } from './mobileAnalysisCopy';
import './mobileAnalysis.css';

type Tab = 'analysis' | 'moves';
interface Line { evaluation: number; mate?: number | null; moves: string[] }
interface MovePair { n: number; w: string; b?: string; wIndex: number; bIndex: number }

export function MobileAnalysisHeader({ activeTab, onTab, actions }: {
  activeTab: Tab; onTab: (tab: Tab) => void;
  actions: ReactNode;
}) {
  const { language, t } = useLanguage();
  const words = analysisCopy[language];
  return <header className="mobile-analysis-header md:hidden" data-mobile-analysis-header>
    <div className="mobile-analysis-topbar">
      <div className="mobile-analysis-tabs" role="group" aria-label={words.analysis}>
        {(['analysis', 'moves'] as const).map(tab => <button key={tab} type="button"
          aria-pressed={activeTab === tab} aria-controls="mobile-analysis-details" onClick={() => onTab(tab)}>
          {t(`game.tabs.${tab}`)}
        </button>)}
      </div>
      <span className="mobile-analysis-engine">Stockfish 18</span>
      {actions}
    </div>
  </header>;
}

const scoreText = (result?: { evaluation: number; mate?: number | null } | null) =>
  !result ? '—' : result.mate != null
    ? `${result.mate < 0 ? '−' : ''}M${Math.abs(result.mate)}`
    : `${result.evaluation > 0 ? '+' : ''}${result.evaluation.toFixed(2)}`;

// Presentation only: preserve SAN in the session, engine and accessible label.
function FigurineMove({ move }: { move: string }) {
  return <span className="mobile-analysis-san">{move.split(/(^[KQRBN]|=[QRBN])/).map((part, index) => {
    const piece = /^[KQRBN]$/.test(part) ? part : /^=[QRBN]$/.test(part) ? part[1] : null;
    return piece ? <span key={index}>{part.startsWith('=') ? '=' : ''}<img
      className="mobile-analysis-figurine" src={`/pieces/flat2d/w${piece}.svg`}
      width={22} height={24} alt="" aria-hidden="true" draggable={false} /></span> : part;
  })}</span>;
}

export function MobileAnalysisDetails({ activeTab, result, lines, loading, failed, moves,
  currentIndex, onMove, depth }: {
  activeTab: Tab; result: EngineResult | null; lines?: Line[]; loading: boolean; failed: boolean;
  moves: MovePair[]; currentIndex: number; onMove: (index: number) => void;
  depth: number;
}) {
  const { language, t } = useLanguage();
  const copy = mobileAnalysisCopy[language];
  const visibleLines = result ? lines?.slice(0, 2) || [] : [];
  return <section id="mobile-analysis-details" className="mobile-analysis-details md:hidden"
    aria-label={t(`game.tabs.${activeTab}`)}>
    {activeTab === 'analysis' ? <>
      <div className="sr-only">
        <span>{copy.lines}</span><span>{result?.depth || 0}/{depth}</span>
      </div>
      <div id="mobile-engine-lines" aria-label={copy.lines} aria-busy={loading && !failed}>
        {[0, 1].map(index => {
          const line = visibleLines[index];
          return <div key={index} className="mobile-analysis-line" data-mobile-engine-line>
            <span className="mobile-analysis-score">{scoreText(line)}</span>
            <p tabIndex={line ? 0 : undefined} aria-label={`${copy.lines}: ${index + 1}${line ? `. ${line.moves.join(' ')}` : ''}`}>
              {failed ? t('game.analysis.unavailable') : line?.moves.length
                ? line.moves.map((move, moveIndex) => <FigurineMove key={moveIndex} move={move} />)
                : t(loading ? 'game.analysis.analyzing' : 'game.analysis.ready')}
            </p>
          </div>;
        })}
      </div>
    </> : <div className="mobile-analysis-moves" tabIndex={0}>
      {moves.length ? <table><tbody>{moves.map(move => <tr key={move.n}>
        <th scope="row">{move.n}.</th>
        <td>{move.w && <button type="button" aria-current={currentIndex === move.wIndex ? 'step' : undefined}
          onClick={() => onMove(move.wIndex)}>{move.w}</button>}</td>
        <td>{move.b && <button type="button" aria-current={currentIndex === move.bIndex ? 'step' : undefined}
          onClick={() => onMove(move.bIndex)}>{move.b}</button>}</td>
      </tr>)}</tbody></table> : <p className="mobile-analysis-notice">{t('game.analysis.nomoves')}</p>}
    </div>}
  </section>;
}
