import {analysePreparation,type PreparationGame,type PreparationFilters} from '../../../../shared/vorbereitung.mjs';
import { useRegionalCopy } from '../../i18n/regionalCopy';
export default function VorbereitungResults({games,filters,onAnalyse}:{games:PreparationGame[];filters:PreparationFilters;onAnalyse:(pgn:string)=>void}){
 const tr=useRegionalCopy();
 const result=analysePreparation(games,filters);
 return <><p>{result.games.length} {tr('passende Partien')} · {games.length} {tr('geladene Partien')}</p>
  {!result.games.length&&<p role="status">{filters.variation?.trim()?tr('Keine Partien in dieser Variante'):tr('Keine Partien für diese Filter')}</p>}
  <div className="vorbereitung-colors">{(['white','black']as const).map(color=>{const s=result.byColor[color];return <section key={color}><h2>{color==='white'?tr("Mit Weiß"):tr("Mit Schwarz")}</h2><p>{s.games} {tr('Partien')} · {tr('Siege')} {s.winPct}% · {tr('Remis')} {s.drawPct}% · {tr('Niederlagen')} {s.lossPct}%</p></section>;})}</div>
  <div className="vorbereitung-table"><table><caption>{tr('Eröffnungen nach Farbe · Ergebnisse aus Sicht des gesuchten Spielers')}</caption><thead><tr><th>{tr("Farbe")}</th><th>{tr("Eröffnung / ECO")}</th><th>{tr("Partien")}</th><th>{tr("Sieg %")}</th><th>{tr("Remis %")}</th><th>{tr("Niederlage %")}</th></tr></thead><tbody>{result.openings.map(o=><tr key={o.color+o.eco+o.opening}><td>{o.color==='white'?tr("Weiß"):tr("Schwarz")}</td><td>{o.eco||'—'} · {o.opening}</td><td>{o.games}</td><td>{o.winPct}%</td><td>{o.drawPct}%</td><td>{o.lossPct}%</td></tr>)}</tbody></table></div>
  <ol className="vorbereitung-games">{result.games.map(g=><li key={g.id}><strong>{g.white} – {g.black}</strong><p>{g.result} · {g.date} · {g.color==='white'?tr("Weiß"):tr("Schwarz")} · {g.speed} · {g.timeControl}</p><p>{g.eco||'—'} · {g.opening}</p>{g.event&&<p>{g.event}</p>}{g.link_basis&&<p>{g.link_basis==='fide_id'?tr("Zuordnung über FIDE-ID"):tr("Namenszuordnung (nicht verifiziert)")} · {g.source}</p>}{g.sourceUrl&&<a href={g.sourceUrl} target="_blank" rel="noopener noreferrer">{tr("Quelldatei")}</a>}{g.licenseUrl&&<a href={g.licenseUrl} target="_blank" rel="noopener noreferrer"> · CC BY-SA 4.0</a>}<button type="button" onClick={()=>onAnalyse(g.pgn)}>{tr("In ChessAZ analysieren")}</button></li>)}</ol>
 </>;
}
