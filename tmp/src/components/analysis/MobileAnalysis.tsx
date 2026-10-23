import { useState, type ReactNode } from 'react';
import { ChevronDown, Cpu, FolderOpen, Map, Pencil } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { EngineResult } from '../../utils/StockfishEngine';
import { analysisCopy } from './copy';
import { mobileAnalysisCopy } from './mobileAnalysisCopy';
import './mobileAnalysis.css';

type Tab = 'analysis' | 'moves';
interface Line { evaluation: number; mate?: number | null; moves: string[] }
interface MovePair { n: number; w: string; b?: string; wIndex: number; bIndex: number }

export function MobileAnalysisHeader({ activeTab, onTab, onTool, actions }: {
  activeTab: Tab; onTab: (tab: Tab) => void;
  onTool: (tool: 'map' | 'games' | 'position') => void; actions: ReactNode;
}) {
  const { language, t } = useLanguage();
  const words = analysisCopy[language];
  const copy = mobileAnalysisCopy[language];
  return <header className="mobile-analysis-header md:hidden" data-mobile-analysis-header>
    <div className="mobile-analysis-topbar">
      <div className="mobile-analysis-tabs" role="group" aria-label={words.analysis}>
        {(['analysis', 'moves'] as const).map(tab => <button key={tab} type="button"
          aria-pressed={activeTab === tab} aria-controls="mobile-analysis-details" onClick={() => onTab(tab)}>
          {t(`game.tabs.${tab}`)}
        </button>)}
      </div>
      <span className="mobile-analysis-engine"><Cpu size={13} aria-hidden="true"/>Stockfish 18</span>
      {actions}
    </div>
    <nav className="mobile-analysis-tools" aria-label={words.analysis}>
      {([
        { tool:'map', label:copy.map, icon:Map },
        { tool:'games', label:words.games, icon:FolderOpen },
        { tool:'position', label:copy.editor, icon:Pencil },
      ] as const).map(({ tool, label, icon: Icon }) => <button key={tool} type="button"
        aria-haspopup="dialog" onClick={() => onTool(tool)} data-mobile-tool={tool}>
        <Icon size={16} aria-hidden="true"/><span>{label}</span>
      </button>)}
    </nav>
  </header>;
}

const scoreText = (result?: { evaluation: number; mate?: number | null } | null) =>
  !result ? '—' : result.mate != null
    ? `${result.mate < 0 ? '−' : ''}M${Math.abs(result.mate)}`
    : `${result.evaluation > 0 ? '+' : ''}${result.evaluation.toFixed(2)}`;

export function MobileAnalysisDetails({ activeTab, result, lines, loading, failed, moves,
  currentIndex, onMove, pvLines, onPvLines, depth, onDepth }: {
  activeTab: Tab; result: EngineResult | null; lines?: Line[]; loading: boolean; failed: boolean;
  moves: MovePair[]; currentIndex: number; onMove: (index: number) => void;
  pvLines: number; onPvLines: (count: number) => void; depth: number; onDepth: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { language, t } = useLanguage();
  const copy = mobileAnalysisCopy[language];
  const visibleLines = result ? lines?.slice(0, pvLines) || [] : [];
  return <section id="mobile-analysis-details" className="mobile-analysis-details md:hidden"
    aria-label={t(`game.tabs.${activeTab}`)}>
    {activeTab === 'analysis' ? <>
      <button type="button" className="mobile-analysis-summary" aria-expanded={expanded}
        aria-controls="mobile-engine-lines" onClick={() => setExpanded(value => !value)}>
        <span className="mobile-analysis-score">{scoreText(result)}</span>
        <span className="mobile-analysis-summary-text">
          <span>{copy.lines}</span>
          <span>{failed ? t('game.analysis.unavailable') : visibleLines[0]?.moves.join(' ') || t(loading ? 'game.analysis.analyzing' : 'game.analysis.ready')}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={expanded ? 'rotate-180' : ''}/>
        <span className="sr-only">{expanded ? copy.collapse : copy.expand}</span>
      </button>
      <div id="mobile-engine-lines" hidden={!expanded}>
        <div className="mobile-analysis-engine-controls">
          <div role="group" aria-label={copy.lines}>
            {[1, 2, 3, 4, 5].map(count => <button key={count} type="button" aria-pressed={pvLines === count}
              aria-label={`${copy.lines}: ${count}`} onClick={() => onPvLines(count)}>{count}</button>)}
          </div>
          <button type="button" onClick={onDepth} disabled={depth >= 36} aria-label={`${copy.lines}: ${depth} → ${Math.min(36, depth + 6)}`}>
            {result?.depth || 0}/{depth} <span aria-hidden="true">+</span>
          </button>
        </div>
        {failed ? <p role="status" className="mobile-analysis-notice">{t('game.analysis.unavailable')}</p>
          : visibleLines.length ? visibleLines.map((line, index) => <div key={index} className="mobile-analysis-line">
            <span className="mobile-analysis-score">{scoreText(line)}</span>
            <p>{line.moves.join(' ')}</p>
          </div>) : <p role="status" className="mobile-analysis-notice">{t('game.analysis.analyzing')}</p>}
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
