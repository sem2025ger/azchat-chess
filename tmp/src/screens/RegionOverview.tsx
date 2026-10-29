import { translateSectionCopy } from '../i18n/sectionCopy';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, Radio, Newspaper, ShieldCheck, MapPin, Trophy, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import './RegionOverview.css';
import { useLanguage } from '../context/LanguageContext';
const regionText: Record<string,Record<'en'|'de'|'az'|'tr'|'ua'|'ru',string>> = {
 "Turniere & Termine": {"de": "Turniere & Termine", "en": "Tournaments & dates", "az": "Turnirlər və tarixlər", "tr": "Turnuvalar ve tarihler", "ua": "Турніри та дати", "ru": "Турниры и даты"},
 "Ligen & Mannschaften": {"de": "Ligen & Mannschaften", "en": "Leagues & teams", "az": "Liqalar və komandalar", "tr": "Ligler ve takımlar", "ua": "Ліги та команди", "ru": "Лиги и команды"},
 "Vereine & Training": {"de": "Vereine & Training", "en": "Clubs & training", "az": "Klublar və məşqlər", "tr": "Kulüpler ve antrenman", "ua": "Клуби та тренування", "ru": "Клубы и тренировки"},
 "Die nächsten eingetragenen Turniere.": {"de": "Die nächsten eingetragenen Turniere.", "en": "Upcoming tournaments listed by clubs.", "az": "Klubların əlavə etdiyi qarşıdakı turnirlər.", "tr": "Kulüplerin eklediği yaklaşan turnuvalar.", "ua": "Найближчі турніри, додані клубами.", "ru": "Ближайшие турниры, добавленные клубами."},
 "Platzierungen und Mannschaftspunkte.": {"de": "Platzierungen und Mannschaftspunkte.", "en": "Standings and team points.", "az": "Sıralama və komanda xalları.", "tr": "Sıralama ve takım puanları.", "ua": "Місця та командні очки.", "ru": "Места в таблице и командные очки."},
 "Vereinsprofile, Kontakte und Trainingszeiten.": {"de": "Vereinsprofile, Kontakte und Trainingszeiten.", "en": "Club profiles, contacts and training times.", "az": "Klub profilləri, əlaqə və məşq vaxtları.", "tr": "Kulüp profilleri, iletişim ve antrenman saatleri.", "ua": "Профілі клубів, контакти та розклад тренувань.", "ru": "Профили клубов, контакты и расписание тренировок."},
 "Alle Termine": {"de": "Alle Termine", "en": "All dates", "az": "Bütün tədbirlər", "tr": "Tüm etkinlikler", "ua": "Усі події", "ru": "Все события"},
 "Tabellen ansehen": {"de": "Tabellen ansehen", "en": "View standings", "az": "Cədvəllərə bax", "tr": "Puan tabloları", "ua": "Переглянути таблиці", "ru": "Смотреть таблицы"},
 "Alle Vereine": {"de": "Alle Vereine", "en": "All clubs", "az": "Bütün klublar", "tr": "Tüm kulüpler", "ua": "Усі клуби", "ru": "Все клубы"},
 "Alle Nachrichten": {"de": "Alle Nachrichten", "en": "All news", "az": "Bütün xəbərlər", "tr": "Tüm haberler", "ua": "Усі новини", "ru": "Все новости"},
 "Anmelden": {"de": "Anmelden", "en": "Sign in", "az": "Daxil ol", "tr": "Giriş yap", "ua": "Увійти", "ru": "Войти"},
 "Datenquelle": {"de": "Datenquelle", "en": "Data source", "az": "Məlumat mənbəyi", "tr": "Veri kaynağı", "ua": "Джерело даних", "ru": "Источник данных"},
 "Spieler suchen": {"de": "Spieler suchen", "en": "Find players", "az": "Oyunçu axtar", "tr": "Oyuncu ara", "ua": "Знайти гравців", "ru": "Поиск игроков"},
 "Gegnervorbereitung": {"de": "Gegnervorbereitung", "en": "Opponent preparation", "az": "Rəqibə hazırlıq", "tr": "Rakibe hazırlık", "ua": "Підготовка до суперника", "ru": "Подготовка к сопернику"},
 "Nachrichten aus den Vereinen": {"de": "Nachrichten aus den Vereinen", "en": "Club news", "az": "Klub xəbərləri", "tr": "Kulüp haberleri", "ua": "Новини клубів", "ru": "Новости клубов"},
 "Vereinsangaben aus NRW · von Vereinen gepflegt.": {"de": "Vereinsangaben aus NRW · von Vereinen gepflegt.", "en": "NRW club information · maintained by clubs.", "az": "NRW klub məlumatları · klublar yeniləyir.", "tr": "NRW kulüp bilgileri · kulüplerce güncellenir.", "ua": "Дані клубів NRW · оновлюються клубами.", "ru": "Сведения о клубах NRW · обновляются клубами."},
  "Verein": {"de": "Verein", "en": "Club", "az": "Klub", "tr": "Kulüp", "ua": "Клуб", "ru": "Клуб"},

"Turniere": { en:"Tournaments", de:"Turniere", az:"Turnirlər", tr:"Turnuvalar", ua:"Турніри", ru:"Турниры" },
"Ligen": { en:"Leagues", de:"Ligen", az:"Liqalar", tr:"Ligler", ua:"Ліги", ru:"Лиги" },
"Vereine": { en:"Clubs", de:"Vereine", az:"Klublar", tr:"Kulüpler", ua:"Клуби", ru:"Клубы" },
"Nachrichten": { en:"News", de:"Nachrichten", az:"Xəbərlər", tr:"Haberler", ua:"Новини", ru:"Новости" },
"Live-Übertragungen": { en:"Live broadcasts", de:"Live-Übertragungen", az:"Canlı yayımlar", tr:"Canlı yayınlar", ua:"Прямі трансляції", ru:"Прямые трансляции" },
"Details ansehen": { en:"View details", de:"Details ansehen", az:"Ətraflı bax", tr:"Detayları gör", ua:"Докладніше", ru:"Подробнее" },
"Termine werden geladen …": { en:"Loading events…", de:"Termine werden geladen …", az:"Tədbirlər yüklənir…", tr:"Etkinlikler yükleniyor…", ua:"Завантаження подій…", ru:"Загрузка событий…" },
"Tabellen werden geladen …": { en:"Loading standings…", de:"Tabellen werden geladen …", az:"Cədvəllər yüklənir…", tr:"Tablolar yükleniyor…", ua:"Завантаження таблиць…", ru:"Загрузка таблиц…" },
"Vereine werden geladen …": { en:"Loading clubs…", de:"Vereine werden geladen …", az:"Klublar yüklənir…", tr:"Kulüpler yükleniyor…", ua:"Завантаження клубів…", ru:"Загрузка клубов…" },
"Nachrichten werden geladen …": { en:"Loading news…", de:"Nachrichten werden geladen …", az:"Xəbərlər yüklənir…", tr:"Haberler yükleniyor…", ua:"Завантаження новин…", ru:"Загрузка новостей…" },
"Region nicht verfügbar": { en:"Region unavailable", de:"Region nicht verfügbar", az:"Region əlçatan deyil", tr:"Bölge kullanılamıyor", ua:"Регіон недоступний", ru:"Регион недоступен" },
"Zurück zu Schach-Treff": { en:"Back to Schach-Treff", de:"Zurück zu Schach-Treff", az:"Schach-Treff-ə qayıt", tr:"Schach-Treff’e dön", ua:"Назад до Schach-Treff", ru:"Назад в Schach-Treff" },
"Regional es Schach": { en:"Regional chess", de:"Regional es Schach", az:"Regional şahmat", tr:"Bölgesel satranç", ua:"Регіональні шахи", ru:"Региональные шахматы" },
"Schach in Nordrhein-Westfalen": { en:"Chess in North Rhine-Westphalia", de:"Schach in Nordrhein-Westfalen", az:"Şimali Reyn-Vestfaliyada şahmat", tr:"Kuzey Ren-Vestfalya’da satranç", ua:"Шахи в Північному Рейні-Вестфалії", ru:"Шахматы в Северном Рейне — Вестфалии" },
"Turniere, Mannschaften, Vereine und Meldungen auf einen Blick.": { en:"Tournaments, teams, clubs and news at a glance.", de:"Turniere, Mannschaften, Vereine und Meldungen auf einen Blick.", az:"Turnirlər, komandalar, klublar və xəbərlər bir baxışda.", tr:"Turnuvalar, takımlar, kulüpler ve haberler bir arada.", ua:"Турніри, команди, клуби та новини в одному місці.", ru:"Турниры, команды, клубы и новости в одном месте." },
"Alle NRW-Themen": { en:"All NRW topics", de:"Alle NRW-Themen", az:"Bütün NRW mövzuları", tr:"Tüm NRW konuları", ua:"Усі теми NRW", ru:"Все темы NRW" },
"Stadt": { en:"City", de:"Stadt", az:"Şəhər", tr:"Şehir", ua:"Місто", ru:"Город" },
"Alle Städte in NRW": { en:"All NRW cities", de:"Alle Städte in NRW", az:"NRW-nin bütün şəhərləri", tr:"NRW’deki tüm şehirler", ua:"Усі міста NRW", ru:"Все города NRW" },
"Keine aktuellen Meldungen verfügbar.": { en:"No current news available.", de:"Keine aktuellen Meldungen verfügbar.", az:"Hazırda xəbər yoxdur.", tr:"Güncel haber yok.", ua:"Немає актуальних новин.", ru:"Актуальных новостей нет." },
"Mein Spieltag": { en:"My matchday", de:"Mein Spieltag", az:"Mənim oyun günüm", tr:"Maç günüm", ua:"Мій ігровий день", ru:"Мой игровой день" },
"Spieler": { en:"Players", de:"Spieler", az:"Oyunçular", tr:"Oyuncular", ua:"Гравці", ru:"Игроки" },
"Vorbereitung": { en:"Preparation", de:"Vorbereitung", az:"Hazırlıq", tr:"Hazırlık", ua:"Підготовка", ru:"Подготовка" },
"Regionales Schach": { en:"Regional chess", de:"Regionales Schach", az:"Regional şahmat", tr:"Bölgesel satranç", ua:"Регіональні шахи", ru:"Региональные шахматы" },
 "Weitere Regionen werden erst nach der Freigabe ihrer Datenquellen aktiviert.": { en:"Other regions will be enabled once their data sources are approved.", de:"Weitere Regionen werden erst nach der Freigabe ihrer Datenquellen aktiviert.", az:"Digər regionlar məlumat mənbələri təsdiq olunduqdan sonra aktiv olacaq.", tr:"Diğer bölgeler veri kaynakları onaylandıktan sonra açılacak.", ua:"Інші регіони з’являться після перевірки джерел даних.", ru:"Другие регионы появятся после проверки источников данных." },
 "Einige Vereinsangaben sind derzeit nicht verfügbar.": { en:"Some club information is currently unavailable.", de:"Einige Vereinsangaben sind derzeit nicht verfügbar.", az:"Bəzi klub məlumatları hazırda əlçatan deyil.", tr:"Bazı kulüp bilgileri şu an kullanılamıyor.", ua:"Деякі дані клубів зараз недоступні.", ru:"Некоторые сведения о клубах сейчас недоступны." },
 "NRW-Daten können derzeit nicht geladen werden.": { en:"NRW data could not be loaded.", de:"NRW-Daten können derzeit nicht geladen werden.", az:"NRW məlumatlarını yükləmək mümkün deyil.", tr:"NRW verileri yüklenemiyor.", ua:"Не вдалося завантажити дані NRW.", ru:"Не удалось загрузить данные NRW." },
 "Turnierkalender nach Anmeldung verfügbar.": { en:"Sign in to see the tournament calendar.", de:"Turnierkalender nach Anmeldung verfügbar.", az:"Turnir təqvimi üçün daxil olun.", tr:"Turnuva takvimi için giriş yapın.", ua:"Увійдіть, щоб переглянути календар турнірів.", ru:"Войдите, чтобы увидеть календарь турниров." },
 "Keine bestätigten kommenden Termine eingetragen.": { en:"No confirmed upcoming events.", de:"Keine bestätigten kommenden Termine eingetragen.", az:"Təsdiqlənmiş qarşıdakı tədbir yoxdur.", tr:"Onaylı yaklaşan etkinlik yok.", ua:"Немає підтверджених майбутніх подій.", ru:"Нет подтверждённых предстоящих событий." },
 "Vereinsliga-Daten nach Anmeldung verfügbar.": { en:"Sign in to see club league data.", de:"Vereinsliga-Daten nach Anmeldung verfügbar.", az:"Klub liqası məlumatları üçün daxil olun.", tr:"Kulüp ligi verileri için giriş yapın.", ua:"Увійдіть для перегляду клубних ліг.", ru:"Войдите, чтобы увидеть клубные лиги." },
 "Noch keine Tabellen eingetragen.": { en:"No standings entered yet.", de:"Noch keine Tabellen eingetragen.", az:"Hələ cədvəl yoxdur.", tr:"Henüz puan tablosu yok.", ua:"Турнірних таблиць ще немає.", ru:"Таблицы пока не добавлены." },
 "Von Vereinen gepflegt · keine offizielle Live-Tabelle.": { en:"Club-maintained · not official live standings.", de:"Von Vereinen gepflegt · keine offizielle Live-Tabelle.", az:"Klublar tərəfindən yenilənir · rəsmi canlı cədvəl deyil.", tr:"Kulüplerce güncellenir · resmi canlı tablo değil.", ua:"Оновлюється клубами · не офіційна онлайн-таблиця.", ru:"Обновляется клубами · не официальная онлайн-таблица." },
 "Keine veröffentlichten Vereine für diese Auswahl.": { en:"No published clubs match this selection.", de:"Keine veröffentlichten Vereine für diese Auswahl.", az:"Bu seçimə uyğun dərc edilmiş klub yoxdur.", tr:"Bu seçime uygun yayımlanmış kulüp yok.", ua:"За цим фільтром немає опублікованих клубів.", ru:"По этому фильтру опубликованных клубов нет." },
 "Standort nicht ermittelt · Auswahl nach Stadt.": { en:"Location not detected · filter by city.", de:"Standort nicht ermittelt · Auswahl nach Stadt.", az:"Məkan müəyyən edilməyib · şəhərə görə seçin.", tr:"Konum algılanmadı · şehre göre seçin.", ua:"Місце не визначено · вибір за містом.", ru:"Местоположение не определено · выбор по городу." },
 "Nachrichten derzeit nicht verfügbar.": { en:"News currently unavailable.", de:"Nachrichten derzeit nicht verfügbar.", az:"Xəbərlər hazırda əlçatan deyil.", tr:"Haberler şu anda kullanılamıyor.", ua:"Новини наразі недоступні.", ru:"Новости сейчас недоступны." },
 "Schachbezirk Bochum · externe Quelle": { en:"Bochum chess district · external source", de:"Schachbezirk Bochum · externe Quelle", az:"Bochum şahmat bölgəsi · xarici mənbə", tr:"Bochum satranç bölgesi · dış kaynak", ua:"Шаховий округ Бохум · зовнішнє джерело", ru:"Шахматный округ Бохума · внешний источник" },
 "Aktuell angebunden: Schachbezirk Bochum (NRW). Keine bundesweiten Meldungen.": { en:"Currently connected: Bochum chess district (NRW). No nationwide news.", de:"Aktuell angebunden: Schachbezirk Bochum (NRW). Keine bundesweiten Meldungen.", az:"Hazırda Bochum şahmat bölgəsi (NRW) bağlıdır. Ümumölkə xəbərləri yoxdur.", tr:"Şu an Bochum satranç bölgesi (NRW) bağlı. Ülke geneli haber yok.", ua:"Підключено округ Бохум (NRW). Загальнонімецьких новин немає.", ru:"Подключён шахматный округ Бохума (NRW). Общегерманских новостей нет." },
 "Derzeit keine für NRW verifizierte Live-Übertragung eingebunden.": { en:"No verified NRW live broadcasts are connected yet.", de:"Derzeit keine für NRW verifizierte Live-Übertragung eingebunden.", az:"Hələ NRW üçün təsdiqlənmiş canlı yayım yoxdur.", tr:"Henüz doğrulanmış NRW canlı yayını bağlı değil.", ua:"Поки немає підтверджених трансляцій NRW.", ru:"Пока нет подтверждённых трансляций NRW." },
 "Öffentliche Übertragungen bei Lichess": { en:"Public broadcasts on Lichess", de:"Öffentliche Übertragungen bei Lichess", az:"Lichess-də açıq yayımlar", tr:"Lichess'teki herkese açık yayınlar", ua:"Відкриті трансляції на Lichess", ru:"Открытые трансляции на Lichess" },
 "Lichess-Übersicht ist weltweit und nicht nach NRW gefiltert.": { en:"Lichess listings are worldwide and are not NRW-filtered.", de:"Lichess-Übersicht ist weltweit und nicht nach NRW gefiltert.", az:"Lichess siyahısı qlobaldır və NRW-yə görə süzülmür.", tr:"Lichess listesi küreseldir, NRW filtresi yoktur.", ua:"Список Lichess міжнародний і не фільтрується за NRW.", ru:"Список Lichess глобальный и не фильтруется по NRW." },
 "Schach-Treff Deutschland": { en:"Schach-Treff Germany", de:"Schach-Treff Deutschland", az:"Schach-Treff Almaniya", tr:"Schach-Treff Almanya", ua:"Schach-Treff Німеччина", ru:"Schach-Treff Германия" },
 "MP": { en:"Match pts", de:"MP", az:"Matç xalı", tr:"Maç puanı", ua:"Матч. очки", ru:"Матч. очки" },
};

