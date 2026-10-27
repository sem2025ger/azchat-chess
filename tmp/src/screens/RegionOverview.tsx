import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CalendarDays, Radio, Newspaper, ShieldCheck, MapPin, Trophy, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import NationwideChatRail from '../components/schachTreff/NationwideChatRail';
import './RegionOverview.css';

type Club = { id:string; slug:string; name:string; city:string };
type Event = { id:string;club_id:string;title:string;starts_at:string;venue:string|null };
type League = { id:string;club_id:string;season:string;league:string;team:string;place:number;played:number;match_points:number };
type News = { title:string;url:string };
type Section = 'turniere'|'ligen'|'vereine'|'news'|'live';
const sections: Section[] = ['turniere','ligen','vereine','news','live'];
const sectionLabels: Record<Section,string> = {
 turniere:'Turniere',ligen:'Ligen',vereine:'Vereine',news:'Nachrichten',live:'Live-Übertragungen',
};
const server=import.meta.env.VITE_SERVER_URL || '';
const eventTime=(value:string)=>new Intl.DateTimeFormat('de-DE',{
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
function Tile({section,icon,children,count}:{section:Section;icon:React.ReactNode;children:React.ReactNode;count?:string}){
 return <section className={'nrw-card nrw-card--'+section} aria-labelledby={'nrw-'+section}>
  <div className="nrw-card-head"><span className="nrw-card-icon" aria-hidden="true">{icon}</span>
   <h2 id={'nrw-'+section}>{sectionLabels[section]}</h2>
   {count && <span className="nrw-count">{count}</span>}
  </div>
  <div className="nrw-card-content">{children}</div>
  <DashboardLink section={section}>Details ansehen</DashboardLink>
 </section>;
}
export default function RegionOverview(){
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
 const clubName=(id:string)=>clubs.find(c=>c.id===id)?.name||'Verein';
 if(!validRegion)return <section className="nrw-shell"><h1>Region nicht verfügbar</h1><p>Weitere Regionen werden erst nach der Freigabe ihrer Datenquellen aktiviert.</p><Link to="/chat">Zurück zu Schach-Treff</Link></section>;
 const content:Record<Section,React.ReactNode>={
  turniere:<>{loading?<p className="nrw-muted" role="status">Termine werden geladen …</p>:!user?<p className="nrw-muted">Turnierkalender nach Anmeldung verfügbar.</p>:events.length?<ul className="nrw-items">{events.slice(0,detail==='turniere'?40:3).map(e=><li key={e.id}><time dateTime={e.starts_at}>{eventTime(e.starts_at)}</time><strong>{e.title}</strong><small>{clubName(e.club_id)}{e.venue?' · '+e.venue:''}</small></li>)}</ul>:<p className="nrw-muted">Keine bestätigten kommenden Termine eingetragen.</p>}</>,
  ligen:<>{loading?<p className="nrw-muted" role="status">Tabellen werden geladen …</p>:!user?<p className="nrw-muted">Vereinsliga-Daten nach Anmeldung verfügbar.</p>:featuredLeagues.length?<ul className="nrw-items">{featuredLeagues.slice(0,detail==='ligen'?40:3).map(r=><li key={r.id}><span className="nrw-muted">{r.season} · {r.league}</span><strong>{r.place}. {r.team}</strong><small>{clubName(r.club_id)} · {r.match_points} MP · {r.played} Spiele</small></li>)}</ul>:<p className="nrw-muted">Noch keine Tabellen eingetragen.</p>}<small className="nrw-source">Von Vereinen gepflegt · keine offizielle Live-Tabelle.</small>{user&&import.meta.env.VITE_SPIELTAG_ENABLED==='true'&&<Link className="nrw-inline" to="/spieltag">Mein Spieltag <ArrowUpRight aria-hidden="true" size={14}/></Link>}</>,
  vereine:<><label className="nrw-select">Stadt <select value={city} onChange={e=>setCity(e.target.value)}><option value="">Alle Städte in NRW</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>{loading?<p className="nrw-muted" role="status">Vereine werden geladen …</p>:visibleClubs.length?<ul className="nrw-items">{visibleClubs.slice(0,detail==='vereine'?100:3).map(c=><li key={c.id}><Link to={'/clubs-nrw/'+encodeURIComponent(c.slug)}><strong>{c.name}</strong><small>{c.city}</small></Link></li>)}</ul>:<p className="nrw-muted">Keine veröffentlichten Vereine für diese Auswahl.</p>}<small className="nrw-source">Standort nicht ermittelt · Auswahl nach Stadt.</small></>,
  news:<>{newsLoading?<p className="nrw-muted" role="status">Nachrichten werden geladen …</p>:news.length?<ul className="nrw-items">{news.slice(0,detail==='news'?12:3).map(n=><li key={n.url}><a href={httpsLink(n.url)!} target="_blank" rel="noopener noreferrer"><strong>{n.title}</strong><small>Schachbezirk Bochum · externe Quelle</small></a></li>)}</ul>:<p className="nrw-muted">{newsError?'Nachrichten derzeit nicht verfügbar.':'Keine aktuellen Meldungen verfügbar.'}</p>}<small className="nrw-source">Aktuell angebunden: Schachbezirk Bochum (NRW). Keine bundesweiten Meldungen.</small></>,
  live:<><p className="nrw-muted">Derzeit keine für NRW verifizierte Live-Übertragung eingebunden.</p><a className="nrw-inline" href="https://lichess.org/broadcast" target="_blank" rel="noopener noreferrer">Öffentliche Übertragungen bei Lichess <ArrowUpRight aria-hidden="true" size={14}/></a><small className="nrw-source">Lichess-Übersicht ist weltweit und nicht nach NRW gefiltert.</small></>,
 };
 return <div className="nrw-shell" lang="de" data-region-overview="nrw">
  <header className="nrw-header">
   <div className="nrw-header-top"><span className="nrw-kicker"><MapPin size={14} aria-hidden="true"/> Regionales Schach</span><span className="nrw-region-code" aria-current="page">NRW</span></div>
   <h1>Schach in Nordrhein-Westfalen</h1>
   <p>Turniere, Mannschaften, Vereine und Meldungen auf einen Blick.</p>
   <div className="nrw-links"><Link to="/chat"><MessageSquare size={15} aria-hidden="true"/> Schach-Treff Deutschland</Link>{import.meta.env.VITE_SPIELER_V1_ENABLED==='true'&&<Link to="/spieler"><Users size={15} aria-hidden="true"/> Spieler</Link>}{import.meta.env.VITE_VORBEREITUNG_ENABLED==='true'&&<Link to="/vorbereitung"><ShieldCheck size={15} aria-hidden="true"/> Vorbereitung</Link>}</div>
  </header>
  {detail&&<div className="nrw-back"><Link to="/region/nrw"><ArrowLeft size={16} aria-hidden="true"/> Alle NRW-Themen</Link><span>{sectionLabels[detail]}</span></div>}
  {error&&<p className="nrw-error" role="alert">{error}</p>}
  <div className="nrw-layout">
   <div className={'nrw-grid'+(detail?' nrw-grid--detail':'')}>
    {(!detail||detail==='turniere')&&<Tile section="turniere" icon={<CalendarDays size={19}/>} count={events.length?String(events.length):undefined}>{content.turniere}</Tile>}
    {(!detail||detail==='ligen')&&<Tile section="ligen" icon={<Trophy size={19}/>} count={featuredLeagues.length?String(featuredLeagues.length):undefined}>{content.ligen}</Tile>}
    {(!detail||detail==='vereine')&&<Tile section="vereine" icon={<Users size={19}/>} count={clubs.length?String(clubs.length):undefined}>{content.vereine}</Tile>}
    {(!detail||detail==='news')&&<Tile section="news" icon={<Newspaper size={19}/>} count={news.length?String(news.length):undefined}>{content.news}</Tile>}
    {(!detail||detail==='live')&&<Tile section="live" icon={<Radio size={19}/>} >{content.live}</Tile>}
   </div>
   <NationwideChatRail />
  </div>
 </div>;
}
