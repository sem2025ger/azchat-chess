import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createSpielerApi, openSpielerAnalysis, SpielerError, type SpielerPlayer, type SpielerGames } from '../services/spieler';
import './SpielerScreen.css';

function message(error: unknown) {
  if (error instanceof SpielerError) {
    if (error.code === 'feature_disabled') return 'Spieler ist derzeit deaktiviert.';
    if (error.code === 'claim_exists') return 'Für dein Konto liegt bereits eine andere Profilanfrage vor.';
    if (error.code === 'authentication_required') return 'Bitte melde dich zuerst über dein Profil an.';
    if (error.code === 'rate_limit') return 'Bitte warte kurz und versuche es erneut.';
    if (error.code === 'invalid_query') return 'Bitte gib mindestens zwei Buchstaben des Nachnamens ein.';
  }
  return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es später erneut.';
}
export function SpielerCard({ player }: { player: SpielerPlayer }) {
  return <div className="spieler-card">
    <p className="spieler-eyebrow">FIDE-Spieler · {player.federation}</p>
    <h2>{player.title ? player.title + ' ' : ''}{player.name}</h2>
    <dl><div><dt>Verein</dt><dd>{player.club || '—'}</dd></div>
      <div><dt>FIDE</dt><dd>{player.fide_rating ?? '—'}</dd></div>
      <div><dt>Titel</dt><dd>{player.title || '—'}</dd></div><div><dt>DWZ</dt><dd>—</dd></div></dl>
    <p className="spieler-muted">FIDE-ID {player.fide_id} · Datenstand {player.source_date}. Vereinsangaben werden separat freiwillig angegeben.</p>
    <p className="spieler-muted">DWZ/DeWIS erst nach schriftlicher DSB-Freigabe.</p>
  </div>;
}
export default function SpielerScreen() {
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<SpielerPlayer[]>([]);
  const [selected, setSelected] = useState<SpielerPlayer | null>(null);
  const [tab, setTab] = useState<'profile' | 'games'>('profile');
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState('lichess');
  const [nickname, setNickname] = useState('');
  const [games, setGames] = useState<SpielerGames | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const { session } = useAuth(); const navigate = useNavigate();
  useEffect(() => () => pending.current?.abort(), []);
  function start() { pending.current?.abort(); const c = new AbortController(); pending.current = c; setError(''); setNotice(''); setBusy(true); return c; }
  function api() { return createSpielerApi(import.meta.env.VITE_SERVER_URL || ''); }
  async function search(event: FormEvent) {
    event.preventDefault(); const c = start(); setSelected(null); setGames(null); setSearched(false);
    try { const found = await api().search(query.trim(), c.signal); if (!c.signal.aborted) { setPlayers(found); setSearched(true); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  function choose(player: SpielerPlayer) { pending.current?.abort(); setBusy(false); setSelected(player); setTab('profile'); setGames(null); setLoaded(false); setNickname(''); setNotice(''); setError(''); }
  async function action(kind: 'claim' | 'hide') {
    if (!selected) return;
    if (!session) { setError('Bitte melde dich zuerst über dein Profil an.'); return; }
    const c = start();
    try { const result = await api().action(String(selected.fide_id), kind, session.access_token, c.signal);
      if (c.signal.aborted) return;
      if (kind === 'hide' && result.status === 'approved') { setPlayers(p => p.filter(x => x.fide_id !== selected.fide_id)); setSelected(null); setGames(null); setNotice('Profil ausgeblendet.'); }
      else setNotice(kind === 'claim' && result.status === 'verified' ? 'Dieses Profil ist deinem Konto zugeordnet.' : 'Anfrage eingegangen. Die Identität wird vor einer Zuordnung oder Ausblendung geprüft.');
    } catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function loadGames(event: FormEvent) {
    event.preventDefault(); if (!selected) return; const c = start(); setGames(null); setLoaded(false);
    try { const result = await api().games(String(selected.fide_id), source, nickname.trim(), c.signal); if (!c.signal.aborted) { setGames(result); setLoaded(true); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  function analyse(pgn: string) { try { navigate(openSpielerAnalysis(pgn)); } catch { setError('Diese Partie kann nicht in der Analyse geöffnet werden.'); } }
  return <section className="spieler-page">
    <header><p className="spieler-eyebrow">ChessAZ · Spieler v1</p><h1>Spieler</h1><p>Nach Namen suchen. Öffentliche Partien entdecken.</p></header>
    <form className="spieler-search" onSubmit={search}><label htmlFor="spieler-surname">Nachname</label>
      <div><input id="spieler-surname" minLength={2} maxLength={100} required value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" /><button disabled={busy} type="submit">Suchen</button></div></form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p role="status">Wird geladen …</p>}
    <div className="spieler-columns"><section aria-label="Suchergebnisse">
      {searched && !players.length && <p>Keine Spieler gefunden.</p>}
      <ul className="spieler-results">{players.map(p => <li key={p.fide_id}><button type="button" aria-pressed={selected?.fide_id === p.fide_id} onClick={() => choose(p)}><strong>{p.title} {p.name}</strong><span>{p.club || 'Verein —'} · FIDE {p.fide_rating ?? '—'}</span></button></li>)}</ul>
    </section>{selected && <section aria-label="Spielerkarte">
      <div className="spieler-tabs" role="tablist" aria-label="Spielerinformationen" onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'profile' : e.key === 'End' ? 'games' : tab === 'profile' ? 'games' : 'profile'; setTab(next); document.getElementById('spieler-tab-' + next)?.focus(); } }}>
        {(['profile', 'games'] as const).map(t => <button key={t} id={'spieler-tab-' + t} role="tab" type="button" tabIndex={tab === t ? 0 : -1} aria-controls={'spieler-panel-' + t} aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'profile' ? 'Profil' : 'Partien'}</button>)}
      </div>
      <div role="tabpanel" id={'spieler-panel-' + tab} aria-labelledby={'spieler-tab-' + tab}>
        {tab === 'profile' ? <><SpielerCard player={selected} /><div className="spieler-actions"><button disabled={busy} onClick={() => void action('claim')}>Das bin ich</button><button disabled={busy} onClick={() => void action('hide')}>Profil ausblenden</button></div><p className="spieler-muted">Eine Anfrage bestätigt keine Identität. Fremde Profile können nicht eigenständig ausgeblendet werden.</p></> : <>
          <h2>Partien</h2><p className="spieler-muted">Bis zu 25 Partien als Stichprobe. Ein eingegebener Online-Nickname ist keine bestätigte Zuordnung zu dieser Person. TWIC verwendet FIDE-IDs aus importierten PGNs.</p>
          <form onSubmit={loadGames} className="spieler-provider"><label>Quelle<select value={source} onChange={e => { pending.current?.abort(); setBusy(false); setSource(e.target.value); setGames(null); setLoaded(false); }}><option value="lichess">Lichess</option><option value="chesscom">Chess.com</option><option value="twic">TWIC</option></select></label>
            {source !== 'twic' && <label>Online-Nickname<input required minLength={2} maxLength={30} pattern="[A-Za-z0-9_-]+" value={nickname} onChange={e => setNickname(e.target.value)} /></label>}<button disabled={busy}>Partien laden</button></form>
          {loaded && !games?.games.length && <p>Keine Partien in dieser Quelle verfügbar.</p>}
          {games && <><h3>Eröffnungen dieser Stichprobe</h3><ul>{games.openings.map(o => <li key={o.name}>{o.name} · {o.count}</li>)}</ul>{games.rejected > 0 && <p>{games.rejected} nicht unterstützte oder ungültige Partien ausgelassen.</p>}
            <ul className="spieler-games">{games.games.map(g => <li key={g.id}><strong>{g.white} – {g.black}</strong><span>{g.result} · {g.date} · {g.eco} {g.opening}</span><button onClick={() => analyse(g.pgn)}>In Analyse öffnen</button></li>)}</ul></>}
        </>}
      </div>
    </section>}</div>
  </section>;
}
