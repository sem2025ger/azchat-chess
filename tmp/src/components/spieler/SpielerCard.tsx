import {useRegionalCopy} from '../../i18n/regionalCopy';
import type { SpielerPlayer } from '../../services/spieler';
import VorbereitungLink from './VorbereitungLink';

export default function SpielerCard({ player,onPrepare }: { player: SpielerPlayer;onPrepare?:()=>void }) {
  const tr=useRegionalCopy();
  return <div className="spieler-card">
    <p className="spieler-eyebrow">{tr('FIDE-Spieler')} · {player.federation}</p>
    <h2>{player.title ? player.title + ' ' : ''}{player.name}</h2>
    <dl><div><dt>{tr('Verein')}</dt><dd>{player.club || '—'}</dd></div>
      <div><dt>FIDE</dt><dd>{player.fide_rating ?? '—'}</dd></div>
      <div><dt>{tr('Titel')}</dt><dd>{player.title || '—'}</dd></div><div><dt>DWZ</dt><dd>—</dd></div></dl>
    <details className="section-info"><summary>{tr('Info')}</summary><p className="spieler-muted">FIDE-ID {player.fide_id} · {tr('FIDE, Stand:')} {player.source_date}. {tr('Vereinsangaben stammen ausschließlich vom bestätigten Profilinhaber.')}</p>
    <p className="spieler-muted">{tr('DWZ/DeWIS erst nach schriftlicher DSB-Freigabe.')}</p></details>
    {onPrepare&&import.meta.env.VITE_VORBEREITUNG_ENABLED==='true'?<button type="button" onClick={onPrepare}>{tr('Vorbereitung')}</button>:<VorbereitungLink fideId={player.fide_id} playerName={player.name}/>}
  </div>;
}
