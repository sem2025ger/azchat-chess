import { translateSectionCopy } from '../i18n/sectionCopy';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
const playerUiCopy: Record<string,Record<string,string>> = {"Spieler":{"de":"Spieler","en":"Players","az":"Oyunçular","tr":"Oyuncular","ua":"Гравці","ru":"Игроки"},"Nach Namen suchen. Öffentliche Partien entdecken.":{"de":"Nach Namen suchen. Öffentliche Partien entdecken.","en":"Find players by name. Explore public games.","az":"Ada görə axtarın. Açıq partiyaları kəşf edin.","tr":"İsme göre arayın. Herkese açık oyunları keşfedin.","ua":"Шукайте за ім’ям. Переглядайте відкриті партії.","ru":"Ищите по имени. Изучайте открытые партии."},"Nachname":{"de":"Nachname","en":"Last name","az":"Soyad","tr":"Soyadı","ua":"Прізвище","ru":"Фамилия"},"Suchen":{"de":"Suchen","en":"Search","az":"Axtar","tr":"Ara","ua":"Пошук","ru":"Поиск"},"Wird geladen …":{"de":"Wird geladen …","en":"Loading…","az":"Yüklənir…","tr":"Yükleniyor…","ua":"Завантаження…","ru":"Загрузка…"},"Suchergebnisse":{"de":"Suchergebnisse","en":"Search results","az":"Axtarış nəticələri","tr":"Arama sonuçları","ua":"Результати пошуку","ru":"Результаты поиска"},"Keine Spieler gefunden.":{"de":"Keine Spieler gefunden.","en":"No players found.","az":"Oyunçu tapılmadı.","tr":"Oyuncu bulunamadı.","ua":"Гравців не знайдено.","ru":"Игроки не найдены."},"Spielerkarte":{"de":"Spielerkarte","en":"Player card","az":"Oyunçu kartı","tr":"Oyuncu kartı","ua":"Картка гравця","ru":"Карточка игрока"},"Spielerinformationen":{"de":"Spielerinformationen","en":"Player information","az":"Oyunçu məlumatları","tr":"Oyuncu bilgileri","ua":"Інформація про гравця","ru":"Информация об игроке"},"Profil":{"de":"Profil","en":"Profile","az":"Profil","tr":"Profil","ua":"Профіль","ru":"Профиль"},"Partien":{"de":"Partien","en":"Games","az":"Partiyalar","tr":"Oyunlar","ua":"Партії","ru":"Партии"},"Mein Verein (freiwillig)":{"de":"Mein Verein (freiwillig)","en":"My club (optional)","az":"Mənim klubum (istəyə bağlı)","tr":"Kulübüm (isteğe bağlı)","ua":"Мій клуб (необов’язково)","ru":"Мой клуб (необязательно)"},"Kein Verein ausgewählt":{"de":"Kein Verein ausgewählt","en":"No club selected","az":"Klub seçilməyib","tr":"Kulüp seçilmedi","ua":"Клуб не вибрано","ru":"Клуб не выбран"},"Das bin ich":{"de":"Das bin ich","en":"This is me","az":"Bu mənəm","tr":"Bu benim","ua":"Це я","ru":"Это я"},"Profil ausblenden":{"de":"Profil ausblenden","en":"Hide profile","az":"Profili gizlət","tr":"Profili gizle","ua":"Приховати профіль","ru":"Скрыть профиль"},"Quelle":{"de":"Quelle","en":"Source","az":"Mənbə","tr":"Kaynak","ua":"Джерело","ru":"Источник"},"Online-Nickname":{"de":"Online-Nickname","en":"Online nickname","az":"Onlayn ləqəb","tr":"Çevrimiçi takma ad","ua":"Нікнейм онлайн","ru":"Онлайн-никнейм"},"Partien laden":{"de":"Partien laden","en":"Load games","az":"Partiyaları yüklə","tr":"Oyunları yükle","ua":"Завантажити партії","ru":"Загрузить партии"},"Keine Partien in dieser Quelle verfügbar.":{"de":"Keine Partien in dieser Quelle verfügbar.","en":"No games available from this source.","az":"Bu mənbədə partiya yoxdur.","tr":"Bu kaynakta oyun bulunmuyor.","ua":"У цьому джерелі немає партій.","ru":"В этом источнике нет партий."},"Eröffnungen dieser Stichprobe":{"de":"Eröffnungen dieser Stichprobe","en":"Openings in this sample","az":"Bu nümunədə debütlər","tr":"Bu örnekteki açılışlar","ua":"Дебюти у цій вибірці","ru":"Дебюты в этой выборке"},"In Analyse öffnen":{"de":"In Analyse öffnen","en":"Open in analysis","az":"Analizdə aç","tr":"Analizde aç","ua":"Відкрити в аналізі","ru":"Открыть в анализе"},"Verein —":{"de":"Verein —","en":"Club —","az":"Klub —","tr":"Kulüp —","ua":"Клуб —","ru":"Клуб —"},"Bitte melde dich zuerst über dein Profil an.":{"de":"Bitte melde dich zuerst über dein Profil an.","en":"Please sign in through your profile first.","az":"Əvvəlcə profilinizə daxil olun.","tr":"Önce profilinize giriş yapın.","ua":"Спочатку увійдіть у профіль.","ru":"Сначала войдите в профиль."},"Bitte melde dich zuerst über dein Profil an, um Spieler zu suchen.":{"de":"Bitte melde dich zuerst über dein Profil an, um Spieler zu suchen.","en":"Sign in through your profile to search players.","az":"Oyunçu axtarmaq üçün profilinizə daxil olun.","tr":"Oyuncu aramak için profilinizden giriş yapın.","ua":"Увійдіть у профіль, щоб шукати гравців.","ru":"Войдите в профиль, чтобы искать игроков."},"Eine Anfrage bestätigt keine Identität. Deine Vereinsangabe wird erst nach bestätigter Zuordnung sichtbar. Bis zu drei Ausblendungen wirken sofort bis zur Prüfung. Weitere Anfragen werden zuerst geprüft. Dein bestätigtes eigenes Profil kannst du immer sofort ausblenden.":{"de":"Eine Anfrage bestätigt keine Identität. Deine Vereinsangabe wird erst nach bestätigter Zuordnung sichtbar. Bis zu drei Ausblendungen wirken sofort bis zur Prüfung. Weitere Anfragen werden zuerst geprüft. Dein bestätigtes eigenes Profil kannst du immer sofort ausblenden.","en":"A request does not verify identity. Your club is shown only after confirmation. Up to three hide requests take effect pending review; further requests require review first. You can always hide your verified own profile.","az":"Sorğu şəxsiyyəti təsdiqləmir. Klub yalnız təsdiqdən sonra görünür. Üç gizlətmə sorğusu yoxlamaya qədər dərhal qüvvəyə minir; sonrakılar əvvəl yoxlanılır. Təsdiqli profilinizi həmişə gizlədə bilərsiniz.","tr":"Talep kimliği doğrulamaz. Kulüp bilgisi yalnızca onaydan sonra görünür. Üç gizleme talebi inceleme süresince hemen geçerlidir; sonrakiler önce incelenir. Doğrulanmış profilinizi her zaman gizleyebilirsiniz.","ua":"Запит не підтверджує особу. Клуб видно лише після перевірки. До трьох запитів на приховування діють одразу до перевірки; наступні спочатку перевіряють. Свій підтверджений профіль можна приховати завжди.","ru":"Запрос не подтверждает личность. Клуб отображается только после проверки. До трёх запросов на скрытие действуют сразу до проверки; последующие сначала проверяются. Свой подтверждённый профиль можно скрыть всегда."},"Bis zu 25 Partien als Stichprobe. Ein eingegebener Online-Nickname ist keine bestätigte Zuordnung zu dieser Person. TWIC verwendet FIDE-IDs aus importierten PGNs.":{"de":"Bis zu 25 Partien als Stichprobe. Ein eingegebener Online-Nickname ist keine bestätigte Zuordnung zu dieser Person. TWIC verwendet FIDE-IDs aus importierten PGNs.","en":"Sample of up to 25 games. An online nickname does not verify a player's identity. TWIC uses FIDE IDs from imported PGNs.","az":"25 partiyaya qədər nümunə. Onlayn ləqəb şəxsiyyəti təsdiqləmir. TWIC idxal olunmuş PGN-lərdəki FIDE ID-lərindən istifadə edir.","tr":"En fazla 25 oyunluk örnek. Çevrimiçi takma ad kimliği doğrulamaz. TWIC içe aktarılan PGN'lerdeki FIDE ID'leri kullanır.","ua":"Вибірка до 25 партій. Онлайн-нікнейм не підтверджує особу. TWIC використовує FIDE ID з імпортованих PGN.","ru":"Выборка до 25 партий. Онлайн-никнейм не подтверждает личность. TWIC использует FIDE ID из импортированных PGN."},"Spieler ist derzeit deaktiviert.":{"de":"Spieler ist derzeit deaktiviert.","en":"Players are currently disabled.","az":"Oyunçular bölməsi hazırda deaktivdir.","tr":"Oyuncular bölümü şu anda kapalı.","ua":"Розділ гравців зараз вимкнено.","ru":"Раздел игроков сейчас отключён."},"Für dein Konto liegt bereits eine andere Profilanfrage vor.":{"de":"Für dein Konto liegt bereits eine andere Profilanfrage vor.","en":"Another profile claim already exists for your account.","az":"Hesabınız üçün artıq başqa profil sorğusu var.","tr":"Hesabınız için zaten başka bir profil talebi var.","ua":"Для вашого акаунта вже є інший запит на профіль.","ru":"Для вашего аккаунта уже есть другой запрос на профиль."},"Deine Anfrage wurde zur Prüfung gespeichert. Diese Anfrage blendet das Profil noch nicht aus, da bereits drei Ausblendungen auf eine Prüfung warten.":{"de":"Deine Anfrage wurde zur Prüfung gespeichert. Diese Anfrage blendet das Profil noch nicht aus, da bereits drei Ausblendungen auf eine Prüfung warten.","en":"Your request was saved for review. This profile remains visible because three other hide requests are pending.","az":"Sorğu yoxlama üçün saxlandı. Üç gizlətmə sorğusu gözlədiyinə görə bu profil hələ görünür.","tr":"Talebiniz inceleme için kaydedildi. Üç gizleme talebi beklediği için profil henüz gizlenmedi.","ua":"Запит збережено для перевірки. Профіль поки видимий, оскільки три запити вже очікують перевірки.","ru":"Запрос сохранён на проверку. Профиль пока виден, так как три запроса уже ожидают проверки."},"Bitte warte kurz und versuche es erneut.":{"de":"Bitte warte kurz und versuche es erneut.","en":"Please wait and try again.","az":"Bir az gözləyib yenidən cəhd edin.","tr":"Biraz bekleyip tekrar deneyin.","ua":"Зачекайте і спробуйте знову.","ru":"Подождите и повторите попытку."},"Bitte gib mindestens zwei Buchstaben des Nachnamens ein.":{"de":"Bitte gib mindestens zwei Buchstaben des Nachnamens ein.","en":"Enter at least two letters of the last name.","az":"Soyadın ən azı iki hərfini daxil edin.","tr":"Soyadın en az iki harfini girin.","ua":"Введіть щонайменше дві літери прізвища.","ru":"Введите минимум две буквы фамилии."},"Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es später erneut.":{"de":"Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es später erneut.","en":"Could not complete the request. Try again later.","az":"Sorğu tamamlanmadı. Daha sonra yenidən cəhd edin.","tr":"Talep tamamlanamadı. Daha sonra tekrar deneyin.","ua":"Не вдалося завершити запит. Спробуйте пізніше.","ru":"Не удалось завершить запрос. Попробуйте позже."},"Profil sofort ausgeblendet. Die Anfrage wird geprüft.":{"de":"Profil sofort ausgeblendet. Die Anfrage wird geprüft.","en":"Profile hidden immediately. Request under review.","az":"Profil dərhal gizlədildi. Sorğu yoxlanılır.","tr":"Profil hemen gizlendi. Talep inceleniyor.","ua":"Профіль приховано. Запит перевіряється.","ru":"Профиль сразу скрыт. Запрос проверяется."},"Dieses Profil ist deinem Konto zugeordnet.":{"de":"Dieses Profil ist deinem Konto zugeordnet.","en":"This profile is linked to your account.","az":"Bu profil hesabınıza bağlıdır.","tr":"Bu profil hesabınıza bağlıdır.","ua":"Цей профіль пов’язано з акаунтом.","ru":"Этот профиль привязан к аккаунту."},"Anfrage eingegangen. Die Identität wird vor einer Zuordnung geprüft.":{"de":"Anfrage eingegangen. Die Identität wird vor einer Zuordnung geprüft.","en":"Request received. Identity will be checked before linking.","az":"Sorğu qəbul edildi. Bağlamadan əvvəl şəxsiyyət yoxlanacaq.","tr":"Talep alındı. Eşleştirmeden önce kimlik kontrol edilir.","ua":"Запит отримано. Особу перевірять перед прив’язкою.","ru":"Запрос получен. Перед привязкой проверят личность."},"Diese Partie kann nicht in der Analyse geöffnet werden.":{"de":"Diese Partie kann nicht in der Analyse geöffnet werden.","en":"This game cannot be opened in analysis.","az":"Bu partiya analizdə açıla bilmir.","tr":"Bu oyun analizde açılamıyor.","ua":"Цю партію не можна відкрити в аналізі.","ru":"Эту партию нельзя открыть в анализе."},"nicht unterstützte oder ungültige Partien ausgelassen.":{"de":"nicht unterstützte oder ungültige Partien ausgelassen.","en":"unsupported or invalid games excluded.","az":"dəstəklənməyən və ya yanlış partiya çıxarıldı.","tr":"desteklenmeyen veya geçersiz oyun çıkarıldı.","ua":"непідтримувані або некоректні партії пропущено.","ru":"неподдерживаемых или некорректных партий пропущено."}};
const translatePlayer=(value:string,language:string)=>playerUiCopy[value]?.[language]||translateSectionCopy(value,language);
import { createSpielerApi, openSpielerAnalysis, SpielerError, type SpielerPlayer, type SpielerGames } from '../services/spieler';
import './SpielerScreen.css';
import '../styles/sections.css';
import NamedPreparation from '../components/spieler/NamedPreparation';
import SpielerCard from '../components/spieler/SpielerCard';
import SpielerAccountLabel from '../components/spieler/SpielerAccountLabel';
import {useRegionalCopy} from '../i18n/regionalCopy';
import {VorbereitungWorkspace} from './VorbereitungScreen';
import GlobalPositionSearch from '../components/spieler/GlobalPositionSearch';
import OpeningPrep from '../components/spieler/OpeningPrep';

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
function SpielerDirectory() {
  const {language}=useLanguage(),regional=useRegionalCopy();const tr=(value:string)=>playerUiCopy[value]?translatePlayer(value,language):regional(value);
  const lookupId=useId(),location=useLocation();const [seed]=useState(()=>location.state||{});
  const [lookupMode,setLookupMode]=useState<'surname'|'fide'|'lichess'>(seed.lichessUsername?'lichess':seed.playerFideId?'fide':'surname'),[loadedNickname,setLoadedNickname]=useState(''),[seedPreparation,setSeedPreparation]=useState<{fideId:string;name:string}|null>(null);
  const [query, setQuery] = useState(seed.lichessUsername||seed.playerFideId||'');
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
    event.preventDefault(); const c = start(); setSelected(null); setGames(null); setLoadedAccount(null); setSearched(false);setLoadedNickname('');setSeedPreparation(null);
    try {if(lookupMode==='lichess'){if(!c.signal.aborted){setLoadedNickname(query.trim());setBusy(false);}return;}
      const found = lookupMode==='fide'?[await api().card(query.trim(),session?.access_token||'',c.signal)]:await api().search(query.trim(), session?.access_token || '', c.signal); if (!c.signal.aborted) { setPlayers(found); setSearched(true); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  function choose(player: SpielerPlayer) { pending.current?.abort(); setBusy(false); setSelected(player); setTab('games'); setGames(null); setLoaded(false); setLoadedAccount(null); setNickname(''); setClub(''); setNotice(''); setError(''); }
  async function action(kind: 'claim' | 'hide', target=selected, selectedClub=club) {
    if (!target) return;
    if (!session) { setError('Bitte melde dich zuerst über dein Profil an.'); return; }
    const c = start();
    try { const result = await api().action(String(target.fide_id), kind, session.access_token, c.signal, kind === 'claim' ? selectedClub : undefined);
      if (c.signal.aborted) return;
      if (kind === 'hide' && ['hidden_pending_review', 'approved'].includes(result.status)) { setPlayers(p => p.filter(x => x.fide_id !== target.fide_id)); setSelected(null); setGames(null); setNotice('Profil sofort ausgeblendet. Die Anfrage wird geprüft.'); }
      else setNotice(kind === 'claim' && result.status === 'verified' ? 'Dieses Profil ist deinem Konto zugeordnet.' : 'Anfrage eingegangen. Die Identität wird vor einer Zuordnung geprüft.');
    } catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  async function loadGames(event: FormEvent) {
    event.preventDefault(); if (!selected) return; const c = start(); setGames(null); setLoaded(false); setLoadedAccount(null);
    try { const result = await api().games(String(selected.fide_id), source, nickname.trim(), session?.access_token || '', c.signal); if (!c.signal.aborted) { setGames(result); setLoadedAccount({ source, nickname: nickname.trim() }); setLoaded(true); } }
    catch (e) { if (!c.signal.aborted) setError(message(e)); } finally { if (!c.signal.aborted) setBusy(false); }
  }
  function analyse(pgn: string) { try { navigate(openSpielerAnalysis(pgn)); } catch { setError('Diese Partie kann nicht in der Analyse geöffnet werden.'); } }
  useEffect(()=>{if(!session?.access_token)return;if(seed.playerFideId)setSeedPreparation({fideId:String(seed.playerFideId),name:seed.playerName||''});else if(seed.lichessUsername)setLoadedNickname(seed.lichessUsername);if(seed.playerFideId||seed.lichessUsername)navigate(location.pathname+location.search,{replace:true,state:null});},[session?.access_token,seed,location.pathname,location.search,navigate]);
  return <section className="spieler-opponent-directory">
    {!session&&<p role="status">{tr('Bitte melde dich zuerst über dein Profil an, um Spieler zu suchen.')}</p>}
    <form className="spieler-search section-card" onSubmit={search}><h2>{tr('Gegner für die Vorbereitung finden')}</h2><fieldset className="position-segment"><legend>{tr('Suchen nach')}</legend><div>{(['surname','fide','lichess'] as const).map(mode=><button type="button" key={mode} aria-pressed={lookupMode===mode} onClick={()=>{pending.current?.abort();setBusy(false);setLookupMode(mode);setQuery('');setPlayers([]);setSelected(null);setLoadedNickname('');setSeedPreparation(null);setSearched(false);}}>{tr(mode==='surname'?'Nachname':mode==='fide'?'FIDE-ID':'Lichess-Benutzername')}</button>)}</div></fieldset><label htmlFor={lookupId}>{tr(lookupMode==='surname'?'Nachname':lookupMode==='fide'?'FIDE-ID':'Lichess-Benutzername')}</label><div><input id={lookupId} minLength={lookupMode==='fide'?1:2} maxLength={100} pattern={lookupMode==='fide'?'[1-9][0-9]{0,9}':lookupMode==='lichess'?'[A-Za-z0-9_-]+':undefined} required value={query} placeholder={lookupMode==='surname'?tr('Lateinische Buchstaben, z. B. Huseynov'):undefined} onChange={e=>setQuery(e.target.value)} autoComplete="off"/><button disabled={busy||!session}>{tr('Suchen')}</button></div></form>
    {error&&<p role="alert">{tr(error)}</p>}{notice&&<p role="status">{tr(notice)}</p>}{busy&&<p role="status">{tr('Wird geladen …')}</p>}
    {seedPreparation&&<NamedPreparation key={session?.access_token+':'+seedPreparation.fideId} token={session?.access_token||''} initialFideId={seedPreparation.fideId} initialName={seedPreparation.name} hideSearch/>}
    {loadedNickname&&<VorbereitungWorkspace key={session?.access_token+':'+loadedNickname} token={session?.access_token||''} initial={loadedNickname} autoLoad hideSearch/>}
    {lookupMode!=='lichess'&&(searched||selected)&&<div className="spieler-columns"><section className="section-card" aria-label={tr('Suchergebnisse')}><h2>{tr('Suchergebnisse')}</h2>{searched&&!players.length&&<p>{tr('Keine Spieler gefunden.')}</p>}<ul className="spieler-results">{players.map(p=><li key={p.fide_id}><button type="button" aria-pressed={selected?.fide_id===p.fide_id} onClick={()=>choose(p)}><strong>{p.title} {p.name}</strong><span>{p.club||tr('Verein —')} · FIDE {p.fide_rating??'—'}</span></button><button type="button" disabled={busy||!session} onClick={()=>{choose(p);void action('claim',p,'');}}>{tr('Das bin ich')}</button></li>)}</ul></section>
    {selected&&<section className="section-card" aria-label={tr('Spielerkarte')}><SpielerCard player={selected} onPrepare={()=>setTab('games')}/><details className="section-info"><summary>{tr('Profil')}</summary><label>{tr('Mein Verein (freiwillig)')}<select value={club} onChange={e => setClub(e.target.value)} disabled={import.meta.env.VITE_CLUBS_NRW_ENABLED !== 'true'}><option value="">{tr('Kein Verein ausgewählt')}</option>{availableClubs.map(c=><option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}</select></label><div className="spieler-actions"><button disabled={busy} onClick={() => void action('claim')}>{tr('Das bin ich')}</button><button disabled={busy} onClick={() => void action('hide')}>{tr('Profil ausblenden')}</button></div><details className="section-info"><summary>{tr('Info')}</summary><p className="spieler-muted">{tr("Eine Anfrage bestätigt keine Identität. Deine Vereinsangabe wird erst nach bestätigter Zuordnung sichtbar. Bis zu drei Ausblendungen wirken sofort bis zur Prüfung. Weitere Anfragen werden zuerst geprüft. Dein bestätigtes eigenes Profil kannst du immer sofort ausblenden.")}</p></details></details>
    {import.meta.env.VITE_VORBEREITUNG_ENABLED==='true'?tab==='games'&&<NamedPreparation key={session?.access_token+':'+selected.fide_id} token={session?.access_token||''} initialFideId={String(selected.fide_id)} initialName={selected.name} hideSearch/>:<>
          <h2>{tr('Partien')}</h2><details className="section-info"><summary>{tr('Info')}</summary><p className="spieler-muted">{tr('Bis zu 25 Partien als Stichprobe. Ein eingegebener Online-Nickname ist keine bestätigte Zuordnung zu dieser Person. TWIC verwendet FIDE-IDs aus importierten PGNs.')}</p></details>
          <form onSubmit={loadGames} className="spieler-provider"><label>{tr('Quelle')}<select value={source} onChange={e => { pending.current?.abort(); setBusy(false); setSource(e.target.value); setGames(null); setLoaded(false); setLoadedAccount(null); }}><option value="lichess">Lichess</option><option value="chesscom">Chess.com</option><option value="twic">TWIC</option></select></label>
            {source !== 'twic' && <label>{tr('Online-Nickname')}<input required minLength={2} maxLength={30} pattern="[A-Za-z0-9_-]+" value={nickname} onChange={e => setNickname(e.target.value)} /></label>}<button disabled={busy}>{tr('Partien laden')}</button></form>
          {loaded && !games?.games.length && <p>{tr('Keine Partien in dieser Quelle verfügbar.')}</p>}

          {loadedAccount && <SpielerAccountLabel source={loadedAccount.source} nickname={loadedAccount.nickname} />}
          {games && <><h3>{tr("Eröffnungen dieser Stichprobe")}</h3><ul>{games.openings.map(o => <li key={o.name}>{o.name} · {o.count}</li>)}</ul>{games.rejected > 0 && <p>{games.rejected} {tr('nicht unterstützte oder ungültige Partien ausgelassen.')}</p>}
            <ul className="spieler-games">{games.games.map(g => <li key={g.id}><strong>{g.white} – {g.black}</strong><span>{g.result} · {g.date} · {g.eco} {g.opening}</span><button onClick={() => analyse(g.pgn)}>{tr("In Analyse öffnen")}</button></li>)}</ul></>}
</>}
    </section>}</div>}
  </section>;
}

export default function SpielerScreen(){
 const tr=useRegionalCopy(),{language}=useLanguage(),{session}=useAuth(),[params,setParams]=useSearchParams();
 const active=params.get('tab')==='opponent'?'opponent':'position';
 const workspaceRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const node=workspaceRef.current;
  const owner=node?.closest('[data-route-scroll]') as HTMLElement|null;
  if(!node||!owner)return;
  const wheel=(event:WheelEvent)=>{
   // Capture wheel events before chessboard controls can intercept them.
   // Keep all wheel routing strictly inside the Spieler workspace.
   if(!event.target||!node.contains(event.target as Node))return;
   if(event.ctrlKey||event.metaKey||event.deltaY===0||!event.cancelable||owner.scrollHeight<=owner.clientHeight+1)return;
   const lineHeight=20;
   const unit=event.deltaMode===1?lineHeight:event.deltaMode===2?owner.clientHeight:1;
   const delta=event.deltaY*unit;
   // Let an independently scrollable chat consume its wheel before the page.
   // At either edge the event continues to the route scroller normally.
   for(let target=event.target as HTMLElement|null;target&&target!==owner;target=target.parentElement){
    const style=getComputedStyle(target);
    if(/auto|scroll/.test(style.overflowY)&&target.scrollHeight>target.clientHeight+1&&
      (delta>0?target.scrollTop+target.clientHeight<target.scrollHeight-1:target.scrollTop>1))return;
   }
   // Preserve precision trackpad gestures; accelerate discrete mouse wheel steps.
   const multiplier=event.deltaMode===1||Math.abs(delta)>=80?1.6:1;
   const max=owner.scrollHeight-owner.clientHeight;
   const next=Math.max(0,Math.min(max,owner.scrollTop+delta*multiplier));
   if(next===owner.scrollTop)return;
   event.preventDefault();owner.scrollTop=next;
  };
  owner.addEventListener('wheel',wheel,{passive:false,capture:true});
  return()=>owner.removeEventListener('wheel',wheel,{capture:true});
 },[]);
 return <section ref={workspaceRef} className="spieler-page section-page"><header className="spieler-workspace-top"><h1 className="spieler-visually-hidden-title">{translatePlayer('Spieler',language)}</h1><div className="spieler-tabs spieler-primary-tabs" role="tablist" aria-label={tr('Spielerbereiche')} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const tab=active==='position'?'opponent':'position';setParams({tab});document.getElementById('spieler-section-'+tab)?.focus();}}}>
 {(['position',...(import.meta.env.VITE_VORBEREITUNG_ENABLED==='true'?['opponent' as const]:[])] as const).map(tab=><button type="button" role="tab" key={tab} id={'spieler-section-'+tab} aria-selected={tab===active} aria-controls={'spieler-section-panel-'+tab} tabIndex={tab===active?0:-1} onClick={()=>setParams({tab})}>{tr(tab==='position'?'Partiensuche':'Gegnervorbereitung')}</button>)}</div></header>
 <div role="tabpanel" id="spieler-section-panel-position" aria-labelledby="spieler-section-position" hidden={active!=='position'}>{import.meta.env.VITE_POSITION_SEARCH_ENABLED==='true'?<div className="spieler-position-workspace"><GlobalPositionSearch key={session?.user?.id||'guest'} token={session?.access_token||''} accountId={session?.user?.id||'guest'} coach={(color,onColorChange)=><OpeningPrep color={color} onColorChange={onColorChange} key={'coach:'+(session?.user?.id||'guest')} accountId={session?.user?.id||'guest'} token={session?.access_token||''} showAuthNotice={false}/>} /></div>:active==='position'?<SpielerDirectory/>:null}</div>
 <div role="tabpanel" id="spieler-section-panel-opponent" aria-labelledby="spieler-section-opponent" hidden={active!=='opponent'}>{active==='opponent'&&<SpielerDirectory key={session?.access_token||'guest'}/>}</div></section>;
}
