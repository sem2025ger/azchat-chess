import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
const playerUiCopy: Record<string,Record<string,string>> = {"Spieler":{"de":"Spieler","en":"Players","az":"Oyunçular","tr":"Oyuncular","ua":"Гравці","ru":"Игроки"},"Nach Namen suchen. Öffentliche Partien entdecken.":{"de":"Nach Namen suchen. Öffentliche Partien entdecken.","en":"Find players by name. Explore public games.","az":"Ada görə axtarın. Açıq partiyaları kəşf edin.","tr":"İsme göre arayın. Herkese açık oyunları keşfedin.","ua":"Шукайте за ім’ям. Переглядайте відкриті партії.","ru":"Ищите по имени. Изучайте открытые партии."},"Nachname":{"de":"Nachname","en":"Last name","az":"Soyad","tr":"Soyadı","ua":"Прізвище","ru":"Фамилия"},"Suchen":{"de":"Suchen","en":"Search","az":"Axtar","tr":"Ara","ua":"Пошук","ru":"Поиск"},"Wird geladen …":{"de":"Wird geladen …","en":"Loading…","az":"Yüklənir…","tr":"Yükleniyor…","ua":"Завантаження…","ru":"Загрузка…"},"Suchergebnisse":{"de":"Suchergebnisse","en":"Search results","az":"Axtarış nəticələri","tr":"Arama sonuçları","ua":"Результати пошуку","ru":"Результаты поиска"},"Keine Spieler gefunden.":{"de":"Keine Spieler gefunden.","en":"No players found.","az":"Oyunçu tapılmadı.","tr":"Oyuncu bulunamadı.","ua":"Гравців не знайдено.","ru":"Игроки не найдены."},"Spielerkarte":{"de":"Spielerkarte","en":"Player card","az":"Oyunçu kartı","tr":"Oyuncu kartı","ua":"Картка гравця","ru":"Карточка игрока"},"Spielerinformationen":{"de":"Spielerinformationen","en":"Player information","az":"Oyunçu məlumatları","tr":"Oyuncu bilgileri","ua":"Інформація про гравця","ru":"Информация об игроке"},"Profil":{"de":"Profil","en":"Profile","az":"Profil","tr":"Profil","ua":"Профіль","ru":"Профиль"},"Partien":{"de":"Partien","en":"Games","az":"Partiyalar","tr":"Oyunlar","ua":"Партії","ru":"Партии"},"Mein Verein (freiwillig)":{"de":"Mein Verein (freiwillig)","en":"My club (optional)","az":"Mənim klubum (istəyə bağlı)","tr":"Kulübüm (isteğe bağlı)","ua":"Мій клуб (необов’язково)","ru":"Мой клуб (необязательно)"},"Kein Verein ausgewählt":{"de":"Kein Verein ausgewählt","en":"No club selected","az":"Klub seçilməyib","tr":"Kulüp seçilmedi","ua":"Клуб не вибрано","ru":"Клуб не выбран"},"Das bin ich":{"de":"Das bin ich","en":"This is me","az":"Bu mənəm","tr":"Bu benim","ua":"Це я","ru":"Это я"},"Profil ausblenden":{"de":"Profil ausblenden","en":"Hide profile","az":"Profili gizlət","tr":"Profili gizle","ua":"Приховати профіль","ru":"Скрыть профиль"},"Quelle":{"de":"Quelle","en":"Source","az":"Mənbə","tr":"Kaynak","ua":"Джерело","ru":"Источник"},"Online-Nickname":{"de":"Online-Nickname","en":"Online nickname","az":"Onlayn ləqəb","tr":"Çevrimiçi takma ad","ua":"Нікнейм онлайн","ru":"Онлайн-никнейм"},"Partien laden":{"de":"Partien laden","en":"Load games","az":"Partiyaları yüklə","tr":"Oyunları yükle","ua":"Завантажити партії","ru":"Загрузить партии"},"Keine Partien in dieser Quelle verfügbar.":{"de":"Keine Partien in dieser Quelle verfügbar.","en":"No games available from this source.","az":"Bu mənbədə partiya yoxdur.","tr":"Bu kaynakta oyun bulunmuyor.","ua":"У цьому джерелі немає партій.","ru":"В этом источнике нет партий."},"Eröffnungen dieser Stichprobe":{"de":"Eröffnungen dieser Stichprobe","en":"Openings in this sample","az":"Bu nümunədə debütlər","tr":"Bu örnekteki açılışlar","ua":"Дебюти у цій вибірці","ru":"Дебюты в этой выборке"},"In Analyse öffnen":{"de":"In Analyse öffnen","en":"Open in analysis","az":"Analizdə aç","tr":"Analizde aç","ua":"Відкрити в аналізі","ru":"Открыть в анализе"},"Verein —":{"de":"Verein —","en":"Club —","az":"Klub —","tr":"Kulüp —","ua":"Клуб —","ru":"Клуб —"},"Bitte melde dich zuerst über dein Profil an.":{"de":"Bitte melde dich zuerst über dein Profil an.","en":"Please sign in through your profile first.","az":"Əvvəlcə profilinizə daxil olun.","tr":"Önce profilinize giriş yapın.","ua":"Спочатку увійдіть у профіль.","ru":"Сначала войдите в профиль."}};
const translatePlayer=(value:string,language:string)=>playerUiCopy[value]?.[language]||value;
import { createSpielerApi, openSpielerAnalysis, SpielerError, type SpielerPlayer, type SpielerGames } from '../services/spieler';
import './SpielerScreen.css';
import NamedPreparation from '../components/spieler/NamedPreparation';
import SpielerCard from '../components/spieler/SpielerCard';
import SpielerAccountLabel from '../components/spieler/SpielerAccountLabel';

