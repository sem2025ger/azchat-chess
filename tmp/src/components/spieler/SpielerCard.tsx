import type { SpielerPlayer } from '../../services/spieler';

export default function SpielerCard({ player }: { player: SpielerPlayer }) {
  return <div className="spieler-card">
    <p className="spieler-eyebrow">FIDE-Spieler · {player.federation}</p>
    <h2>{player.title ? player.title + ' ' : ''}{player.name}</h2>
    <dl><div><dt>Verein</dt><dd>{player.club || '—'}</dd></div>
      <div><dt>FIDE</dt><dd>{player.fide_rating ?? '—'}</dd></div>
      <div><dt>Titel</dt><dd>{player.title || '—'}</dd></div><div><dt>DWZ</dt><dd>—</dd></div></dl>
    <p className="spieler-muted">FIDE-ID {player.fide_id} · FIDE, Stand: {player.source_date}. Vereinsangaben stammen ausschließlich vom bestätigten Profilinhaber.</p>
    <p className="spieler-muted">DWZ/DeWIS erst nach schriftlicher DSB-Freigabe.</p>
  </div>;
}