import '../styles/sections.css';


type Club = { id:string; slug:string; name:string; city:string };
type Event = { id:string;club_id:string;title:string;starts_at:string;venue:string|null };
type League = { id:string;club_id:string;season:string;league:string;team:string;place:number;played:number;match_points:number };
type News = { title:string;url:string };
type Section = 'turniere'|'ligen'|'vereine'|'news'|'live';
const sections: Section[] = ['turniere','ligen','vereine','news','live'];
const sectionLabels: Record<Section,string> = {
 turniere:'Turniere & Termine',ligen:'Ligen & Mannschaften',vereine:'Vereine & Training',news:'Nachrichten',live:'Live-Übertragungen',
};
const sectionDescriptions: Partial<Record<Section,string>> = {
 turniere:'Die nächsten eingetragenen Turniere.',
 ligen:'Platzierungen und Mannschaftspunkte.',
 vereine:'Vereinsprofile, Kontakte und Trainingszeiten.',
};
const sectionActions: Record<Section,string> = {
 turniere:'Alle Termine',ligen:'Tabellen ansehen',vereine:'Alle Vereine',news:'Alle Nachrichten',live:'Details ansehen',
};
const server=import.meta.env.VITE_SERVER_URL || '';
const eventTime=(value:string,language:string)=>new Intl.DateTimeFormat(({en:'en-GB',de:'de-DE',az:'az-AZ',tr:'tr-TR',ua:'uk-UA',ru:'ru-RU'} as Record<string,string>)[language]||'de-DE',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin',
}).format(new Date(value));
const httpsLink=(value:unknown)=>{
 try {const url=new URL(String(value));return url.protocol==='https:'?url.href:null;}catch{return null;}
};
const regionalClubs=(items:Club[])=>items.filter(c=>c.id&&c.slug&&c.name&&c.city);
const region='nrw'; // Explicit catalog entry: no inferred or mixed-region sources.

