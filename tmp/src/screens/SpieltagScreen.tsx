import { translateSectionCopy } from '../i18n/sectionCopy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { createSpieltagApi,spieltagEnabled,SpieltagError,scheduleFromMatch,boardInput,type SpieltagTeam,type SpieltagClub,type SpieltagMatch,type SpieltagBoard,type SpieltagSchedule,type SpieltagBoardInput } from '../services/spieltag';
import { createSpielerApi,type SpielerPlayer } from '../services/spieler';
import SpielerCard from '../components/spieler/SpielerCard';
import SpieltagMatchView from '../components/spieltag/SpieltagMatchView';
import { BoardForm,ScheduleForm } from '../components/spieltag/SpieltagForms';
import './SpielerScreen.css';
import './SpieltagScreen.css';
import '../styles/sections.css';

const matchdayText: Record<string,Record<string,string>> = {"Spieltag ist derzeit deaktiviert.":{"de":"Spieltag ist derzeit deaktiviert.","en":"Matchday is currently disabled.","az":"Oyun günü hazırda deaktivdir.","tr":"Maç günü şu anda devre dışı.","ua":"Ігровий день зараз вимкнено.","ru":"Игровой день пока отключён."},"Bitte melde dich erneut an.":{"de":"Bitte melde dich erneut an.","en":"Please sign in again.","az":"Yenidən daxil olun.","tr":"Lütfen yeniden giriş yapın.","ua":"Увійдіть знову.","ru":"Войдите снова."},"Spieltag ist noch nicht aktiviert.":{"de":"Spieltag ist noch nicht aktiviert.","en":"Matchday has not been enabled yet.","az":"Oyun günü hələ aktiv deyil.","tr":"Maç günü henüz etkin değil.","ua":"Ігровий день ще не активовано.","ru":"Игровой день ещё не включён."},"Bitte zuerst anmelden":{"de":"Bitte zuerst anmelden","en":"Sign in first","az":"Əvvəlcə daxil olun","tr":"Önce giriş yapın","ua":"Спочатку увійдіть","ru":"Сначала войдите"},"Mannschaft intern":{"de":"Mannschaft intern","en":"Team only","az":"Yalnız komanda üçün","tr":"Yalnızca takım","ua":"Лише для команди","ru":"Только для команды"},"Termine, Aufstellung und Nachbesprechung deiner Mannschaft.":{"de":"Termine, Aufstellung und Nachbesprechung deiner Mannschaft.","en":"Your team's schedule, lineup and match review.","az":"Komandanızın təqvimi, heyəti və oyun təhlili.","tr":"Takımınızın takvimi, kadrosu ve maç değerlendirmesi.","ua":"Розклад, склад і розбір матчів вашої команди.","ru":"Расписание, состав и разбор матчей вашей команды."},"Gespeichert.":{"de":"Gespeichert.","en":"Saved.","az":"Yadda saxlanıldı.","tr":"Kaydedildi.","ua":"Збережено.","ru":"Сохранено."},"Wird geladen …":{"de":"Wird geladen …","en":"Loading…","az":"Yüklənir…","tr":"Yükleniyor…","ua":"Завантаження…","ru":"Загрузка…"},"Mannschaft":{"de":"Mannschaft","en":"Team","az":"Komanda","tr":"Takım","ua":"Команда","ru":"Команда"},"Verein":{"de":"Verein","en":"Club","az":"Klub","tr":"Kulüp","ua":"Клуб","ru":"Клуб"},"Spieltermin eintragen":{"de":"Spieltermin eintragen","en":"Add match date","az":"Oyun tarixi əlavə et","tr":"Maç tarihi ekle","ua":"Додати дату матчу","ru":"Добавить дату матча"},"Begegnung":{"de":"Begegnung","en":"Match","az":"Görüş","tr":"Karşılaşma","ua":"Матч","ru":"Матч"},"Termin bearbeiten":{"de":"Termin bearbeiten","en":"Edit schedule","az":"Tarixi redaktə et","tr":"Tarihi düzenle","ua":"Редагувати дату","ru":"Изменить дату"},"Brett hinzufügen":{"de":"Brett hinzufügen","en":"Add board","az":"Taxta əlavə et","tr":"Tahta ekle","ua":"Додати дошку","ru":"Добавить доску"},"Karte schließen":{"de":"Karte schließen","en":"Close card","az":"Kartı bağla","tr":"Kartı kapat","ua":"Закрити картку","ru":"Закрыть карточку"},"Noch keine Spieltermine eingetragen.":{"de":"Noch keine Spieltermine eingetragen.","en":"No matches scheduled yet.","az":"Hələ oyun təqvimi yoxdur.","tr":"Henüz maç planlanmadı.","ua":"Матчів ще не заплановано.","ru":"Матчи пока не запланированы."},"Du bist noch keiner Mannschaft zugeordnet. Bitte wende dich an die Vereinsleitung.":{"de":"Du bist noch keiner Mannschaft zugeordnet. Bitte wende dich an die Vereinsleitung.","en":"You are not assigned to a team yet. Please contact your club.","az":"Hələ komandaya təyin edilməmisiniz. Klub rəhbərliyi ilə əlaqə saxlayın.","tr":"Henüz bir takıma atanmadınız. Kulübünüze başvurun.","ua":"Вас ще не додано до команди. Зверніться до клубу.","ru":"Вы ещё не включены в команду. Обратитесь в клуб."},"Du pflegst diese Mannschaft als Kapitänin oder Kapitän.":{"de":"Du pflegst diese Mannschaft als Kapitänin oder Kapitän.","en":"You manage this team as captain.","az":"Bu komandanı kapitan kimi idarə edirsiniz.","tr":"Bu takımı kaptan olarak yönetiyorsunuz.","ua":"Ви керуєте командою як капітан.","ru":"Вы управляете командой как капитан."},"Nur für bestätigte Mannschaftsmitglieder.":{"de":"Nur für bestätigte Mannschaftsmitglieder.","en":"For confirmed team members only.","az":"Yalnız təsdiqlənmiş komanda üzvləri üçün.","tr":"Yalnızca onaylı takım üyeleri için.","ua":"Лише для підтверджених учасників команди.","ru":"Только для подтверждённых участников команды."},"Kein Zugriff. Bitte prüfe deine Mannschaftszuordnung.":{"de":"Kein Zugriff. Bitte prüfe deine Mannschaftszuordnung.","en":"Access denied. Check your team assignment.","az":"İcazə yoxdur. Komandaya aidiyyətinizi yoxlayın.","tr":"Erişim yok. Takım üyeliğinizi kontrol edin.","ua":"Немає доступу. Перевірте участь у команді.","ru":"Нет доступа. Проверьте привязку к команде."},"Dieses Brett ist bereits eingetragen. Bitte bearbeite den vorhandenen Eintrag.":{"de":"Dieses Brett ist bereits eingetragen. Bitte bearbeite den vorhandenen Eintrag.","en":"This board is already entered. Edit the existing entry.","az":"Bu taxta artıq mövcuddur. Mövcud qeydi redaktə edin.","tr":"Bu tahta zaten girilmiş. Mevcut kaydı düzenleyin.","ua":"Цю дошку вже додано. Змініть наявний запис.","ru":"Эта доска уже добавлена. Измените существующую запись."},"Bitte prüfe die Eingaben und gegebenenfalls die FIDE-ID.":{"de":"Bitte prüfe die Eingaben und gegebenenfalls die FIDE-ID.","en":"Check the entries and FIDE ID if applicable.","az":"Məlumatları və lazım gələrsə FIDE ID-ni yoxlayın.","tr":"Bilgileri ve varsa FIDE ID'yi kontrol edin.","ua":"Перевірте дані та, за потреби, FIDE ID.","ru":"Проверьте данные и при необходимости FIDE ID."},"Bitte warte kurz und versuche es erneut.":{"de":"Bitte warte kurz und versuche es erneut.","en":"Please wait and try again.","az":"Bir az gözləyib yenidən cəhd edin.","tr":"Biraz bekleyip tekrar deneyin.","ua":"Зачекайте і спробуйте знову.","ru":"Подождите и попробуйте снова."},"Spieltag konnte nicht geladen oder gespeichert werden. Bitte erneut versuchen.":{"de":"Spieltag konnte nicht geladen oder gespeichert werden. Bitte erneut versuchen.","en":"Could not load or save matchday. Try again.","az":"Oyun günü yüklənmədi və ya saxlanılmadı. Yenidən cəhd edin.","tr":"Maç günü yüklenemedi veya kaydedilemedi. Tekrar deneyin.","ua":"Не вдалося завантажити або зберегти ігровий день. Спробуйте ще раз.","ru":"Не удалось загрузить или сохранить игровой день. Повторите попытку."},"Spielerkarte nicht verfügbar. Das Profil kann ausgeblendet oder Spieler deaktiviert sein.":{"de":"Spielerkarte nicht verfügbar. Das Profil kann ausgeblendet oder Spieler deaktiviert sein.","en":"Player card unavailable. The profile may be hidden or inactive.","az":"Oyunçu kartı əlçatan deyil. Profil gizlədilmiş və ya deaktiv ola bilər.","tr":"Oyuncu kartı kullanılamıyor. Profil gizli veya etkin değil olabilir.","ua":"Картка гравця недоступна. Профіль може бути прихований або неактивний.","ru":"Карточка игрока недоступна. Профиль может быть скрыт или неактивен."},"Spieltag":{"de":"Spieltag","en":"Matchday","az":"Oyun günü","tr":"Maç günü","ua":"Ігровий день","ru":"Игровой день"}};
function translateMatchday(value:string, language:string) {return matchdayText[value]?.[language]||translateSectionCopy(value,language);}
function message(error: unknown) {
  if (error instanceof SpieltagError) {
    if (error.code==='feature_disabled') return 'Spieltag ist derzeit deaktiviert.';
    if (error.code==='authentication_required') return 'Bitte melde dich erneut an.';
    if (error.code==='not_allowed' || error.code==='not_found') return 'Kein Zugriff. Bitte prüfe deine Mannschaftszuordnung.';
    if (error.code==='already_exists') return 'Dieses Brett ist bereits eingetragen. Bitte bearbeite den vorhandenen Eintrag.';
    if (error.code==='invalid_input') return 'Bitte prüfe die Eingaben und gegebenenfalls die FIDE-ID.';
    if (error.code==='rate_limit') return 'Bitte warte kurz und versuche es erneut.';
  }
  return 'Spieltag konnte nicht geladen oder gespeichert werden. Bitte erneut versuchen.';
}
export default function SpieltagScreen() {
  const {language}=useLanguage();const tr=(v:string)=>translateMatchday(v,language);
  const {session}=useAuth();
  if (!spieltagEnabled(import.meta.env.VITE_SPIELTAG_ENABLED)) return <p role="status">{tr("Spieltag ist noch nicht aktiviert.")}</p>;
  if (!session) return <section className="spieltag-page"><h1>{tr('Spieltag')}</h1><Link to="/profile">{tr("Bitte zuerst anmelden")}</Link></section>;
  // Remounting on identity/token change immediately discards private state and
  // aborts every pending load/save/card request from the previous session.
  return <SpieltagWorkspace key={session.access_token} token={session.access_token}/>;
}
function SpieltagWorkspace({token}: {token: string}) {
 const {language}=useLanguage();const tr=(v:string)=>translateMatchday(v,language);
  const [teams,setTeams]=useState<SpieltagTeam[]>([]),[clubs,setClubs]=useState<SpieltagClub[]>([]);
  const [teamId,setTeamId]=useState(''),[matches,setMatches]=useState<SpieltagMatch[]>([]),[matchId,setMatchId]=useState('');
  const [boards,setBoards]=useState<SpieltagBoard[]>([]),[refresh,setRefresh]=useState(0);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [scheduleEdit,setScheduleEdit]=useState<SpieltagMatch | null | undefined>(),[boardEdit,setBoardEdit]=useState<SpieltagBoard | null | undefined>();
  const [player,setPlayer]=useState<SpielerPlayer | null>(null),[cardError,setCardError]=useState('');
  const operations=useRef(new Set<AbortController>()),cardRequest=useRef<AbortController | null>(null);
  const team=teams.find(t=>t.id===teamId),match=matches.find(m=>m.id===matchId),captain=team?.role==='captain';
  const api=useCallback(()=>createSpieltagApi(import.meta.env.VITE_SERVER_URL || '',token),[token]);
  useEffect(()=>{const pending=operations.current;return()=>{for(const c of pending)c.abort();cardRequest.current?.abort();};},[]);
  useEffect(()=>{
    const c=new AbortController();setLoading(true);
    void (async()=>{try{const [t,cl]=await Promise.all([api().teams(c.signal),api().clubs(c.signal)]);if(!c.signal.aborted){setTeams(t);setClubs(cl);setTeamId(t[0]?.id || '');}}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setLoading(false);}})();
    return()=>c.abort();
  },[api]);
  useEffect(()=>{
    const c=new AbortController();setMatches([]);setMatchId('');setBoards([]);setPlayer(null);setScheduleEdit(undefined);setBoardEdit(undefined);setNotice('');
    if(teamId){setLoading(true);void (async()=>{try{const rows=await api().matches(teamId,c.signal);if(!c.signal.aborted){setMatches(rows);setMatchId(rows[0]?.id || '');}}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setLoading(false);}})();}
    return()=>c.abort();
  },[api,teamId]);
  useEffect(()=>{
    const c=new AbortController();setBoards([]);setPlayer(null);setCardError('');cardRequest.current?.abort();setBoardEdit(undefined);
    if(matchId){setLoading(true);void (async()=>{try{const rows=await api().boards(matchId,c.signal);if(!c.signal.aborted)setBoards(rows);}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setLoading(false);}})();}
    return()=>c.abort();
  },[api,matchId,refresh]);
  async function mutate(action: (signal: AbortSignal) => Promise<void>) {
    if(busy || !captain)return;const c=new AbortController();operations.current.add(c);setBusy(true);setError('');setNotice('');
    try{await action(c.signal);if(!c.signal.aborted)setNotice('Gespeichert.');}catch(e){if(!c.signal.aborted)setError(message(e));}finally{operations.current.delete(c);if(!c.signal.aborted)setBusy(false);}
  }
  async function saveSchedule(value: SpieltagSchedule) {
    await mutate(async signal=>{const rows=await api().saveMatch(teamId,scheduleEdit?.id || null,value,signal);if(signal.aborted)return;
      setMatches(old=>[...old.filter(x=>x.id!==rows[0].id),...rows].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));setMatchId(rows[0].id);setScheduleEdit(undefined);});
  }
  async function saveBoard(number: number,value: SpieltagBoardInput) {
    await mutate(async signal=>{await api().saveBoard(matchId,number,!!boardEdit,value,signal);if(!signal.aborted){setBoardEdit(undefined);setRefresh(n=>n+1);}});
  }
  async function openCard(id: string) {
    cardRequest.current?.abort();const c=new AbortController();cardRequest.current=c;setPlayer(null);setCardError('');
    try{const card=await createSpielerApi(import.meta.env.VITE_SERVER_URL || '').card(id,token,c.signal);if(!c.signal.aborted)setPlayer(card);}catch{if(!c.signal.aborted)setCardError('Spielerkarte nicht verfügbar. Das Profil kann ausgeblendet oder Spieler deaktiviert sein.');}
  }
  return <section className="spieltag-page section-page"><header><p className="spieler-eyebrow">{tr('Mannschaft intern')}</p><h1>{tr('Spieltag')}</h1><p>{tr('Termine, Aufstellung und Nachbesprechung deiner Mannschaft.')}</p></header>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{loading&&<p role="status">{tr('Wird geladen …')}</p>}
    {!loading&&!teams.length&&<p>{tr('Du bist noch keiner Mannschaft zugeordnet. Bitte wende dich an die Vereinsleitung.')}</p>}
    {!!teams.length&&<div className="spieltag-workspace"><section className="section-card spieltag-controls"><h2>{tr('Deine Mannschaft')}</h2><label>{tr('Mannschaft')}<select value={teamId} disabled={busy} onChange={e=>setTeamId(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>{clubs.find(c=>c.id===t.club_id)?.name || tr('Verein')} · {t.name}</option>)}</select></label>
      <p className="spieltag-role">{captain?'Du pflegst diese Mannschaft als Kapitänin oder Kapitän.':'Nur für bestätigte Mannschaftsmitglieder.'}</p>
      {captain&&<button disabled={busy||loading} onClick={()=>setScheduleEdit(null)}>{tr('Spieltermin eintragen')}</button>}
      {scheduleEdit!==undefined&&captain&&<ScheduleForm key={scheduleEdit?.id || 'new'} match={scheduleEdit} clubs={clubs} busy={busy} onSave={v=>void saveSchedule(v)} onCancel={()=>setScheduleEdit(undefined)}/>}
      {!!matches.length&&<label>{tr('Begegnung')}<select value={matchId} disabled={busy} onChange={e=>{setMatchId(e.target.value);setScheduleEdit(undefined);}}>{matches.map(m=><option key={m.id} value={m.id}>{m.round_label} · {m.opponent_name}</option>)}</select></label>}
      {!loading&&!matches.length&&<p>{tr('Noch keine Spieltermine eingetragen.')}</p>}
      {match&&captain&&<div className="spieltag-actions"><button disabled={busy} onClick={()=>setScheduleEdit(match)}>{tr('Termin bearbeiten')}</button><button disabled={busy||loading} onClick={()=>setBoardEdit(null)}>{tr('Brett hinzufügen')}</button></div>}

        {boardEdit!==undefined&&captain&&<BoardForm key={boardEdit?.board_number || 'new'} board={boardEdit} busy={busy} onSave={(n,v)=>void saveBoard(n,v)} onCancel={()=>setBoardEdit(undefined)}/>}
      <details className="section-info"><summary>{tr('Info')}</summary><p>Nur bestätigte Mannschaftsmitglieder können diese Vorbereitung lesen. Die Mannschaftsleitung pflegt Termine, Aufstellung und Ergebnisse. Keine Übertragung in Online-Partien, Ratings oder Ligatabellen.</p></details>
      </section>{match&&<>
        <SpieltagMatchView key={match.id} match={match} boards={boards} captain={!!captain} busy={busy||loading} spielerAvailable={import.meta.env.VITE_SPIELER_V1_ENABLED==='true'} onCard={id=>void openCard(id)} onEdit={setBoardEdit}
          onDelete={b=>{if(!window.confirm('Brett '+b.board_number+' aus dieser Aufstellung entfernen?'))return;void mutate(async signal=>{await api().deleteBoard(match.id,b.board_number,signal);if(!signal.aborted)setRefresh(n=>n+1);});}}
          onResult={(b,result)=>void mutate(async signal=>{const rows=await api().saveBoard(match.id,b.board_number,true,{...boardInput(b),result},signal);if(!signal.aborted)setBoards(old=>old.map(x=>x.board_number===b.board_number?rows[0]:x));})}
          onLichess={(b,username)=>void mutate(async signal=>{const rows=await api().saveLichess(match.id,b.board_number,username,signal);if(!signal.aborted)setBoards(old=>old.map(x=>x.board_number===b.board_number?rows[0]:x));})}
          onNotes={notes=>void mutate(async signal=>{const rows=await api().saveMatch(teamId,match.id,{...scheduleFromMatch(match),notes},signal);if(!signal.aborted)setMatches(old=>old.map(x=>x.id===match.id?rows[0]:x));})}/>
      </>}
    </div>}
    {cardError&&<p role="status">{cardError}</p>}{player&&<aside className="spieltag-card" aria-label="Spielerkarte"><button onClick={()=>{cardRequest.current?.abort();setPlayer(null);}}>{tr('Karte schließen')}</button><SpielerCard player={player}/></aside>}

  </section>;
}
