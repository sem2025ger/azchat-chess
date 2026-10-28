import {analysePreparation,type PreparationGame,type PreparationFilters} from '../../../../shared/vorbereitung.mjs';
import { useRegionalCopy } from '../../i18n/regionalCopy';
export default function VorbereitungResults({games,filters,onAnalyse}:{games:PreparationGame[];filters:PreparationFilters;onAnalyse:(pgn:string)=>void}){
 const tr=useRegionalCopy();
 const result=analysePreparation(games,filters);
 return <><p>{result.games.length} {tr('passende Partien')} 路 {games.length} {tr('geladene Partien')}</p>
  {!result.games.length&&<p role="status">{filters.variation?.trim()?'Keine Partien in dieser Variante':'Keine Partien f眉r diese Filter'}</p>}
  <div className="vorbereitung-colors">{(['white','black']as const).map(color=>{const s=result.byColor[color];return <section key={color}><h2>{color==='white'?'Mit Wei脽':'Mit Schwarz'}</h2><p>{s.games} {tr('Partien')} 路 {tr('Siege')} {s.winPct}% 路 {tr('Remis')} {s.drawPct}% 路 {tr('Niederlagen')} {s.lossPct}%</p></section>;})}</div>
  <details className="section-info"><summary>{tr('Er枚ffnungen nach Farbe')}</summary><div className="vorbereitung-table"><table><caption>{tr('Er枚ffnungen nach Farbe 路 Ergebnisse aus Sicht des gesuchten Spielers')}</caption><thead><tr><th>{tr('Farbe')}</th><th>{tr('Er枚ffnung / ECO')}</th><th>{tr('Partien')}</th><th>{tr('Sieg %')}</th><th>{tr('Remis %')}</th><th>{tr('Niederlage %')}</th></tr></thead><tbody>{result.openings.map(o=><tr key={o.color+o.eco+o.opening}><td>{o.color==='white'?tr('Wei脽'痘玘