function message(error: unknown) {
  if (error instanceof SpielerError) {
    if (error.code === 'feature_disabled') return 'Spieler ist derzeit deaktiviert.';
    if (error.code === 'claim_exists') return 'Für dein Konto liegt bereits eine andere Profilanfrage vor.';
    if (error.code === 'hide_limit') return 'Deine Anfrage wurde zur Prüfung gespeichert. Diese Anfrage blendet das Profil noch nicht aus, da bereits drei Ausblendungen auf eine Prüfung warten.';
    if (error.code === 'authentication_required') return 'Bitte melde dich zuerst über dein Profil an.';
    if (error.code === 'rate_limit') return 'Bitte warte kurz und versuche es erneut.';
    if (error.code === 'invalid_query') return 'Bitte gib mindestens zwei Buchstaben des Nachnamens ein.';
  }
  return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es später erneut.';
}
export default function SpielerScreen() {
  const {language}=useLanguage();const tr=(value:string)=>translatePlayer(value,language);
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
  const [club, setClub] = useState('');
  const [availableClubs, setAvailableClubs] = useState<{id:string;name:string;city:string}[]>([]);
  const [games, setGames] = useState<SpielerGames | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<{ source: string; nickname: string } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const { session } = useAuth(); const navigate = useNavigate();
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (import.meta.env.VITE_CLUBS_NRW_ENABLED !== 'true') return;
    let active=true; void supabase.from('clubs_nrw').select('id,name,city').eq('published',true).order('name').then(({data,error})=>{if(active&&!error)setAvailableClubs(data||[]);});
    return ()=>{active=false;}; }, []);
  useEffect(() => {
    pending.current?.abort(); setPlayers([]); setSelected(null); setGames(null);
    setLoaded(false); setLoadedAccount(null); setSearched(false); setBusy(false); setNotice(''); setError('');
  }, [session?.access_token]);
  function start() { pending.current?.abort(); const c = new AbortController(); pending.current = c; setError(''); setNotice(''); setBusy(true); return c; }
  function api() { return createSpielerApi(import.meta.env.VITE_SERVER_URL || ''); }
  async function search(event: FormEvent) {
    event.preventDefault(); const c = start(); setSelected(null); setGames(null); setLoadedAccount(null); setSearched(false);
    try { const found = await api().search(query.trim(), session?.access_token || '', c.signal); if (!c.signal.aborted) { setPlayers(found); setSearched(true); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  function choose(player: SpielerPlayer) { pending.current?.abort(); setBusy(false); setSelected(player); setTab('profile'); setGames(null); setLoaded(false); setLoadedAccount(null); setNickname(''); setClub(''); setNotice(''); setError(''); }
  async function action(kind: 'claim' | 'hide') {
    if (!selected) return;
    if (!session) { setError('Bitte melde dich zuerst über dein Profil an.'); return; }
    const c = start();
    try { const result = await api().action(String(selected.fide_id), kind, session.access_token, c.signal, kind === 'claim' ? club : undefined);
      if (c.signal.aborted) return;
      if (kind === 'hide' && ['hidden_pending_review', 'approved'].includes(result.status)) { setPlayers(p => p.filter(x => x.fide_id !== selected.fide_id)); setSelected(null); setGames(null); setNotice('Profil sofort ausgeblendet. Die Anfrage wird geprüft.'); }
      else setNotice(kind === 'claim' && result.status === 'verified' ? 'Dieses Profil ist deinem Konto zugeordnet.' : 'Anfrage eingegangen. Die Identität wird vor einer Zuordnung geprüft.');
    } catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function loadGames(event: FormEvent) {
    event.preventDefault(); if (!selected) return; const c = start(); setGames(null); setLoaded(false); setLoadedAccount(null);
    try { const result = await api().games(String(selected.fide_id), source, nickname.trim(), session?.access_token || '', c.signal); if (!c.signal.aborted) { setGames(result); setLoadedAccount({ source, nickname: nickname.trim() }); setLoaded(true); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  function analyse(pgn: string) { try { navigate(openSpielerAnalysis(pgn)); } catch { setError('Diese Partie kann nicht in der Analyse geöffnet werden.'); } }
  return <section className="spieler-page">
    <header><p className="spieler-eyebrow">ChessAZ · Spieler v1</p><h1>{tr("Spieler")}</h1><p>{tr("Nach Namen suchen. Öffentliche Partien entdecken.")}</p></header>
    {!session && <p role="status">Bitte melde dich zuerst über dein Profil an, um Spieler zu suchen.</p>}
    <form className="spieler-search" onSubmit={search}><label htmlFor="spieler-surname">{tr("Nachname")}</label>
      <div><input id="spieler-surname" minLength={2} maxLength={100} required value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" /><button disabled={busy || !session} type="submit">{tr("Suchen")}</button></div></form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p role="status">{tr("Wird geladen …")}</p>}
    <div className="spieler-columns"><section aria-label={tr("Suchergebnisse")}>
      {searched && !players.length && <p>{tr("Keine Spieler gefunden.")}</p>}
      <ul className="spieler-results">{players.map(p => <li key={p.fide_id}><button type="button" aria-pressed={selected?.fide_id === p.fide_id} onClick={() => choose(p)}><strong>{p.title} {p.name}</strong><span>{p.club || 'Verein —'} · FIDE {p.fide_rating ?? '—'}</span></button></li>)}</ul>
    </section>{selected && <section aria-label={tr("Spielerkarte")}>
      <div className="spieler-tabs" role="tablist" aria-label={tr("Spielerinformationen")} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'profile' : e.key === 'End' ? 'games' : tab === 'profile' ? 'games' : 'profile'; setTab(next); document.getElementById('spieler-tab-' + next)?.focus(); } }}>
        {(['profile', 'games'] as const).map(t => <button key={t} id={'spieler-tab-' + t} role="tab" type="button" tabIndex={tab === t ? 0 : -1} aria-controls={'spieler-panel-' + t} aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'profile' ? 'Profil' : 'Partien'}</button>)}
      </div>
      <div role="tabpanel" id={'spieler-panel-' + tab} aria-labelledby={'spieler-tab-' + tab}>
        {tab === 'profile' ? <><SpielerCard player={selected} /><label>{tr("Mein Verein (freiwillig)")}<select value={club} onChange={e => setClub(e.target.value)} disabled={import.meta.env.VITE_CLUBS_NRW_ENABLED !== 'true'}><option value="">{tr("Kein Verein ausgewählt")}</option>{availableClubs.map(c=><option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}</select></label><div className="spieler-actions"><button disabled={busy} onClick={() => void action('claim')}>{tr("Das bin ich")}</button><button disabled={busy} onClick={() => void action('hide')}>{tr("Profil ausblenden")}</button></div><p className="spieler-muted">Eine Anfrage bestätigt keine Identität. Deine Vereinsangabe wird erst nach bestätigter Zuordnung sichtbar. Bis zu drei Ausblendungen wirken sofort bis zur Prüfung. Weitere Anfragen werden zuerst geprüft. Dein bestätigtes eigenes Profil kannst du immer sofort ausblenden.</p></> : import.meta.env.VITE_VORBEREITUNG_ENABLED==='true' ? <NamedPreparation key={session?.access_token+':'+selected.fide_id} token={session?.access_token||''} initialFideId={String(selected.fide_id)} initialName={selected.name}/> : <>
          <h2>{tr("Partien")}</h2><p className="spieler-muted">Bis zu 25 Partien als Stichprobe. Ein eingegebener Online-Nickname ist keine bestätigte Zuordnung zu dieser Person. TWIC verwendet FIDE-IDs aus importierten PGNs.</p>
          <form onSubmit={loadGames} className="spieler-provider"><label>{tr("Quelle")}<select value={source} onChange={e => { pending.current?.abort(); setBusy(false); setSource(e.target.value); setGames(null); setLoaded(false); setLoadedAccount(null); }}><option value="lichess">Lichess</option><option value="chesscom">Chess.com</option><option value="twic">TWIC</option></select></label>
            {source !== 'twic' && <label>{tr("Online-Nickname")}<input required minLength={2} maxLength={30} pattern="[A-Za-z0-9_-]+" value={nickname} onChange={e => setNickname(e.target.value)} /></label>}<button disabled={busy}>{tr("Partien laden")}</button></form>
          {loaded && !games?.games.length && <p>{tr("Keine Partien in dieser Quelle verfügbar.")}</p>}
          {loadedAccount && <SpielerAccountLabel source={loadedAccount.source} nickname={loadedAccount.nickname} />}
          {games && <><h3>{tr("Eröffnungen dieser Stichprobe")}</h3><ul>{games.openings.map(o => <li key={o.name}>{o.name} · {o.count}</li>)}</ul>{games.rejected > 0 && <p>{games.rejected} nicht unterstützte oder ungültige Partien ausgelassen.</p>}
            <ul className="spieler-games">{games.games.map(g => <li key={g.id}><strong>{g.white} – {g.black}</strong><span>{g.result} · {g.date} · {g.eco} {g.opening}</span><button onClick={() => analyse(g.pgn)}>{tr("In Analyse öffnen")}</button></li>)}</ul></>}
        </>}
      </div>
    </section>}</div>
  </section>;
}
