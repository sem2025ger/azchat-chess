import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

type Club = { id:string;slug:string;name:string;city:string;address:string|null;training_times:string|null;website_url:string|null };
type Membership = { user_id:string;club_id:string;public_roster:boolean };
type Calendar = { id:string;club_id:string;title:string;starts_at:string;ends_at:string|null;venue:string|null };
type League = { id:string;club_id:string;season:string;league:string;team:string;place:number;played:number;match_points:number };
type Duel = { id:string;home_club_id:string;away_club_id:string;title:string;status:string;proposed_for:string|null };
type Room = { room_id:string;club_id:string };
type Role = { club_id:string;role:string };
type News = { title:string;url:string };
const SERVER = import.meta.env.VITE_SERVER_URL || '';
const dt = (value:string) => new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(value));
const card = 'rounded-xl border border-white/15 bg-black/20 p-4';
const button = 'rounded-lg bg-amber-500 px-3 py-2 font-semibold text-black disabled:opacity-40';
const input = 'w-full rounded-lg border border-white/20 bg-neutral-900 p-2 text-white';
const safe = (value:string|null|undefined) => { try { const u = new URL(value||''); return u.protocol==='https:'?u.href:null; } catch{return null;} };
const label='text-xs text-neutral-400';
const enabled = import.meta.env.VITE_CLUBS_NRW_ENABLED === 'true';