function DashboardLink({section,children}:{section:Section;children:React.ReactNode}){
 return <Link className="nrw-more" to={'/region/'+region+'/'+section}>{children}<ArrowUpRight aria-hidden="true" size={16}/></Link>;
}
function Tile({section,icon,children,count,detail=false}:{section:Section;icon:React.ReactNode;children:React.ReactNode;count?:string;detail?:boolean}){
 const {language}=useLanguage(); const tr=(x:string)=>regionText[x]?.[language]||translateSectionCopy(x,language);
 return <section className={'nrw-card nrw-card--'+section} aria-labelledby={'nrw-'+section}>
  <div className="nrw-card-head"><span className="nrw-card-icon" aria-hidden="true">{icon}</span>
   <h2 id={'nrw-'+section}>{tr(sectionLabels[section])}</h2>
   {count && <span className="nrw-count">{count}</span>}
  </div>
  {sectionDescriptions[section]&&<p className="nrw-card-subtitle">{tr(sectionDescriptions[section]!)}</p>}
  <div className="nrw-card-content">{children}</div>
  {!detail&&<DashboardLink section={section}>{tr(sectionActions[section])}</DashboardLink>}
 </section>;
}
export default function RegionOverview(){
 const {language}=useLanguage();const tr=(x:string)=>regionText[x]?.[language]||translateSectionCopy(x,language);
 const {regionId,section}=useParams();
 const {user}=useAuth();
 const [clubs,setClubs]=useState<Club[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [leagues,setLeagues]=useState<League[]>([]);
 const [news,setNews]=useState<News[]>([]);
 const [selectedClub,setSelectedClub]=useState<string|null>(null);
 const [city,setCity]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [newsError,setNewsError]=useState(false);
 const [newsLoading,setNewsLoading]=useState(true);
 const validRegion=regionId==='nrw';
 const detail=sections.includes(section as Section)?section as Section:null;
 useEffect(()=>{
  if(!validRegion)return;
  let active=true;
  const abort=new AbortController();
  const load=async()=>{
   setLoading(true);setError('');
   // Public directory is authoritative for this region. All secondary rows are
   // constrained to published NRW club IDs; no global or cross-region fallback.
   try {
    const base=await supabase.from('clubs_nrw').select('id,slug,name,city').eq('published',true).order('name').abortSignal(abort.signal);
    if(base.error)throw base.error;
    const published=regionalClubs((base.data||[]) as Club[]);
    if(!active)return;
    setClubs(published);
    setEvents([]);setLeagues([]);setSelectedClub(null);
    if(!user||!published.length)return;
    const ids=published.map(c=>c.id);
    const [calendar,rows,membership]=await Promise.all([
     supabase.from('clubs_nrw_calendar').select('id,club_id,title,starts_at,venue')
      .in('club_id',ids).gte('starts_at',new Date().toISOString()).order('starts_at').limit(80).abortSignal(abort.signal),
     supabase.from('clubs_nrw_league_rows').select('id,club_id,season,league,team,place,played,match_points')
      .in('club_id',ids).order('season',{ascending:false}).limit(80).abortSignal(abort.signal),
     supabase.from('clubs_nrw_members').select('club_id').eq('user_id',user.id).abortSignal(abort.signal).maybeSingle(),
    ]);
    if(!active)return;
    if(calendar.error||rows.error)setError('Einige Vereinsangaben sind derzeit nicht verfügbar.');
    setEvents(calendar.error?[]:(calendar.data||[]) as Event[]);
    setLeagues(rows.error?[]:(rows.data||[]) as League[]);
    if(!membership.error)setSelectedClub(membership.data?.club_id||null);
   }catch {if(active)setError('NRW-Daten können derzeit nicht geladen werden.');}
   finally{if(active)setLoading(false);}
  };
  void load();
  return ()=>{active=false;abort.abort();};
 },[user?.id,validRegion]);
 useEffect(()=>{
  if(!validRegion)return;
  let active=true;
  const abort=new AbortController();
  setNewsLoading(true);setNewsError(false);setNews([]);
  if(!server){setNewsLoading(false);setNewsError(true);return;}
  void fetch(server+'/api/clubs-nrw/news',{signal:abort.signal,headers:{Accept:'application/json'}})
   .then(r=>r.ok?r.json():Promise.reject())
   .then((data:{items?:News[]})=>{
    if(!active)return;
    setNews(Array.isArray(data.items)?data.items.filter(n=>typeof n.title==='string'&&n.title.trim()&&httpsLink(n.url)).slice(0,12):[]);
   }).catch(()=>{if(active)setNewsError(true);})
   .finally(()=>{if(active)setNewsLoading(false);});
  return ()=>{active=false;abort.abort();};
 },[validRegion]);
 const cities=useMemo(()=>[...new Set(clubs.map(c=>c.city))].sort((a,b)=>a.localeCompare(b,'de')),[clubs]);
 const visibleClubs=useMemo(()=>clubs.filter(c=>!city||c.city===city),[city,clubs]);
 const featuredLeagues=useMemo(()=>{
  const own=leagues.filter(r=>r.club_id===selectedClub);
  return own.length?own:leagues;
 },[leagues,selectedClub]);
 const clubName=(id:string)=>clubs.find(c=>c.id===id)?.name||tr('Verein');
 const signIn=(target:Section)=><Link className="nrw-inline nrw-signin" to={'/profile?returnTo='+encodeURIComponent('/region/nrw/'+target)}>{tr('Anmelden')}<ArrowUpRight aria-hidden="true" size={15}/></Link>;
 if(!validRegion)return <section className="nrw-shell"><h1>{tr("Region nicht verfügbar")}</h1><p>{tr("Weitere Regionen werden erst nach der Freigabe ihrer Datenquellen aktiviert.")}</p><Link to="/chat">{tr("Zurück zu Schach-Treff")}</Link></section>;
 const content:Record<Section,React.ReactNode>={
  turniere:<>{loading?<p className="nrw-muted" role="status">{tr('Termine werden geladen …')}</p>:!user?<><p className="nrw-muted">{tr('Turnierkalender nach Anmeldung verfügbar.')}</p>{signIn('turniere')}</>:events.length?<ul className="nrw-items">{events.slice(0,detail==='turniere'?40:2).map(e=><li key={e.id}><time dateTime={e.starts_at}>{eventTime(e.starts_at,language)}</time><strong>{e.title}</strong><small>{clubName(e.club_id)}{e.venue?' · '+e.venue:''}</small></li>)}</ul>:<p className="nrw-muted">{tr('Keine bestätigten kommenden Termine eingetragen.')}</p>}</>,
  ligen:<>{loading?<p className="nrw-muted" role="status">{tr('Tabellen werden geladen …')}</p>:!user?<><p className="nrw-muted">{tr('Vereinsliga-Daten nach Anmeldung verfügbar.')}</p>{signIn('ligen')}</>:featuredLeagues.length?<ul className="nrw-items">{featuredLeagues.slice(0,detail==='ligen'?40:2).map(r=><li key={r.id}><span className="nrw-league-meta">{r.season} · {r.league}</span><strong>{r.place}. {r.team}</strong><small>{clubName(r.club_id)}</small><span className="nrw-score">{r.match_points} {tr('MP')}<span> · {r.played} {tr('Spiele')}</span></span></li>)}</ul>:<p className="nrw-muted">{tr('Noch keine Tabellen eingetragen.')}</p>}<details className="section-info"><summary>{tr('Datenquelle')}</summary><small className="nrw-source">{tr('Von Vereinen gepflegt · keine offizielle Live-Tabelle.')}</small></details>{user&&import.meta.env.VITE_SPIELTAG_ENABLED==='true'&&<Link className="nrw-inline" to="/spieltag">{tr('Mein Spieltag')} <ArrowUpRight aria-hidden="true" size={14}/></Link>}</>,
  vereine:<><label className="nrw-select">{tr('Stadt')} <select value={city} onChange={e=>setCity(e.target.value)}><option value="">{tr('Alle Städte in NRW')}</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>{loading?<p className="nrw-muted" role="status">{tr('Vereine werden geladen …')}</p>:visibleClubs.length?<ul className="nrw-items">{visibleClubs.slice(0,detail==='vereine'?100:2).map(c=><li key={c.id}><Link to={'/clubs-nrw/'+encodeURIComponent(c.slug)}><strong>{c.name}</strong><small>{c.city}</small></Link></li>)}</ul>:<p className="nrw-muted">{tr('Keine veröffentlichten Vereine für diese Auswahl.')}</p>}</>,
  news:<>{newsLoading?<p className="nrw-muted" role="status">{tr('Nachrichten werden geladen …')}</p>:news.length?<ul className="nrw-items">{news.slice(0,detail==='news'?12:3).map(n=><li key={n.url}><a href={httpsLink(n.url)!} target="_blank" rel="noopener noreferrer"><strong>{n.title}</strong><small>{tr('Schachbezirk Bochum · externe Quelle')}</small></a></li>)}</ul>:<p className="nrw-muted">{tr(newsError?'Nachrichten derzeit nicht verfügbar.':'Keine aktuellen Meldungen verfügbar.')}</p>}<details className="section-info"><summary>{tr('Info')}</summary><small className="nrw-source">{tr('Aktuell angebunden: Schachbezirk Bochum (NRW). Keine bundesweiten Meldungen.')}</small></details></>,
  live:<><p className="nrw-muted">{tr('Derzeit keine für NRW verifizierte Live-Übertragung eingebunden.')}</p><a className="nrw-inline" href="https://lichess.org/broadcast" target="_blank" rel="noopener noreferrer">{tr('Öffentliche Übertragungen bei Lichess')} <ArrowUpRight aria-hidden="true" size={14}/></a><details className="section-info"><summary>{tr('Info')}</summary><small className="nrw-source">{tr('Lichess-Übersicht ist weltweit und nicht nach NRW gefiltert.')}</small></details></>,

 };
 return <div className="nrw-shell" lang={language === "ua" ? "uk" : language} data-region-overview="nrw">
  <header className="nrw-header">
   <div className="nrw-header-top"><span className="nrw-kicker"><MapPin size={14} aria-hidden="true"/> {tr("Regionales Schach")}</span><span className="nrw-region-code" aria-current="page">NRW</span></div>
   <h1>{tr("Schach in Nordrhein-Westfalen")}</h1>
   <p>{tr("Turniere, Mannschaften, Vereine und Meldungen auf einen Blick.")}</p>
   <div className="nrw-links">{import.meta.env.VITE_SPIELER_V1_ENABLED==='true'&&<Link to="/spieler"><Users size={15} aria-hidden="true"/> {tr("Spieler suchen")}</Link>}{import.meta.env.VITE_VORBEREITUNG_ENABLED==='true'&&<Link to="/vorbereitung"><ShieldCheck size={15} aria-hidden="true"/> {tr("Gegnervorbereitung")}</Link>}</div>
  </header>
  {detail&&<div className="nrw-back"><Link to="/region/nrw"><ArrowLeft size={16} aria-hidden="true"/> {tr("Alle NRW-Themen")}</Link><span>{tr(sectionLabels[detail])}</span></div>}
  {error&&<p className="nrw-error" role="alert">{tr(error)}</p>}
   <div className={'nrw-grid'+(detail?' nrw-grid--detail':'')}>
    {(!detail||detail==='turniere')&&<Tile section="turniere" icon={<CalendarDays size={19}/>} detail={!!detail} count={events.length?String(events.length):undefined}>{content.turniere}</Tile>}
    {(!detail||detail==='ligen')&&<Tile section="ligen" icon={<Trophy size={19}/>} detail={!!detail} count={featuredLeagues.length?String(featuredLeagues.length):undefined}>{content.ligen}</Tile>}
    {(!detail||detail==='vereine')&&<Tile section="vereine" icon={<Users size={19}/>} detail={!!detail} count={visibleClubs.length?String(visibleClubs.length):undefined}>{content.vereine}</Tile>}
    {detail==='news'&&<Tile section="news" icon={<Newspaper size={19}/>} detail count={news.length?String(news.length):undefined}>{content.news}</Tile>}
    {detail==='live'&&<Tile section="live" icon={<Radio size={19}/>} detail>{content.live}</Tile>}
   </div>
   {!detail&&<details className="nrw-news">
    <summary><Newspaper size={18} aria-hidden="true"/><span>{tr('Nachrichten aus den Vereinen')}</span>{news.length>0&&<span className="nrw-count">{news.length}</span>}</summary>
    <div className="nrw-news-content">{content.news}<DashboardLink section="news">{tr(sectionActions.news)}</DashboardLink><DashboardLink section="live">{tr(sectionLabels.live)}</DashboardLink></div>
   </details>}
   <footer className="nrw-footer"><span>{tr('Vereinsangaben aus NRW · von Vereinen gepflegt.')}</span><Link to="/chat"><MessageSquare size={16} aria-hidden="true"/>{tr('Schach-Treff Deutschland')}<ArrowUpRight size={14} aria-hidden="true"/></Link></footer>
 </div>;
}