export default function ClubsNRWScreen() {
 const { slug }=useParams(); const {user}=useAuth();
 const [clubs,setClubs]=useState<Club[]>([]),[members,setMembers]=useState<Membership[]>([]),[roles,setRoles]=useState<Role[]>([]);
 const [calendar,setCalendar]=useState<Calendar[]>([]),[league,setLeague]=useState<League[]>([]),[duels,setDuels]=useState<Duel[]>([]),[rooms,setRooms]=useState<Room[]>([]);
 const [names,setNames]=useState<Record<string,string>>({}),[news,setNews]=useState<News[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [eventTitle,setEventTitle]=useState(''),[eventTime,setEventTime]=useState(''),[leagueName,setLeagueName]=useState(''),[teamName,setTeamName]=useState(''),[leagueSeason,setLeagueSeason]=useState('2026/27'),[leaguePlace,setLeaguePlace]=useState(1),[duelTarget,setDuelTarget]=useState(''),[duelTitle,setDuelTitle]=useState('');
 const club=clubs.find(c=>c.slug===slug),me=members.find(m=>m.user_id===user?.id),role=roles.find(r=>r.club_id===club?.id)?.role;
 const canEdit=role==='owner'||role==='moderator'||role==='admin',canLeague=role==='owner'||role==='admin';
 const load=useCallback(async()=>{
  if(!enabled)return;
  const base=await supabase.from('clubs_nrw').select('id,slug,name,city,address,training_times,website_url').eq('published',true).order('name');
  if(base.error){setError('Vereinsdaten derzeit nicht verfügbar.');return;}
  const list=(base.data||[]) as Club[];setClubs(list);
  if(!user){setMembers([]);setRoles([]);setCalendar([]);setLeague([]);setDuels([]);setRooms([]);return;}
  const [m,r,c,l,d,room]=await Promise.all([
   supabase.from('clubs_nrw_members').select('user_id,club_id,public_roster'),
   supabase.from('clubs_nrw_roles').select('club_id,role'),
   supabase.from('clubs_nrw_calendar').select('id,club_id,title,starts_at,ends_at,venue').order('starts_at'),
   supabase.from('clubs_nrw_league_rows').select('id,club_id,season,league,team,place,played,match_points').order('place'),
   supabase.from('clubs_nrw_duels').select('id,home_club_id,away_club_id,title,status,proposed_for'),
   supabase.from('clubs_nrw_room_links').select('club_id,room_id'),
  ]);
  if([m,r,c,l,d,room].some(v=>v.error)){setError('Nicht alle Vereinsdetails konnten geladen werden.');}
  setMembers(m.data||[]);setRoles(r.data||[]);setCalendar(c.data||[]);setLeague(l.data||[]);setDuels(d.data||[]);setRooms(room.data||[]);
  const ids=[...new Set((m.data||[]).filter(x=>x.public_roster).map(x=>x.user_id))];
  if(ids.length){const people=await supabase.from('profiles').select('id,username').in('id',ids.slice(0,100));if(!people.error)setNames(Object.fromEntries((people.data||[]).map(p=>[p.id,p.username||'Mitglied'])));}
 },[user]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!enabled||!SERVER)return;const ctrl=new AbortController();void fetch(SERVER+'/api/clubs-nrw/news',{signal:ctrl.signal})
  .then(r=>r.ok?r.json():Promise.reject()).then((v:{items?:News[]})=>setNews(Array.isArray(v.items)?v.items.slice(0,8).filter(n=>safe(n.url)):[])).catch(()=>{});return()=>ctrl.abort();},[]);
 async function act(operation:()=>PromiseLike<{error:unknown}>){if(!user||busy)return;setBusy(true);setError('');try{const r=await operation();if(r.error)throw r.error;await load();}catch{setError('Aktion nicht möglich. Bitte erneut versuchen.');}finally{setBusy(false);}}
 if(!enabled)return <p role="status">Schach in Bochum & NRW ist noch nicht aktiviert.</p>;
 if(!slug)return <section className="mx-auto w-full max-w-5xl space-y-5 p-4 text-white"><h1 className="text-3xl font-bold">Schach in Bochum & NRW</h1><p className={label}>Vereinsverzeichnis · Daten werden von Vereinen ergänzt und bestätigt.</p><div className="grid gap-4 md:grid-cols-2">{clubs.map(c=><Link key={c.id} to={'/clubs-nrw/'+c.slug} className={card+' block hover:border-amber-400'}><h2 className="text-xl font-semibold">{c.name}</h2><p>{c.city}</p></Link>)}</div>{!clubs.length&&<p>Keine veröffentlichten Vereine.</p>}<div className={card}><h2 className="mb-3 text-xl font-semibold">Schachbezirk Bochum — Nachrichten</h2>{news.length?news.map(n=><p key={n.url}><a className="text-amber-300 underline" href={n.url} rel="noopener noreferrer" target="_blank">{n.title}</a></p>):<a className="underline" rel="noopener noreferrer" href="https://sbboblog.wordpress.com/" target="_blank">Neuigkeiten beim Schachbezirk Bochum lesen</a>}<p className={label}>Nur Titel und externe Links, keine Artikelkopien.</p></div>{error&&<p role="alert">{error}</p>}</section>;
 if(!club)return <section className="p-6 text-white"><Link to="/clubs-nrw">← Vereine</Link><p>Verein nicht gefunden.</p></section>;
 const elected=members.filter(m=>m.club_id===club.id&&m.public_roster);
 const linked=rooms.filter(r=>r.club_id===club.id);
 const join=async()=>{if(!user)return;await act(()=>supabase.from('clubs_nrw_members').upsert({user_id:user.id,club_id:club.id,public_roster:false},{onConflict:'user_id'}));};
 const show=async(next:boolean)=>{if(!user)return;await act(()=>supabase.from('clubs_nrw_members').update({public_roster:next}).eq('user_id',user.id));};
 return <section className="mx-auto w-full max-w-5xl space-y-5 p-4 text-white">
 <Link className="text-amber-300 underline" to="/clubs-nrw">← Alle Vereine</Link><header><h1 className="text-3xl font-bold">{club.name}</h1><p>{club.city}</p></header>
 <div className={card}><h2 className="text-xl font-bold">Vereinsinformationen</h2><p><b>Adresse:</b> {club.address||'Noch nicht bestätigt'}</p><p><b>Training:</b> {club.training_times||'Bitte beim Verein erfragen'}</p>{safe(club.website_url)&&<a target="_blank" rel="noopener noreferrer" className="text-amber-300 underline" href={safe(club.website_url)!}>Vereinswebsite besuchen</a>}</div>
 <div className={card}><h2 className="text-xl font-bold">Freiwillige Mitglieder</h2>{!user?<Link className="underline" to="/profile">Anmelden, um einen Verein zu wählen</Link>:me?.club_id!==club.id?<button disabled={busy} className={button} onClick={()=>void join()}>Diesen Verein wählen</button>:<label className="flex gap-3"><input type="checkbox" checked={me.public_roster} disabled={busy} onChange={e=>void show(e.target.checked)}/>Meinen Benutzernamen in der Vereinsliste anzeigen</label>}<ul>{elected.map(m=><li key={m.user_id}>{names[m.user_id]||'Mitglied'}</li>)}</ul>{!elected.length&&<p className={label}>Noch keine öffentlich sichtbaren Mitglieder.</p>}</div>
 <div className={card}><h2 className="text-xl font-bold">Turnierkalender</h2><ul>{calendar.filter(x=>x.club_id===club.id).map(x=><li key={x.id} className="py-2"><b>{x.title}</b> — {dt(x.starts_at)} {x.venue&&'· '+x.venue}</li>)}</ul>{canEdit&&<form className="mt-3 grid gap-2" onSubmit={e=>{e.preventDefault();if(!user)return;void act(()=>supabase.from('clubs_nrw_calendar').insert({club_id:club.id,title:eventTitle.trim(),starts_at:new Date(eventTime).toISOString(),created_by:user.id,updated_by:user.id})).then(()=>{setEventTitle('');setEventTime('')});}}><input className={input} minLength={4} maxLength={120} required placeholder="Turniername" value={eventTitle} onChange={e=>setEventTitle(e.target.value)}/><input className={input} type="datetime-local" required value={eventTime} onChange={e=>setEventTime(e.target.value)}/><button disabled={busy} className={button}>Termin hinzufügen</button></form>}</div>
 <div className={card}><h2 className="text-xl font-bold">Ligatabelle — manuell gepflegt</h2><table className="w-full text-left text-sm"><thead><tr><th>Platz</th><th>Mannschaft</th><th>Saison</th><th>Punkte</th></tr></thead><tbody>{league.filter(x=>x.club_id===club.id).map(x=><tr key={x.id}><td>{x.place}</td><td>{x.team}</td><td>{x.season}</td><td>{x.match_points}</td></tr>)}</tbody></table>{canLeague&&<form className="mt-3 grid gap-2" onSubmit={e=>{e.preventDefault();if(!user)return;void act(()=>supabase.from('clubs_nrw_league_rows').insert({club_id:club.id,league:leagueName.trim(),team:teamName.trim(),season:leagueSeason,place:leaguePlace,updated_by:user.id}));}}><input className={input} required minLength={3} placeholder="Liga" value={leagueName} onChange={e=>setLeagueName(e.target.value)}/><input className={input} required minLength={3} placeholder="Mannschaft" value={teamName} onChange={e=>setTeamName(e.target.value)}/><input className={input} value={leagueSeason} onChange={e=>setLeagueSeason(e.target.value)} required/><input className={input} type="number" min={1} max={100} value={leaguePlace} onChange={e=>setLeaguePlace(Number(e.target.value))}/><button disabled={busy} className={button}>Tabellenzeile eintragen</button></form>}</div>
 <div className={card}><h2 className="text-xl font-bold">Geschlossene Vereinsräume</h2>{linked.length?linked.map(x=><Link key={x.room_id} to={'/chat?club='+x.room_id} className="block text-amber-300 underline">Vereinsraum öffnen (nur Mitglieder)</Link>):<p className={label}>Noch kein geschlossener Raum verknüpft. PR #126 erforderlich.</p>}</div>
 <div className={card}><h2 className="text-xl font-bold">Duell der Vereine</h2><p className="text-amber-300">Nur Vorschläge — Spielstart deaktiviert bis der Game-Test bestanden ist.</p>{duels.filter(x=>x.home_club_id===club.id||x.away_club_id===club.id).map(x=><p key={x.id}>{x.title} · {x.status}</p>)}{canEdit&&<form className="mt-3 grid gap-2" onSubmit={e=>{e.preventDefault();if(!user)return;void act(()=>supabase.from('clubs_nrw_duels').insert({home_club_id:club.id,away_club_id:duelTarget,title:duelTitle.trim(),created_by:user.id}));}}><select className={input} required value={duelTarget} onChange={e=>setDuelTarget(e.target.value)}><option value="">Gegnerverein wählen</option>{clubs.filter(x=>x.id!==club.id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input className={input} minLength={4} required value={duelTitle} onChange={e=>setDuelTitle(e.target.value)} placeholder="Duelltitel"/><button disabled={busy} className={button}>Vorschlag speichern (kein Spielstart)</button></form>}</div>
 {error&&<p role="alert" className="text-red-300">{error}</p>}<p className={label}>Nur freiwillig gewählte Mitgliedschaft. Ligaergebnisse werden nicht automatisch importiert.</p>
 </section>;
}
