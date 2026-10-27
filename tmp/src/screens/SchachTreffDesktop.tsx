import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import VorbereitungLink from '../components/spieler/VorbereitungLink';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { copy as t } from '../components/schachTreff/copy';
import '@fontsource/bodoni-moda/latin-600.css';
import './SchachTreffDesktop.css';

type Profile = { id: string; username: string };
type Message = { id: string; author_id: string; body: string; created_at: string };
type Panel = 'tournaments' | 'members' | 'ranking' | 'about';
const warned = new Set<string>();
export default function SchachTreffDesktop() {
  const { user, isLoading } = useAuth();
  const [clubId, setClubId] = useState<string | null>(null);
  const [pin, setPin] = useState<{ body: string; author: string | null } | null>(null);
  const [canPin, setCanPin] = useState(false);
  const [pinAvailable, setPinAvailable] = useState(false);
  const [pinEdit, setPinEdit] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [member, setMember] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [player, setPlayer] = useState<Profile | null>(null);
  const [notify, setNotify] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.title; document.title = t.title; return () => { document.title = previous; }; }, []);
  useEffect(() => { if (panel || player) dialog.current?.showModal(); else dialog.current?.close(); }, [panel, player]);
  const refresh = useCallback(async () => {
    const club = await supabase.from('chess_clubs').select('id').eq('slug', 'chessaz-deutsch').maybeSingle();
    if (club.error) throw club.error;
    setClubId(club.data?.id ?? null);
    let pinnedAuthor: string | null = null;
    let pinMigrationAvailable = false;
    if (club.data) {
      const pinInfo = await supabase.from('chess_clubs').select('pinned_body,pinned_by').eq('id',club.data.id).maybeSingle();
      if (pinInfo.error) {
        const code = pinInfo.error.code;
        if (['42703','PGRST204','PGRST205'].includes(code)) {
          if (!warned.has('pin-migration')) { warned.add('pin-migration'); console.warn('Schach-Treff pin unavailable:', code); }
          setPin(null);
          setPinEdit(false);
        } else throw pinInfo.error;
      } else { pinMigrationAvailable = true; pinnedAuthor = pinInfo.data?.pinned_by ?? null; setPin(pinInfo.data?.pinned_body ? { body: pinInfo.data.pinned_body, author: pinnedAuthor } : null); }
    } else setPin(null);
    setPinAvailable(pinMigrationAvailable);
    if (!user || !club.data) { setCanPin(false); setMember(false); setMessages([]); setProfiles([]); return; }
    const membership = await supabase.from('chess_club_members').select('user_id,role').eq('club_id', club.data.id).eq('user_id', user.id).maybeSingle();
    if (membership.error) throw membership.error;
    setMember(Boolean(membership.data));
    setCanPin(pinMigrationAvailable && ['admin','moderator'].includes(membership.data?.role ?? ''));
    if (!membership.data) { setMessages([]); setProfiles([]); return; }
    const [feed, members] = await Promise.all([
      supabase.from('chess_club_messages').select('id,author_id,body,created_at').eq('club_id', club.data.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('chess_club_members').select('user_id').eq('club_id', club.data.id).order('joined_at').limit(200),
    ]);
    if (feed.error) throw feed.error;
    if (members.error) throw members.error;
    const ids = [...new Set([...members.data.map(m => m.user_id), ...feed.data.map(m => m.author_id), ...(pinnedAuthor ? [pinnedAuthor] : [])])];
    const people = ids.length ? await supabase.from('profiles').select('id,username').in('id', ids) : { data: [], error: null };
    if (people.error) throw people.error;
    setProfiles(people.data ?? []); setRoster(members.data.map(m => m.user_id));
    setMessages([...feed.data].reverse());
  }, [user]);
  useEffect(() => {
    let active = true;
    const update = async () => {
      try { await refresh(); if (active) setError(''); }
      catch (e) {
        const code = (e as { code?: string }).code;
        if (active && code && ['PGRST205', '42P01'].includes(code)) {
          setMissing(true);
          if (!warned.has(code)) { warned.add(code); console.warn('Schach-Treff unavailable:', code); }
        } else if (active) setError(t.error);
      } finally { if (active) setLoading(false); }
    };
    if (!isLoading) void update();
    const timer = window.setInterval(() => { if (!document.hidden && !isLoading) void update(); }, 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh, isLoading]);
  async function perform(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true); setError('');
    try { const result = await action(); if (result.error) throw result.error; await refresh(); return true; }
    catch { setError(t.error); return false; } finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!user || !clubId || !member || busy || !body.trim()) return;
    if (await perform(() => supabase.from('chess_club_messages').insert({ club_id: clubId, author_id: user.id, body: body.trim() }))) setBody('');
  }
  async function savePin(event: FormEvent) {
    event.preventDefault();
    if (!clubId || !pinAvailable || !canPin || busy) return;
    if (await perform(() => supabase.rpc('set_club_pin', { p_club_id: clubId, p_body: pinDraft }))) setPinEdit(false);
  }
  function stamp(value: string) {
    const date = new Date(value), now = new Date(), yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return date.toDateString() === now.toDateString() ? time : date.toDateString() === yesterday.toDateString() ? `${t.yesterday} ${time}` : `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time}`;
  }
  if (missing) return null;
  const members = profiles.filter(p => roster.includes(p.id));
  return <section className="schach-treff" lang="de" data-schach-treff-desktop>
    <header><h1>{t.title}</h1><div className="st-menu"><button aria-label={t.more} aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
      {menu && <nav aria-label={t.more}>{(['tournaments', 'members', 'ranking', 'about'] as const).map(key => <button key={key} onClick={() => { setPanel(key); setMenu(false); }}>{t[key]}{key === 'tournaments' && <small>{t.soon}</small>}</button>)}</nav>}
    </div></header>
    {error && <p role="alert">{error}</p>}
    {(loading || isLoading) ? <p role="status">{t.loading}</p> : !clubId ? <p>{t.noClub}</p> : !member ? <div className="st-surface"><p>{t.joinHint}</p>{user ? <button disabled={busy} onClick={() => void perform(() => supabase.from('chess_club_members').insert({ club_id: clubId, user_id: user.id, role: 'member' }))}>{t.join}</button> : <Link to="/profile?returnTo=%2Fchat">{t.login}</Link>}</div> :
    <div className="st-columns"><aside className="st-surface st-rooms"><h2>{t.rooms}</h2><button aria-current="page">{t.general}</button><h2>{t.clubs}</h2></aside>
      <section className="st-surface st-chat"><h2>{t.general}</h2>
        {pinAvailable && (pin || canPin) && <div className="st-pin">
          <div className="st-pin-title">{t.pinned}{pin?.author && ' · '}{pin?.author ? profiles.find(p => p.id === pin.author)?.username ?? '' : ''}
            {canPin && <button onClick={() => { setPinEdit(true); setPinDraft(pin?.body ?? ''); }}>{t.change}</button>}
          </div>
          {pinEdit ? <form onSubmit={savePin} className="st-pin-form">
            <input aria-label={t.pinned} value={pinDraft} maxLength={500} onChange={e => setPinDraft(e.target.value)} />
            <button disabled={busy}>{t.pinAction}</button>
            <button type="button" onClick={() => setPinEdit(false)}>{t.cancel}</button>
          </form> : pin && <p>{pin.body}</p>}
        </div>}
        <div className="st-messages" aria-live="polite">
        {!messages.length && !error && <p>{t.empty}</p>}{messages.map(message => {
          const author = profiles.find(p => p.id === message.author_id);
          return <article key={message.id}><div className="st-message-heading">{author && <button className="st-name" onClick={() => setPlayer(author)}>{author.username}</button>}<time dateTime={message.created_at}>{stamp(message.created_at)}</time></div><p>{message.body}</p></article>;
        })}</div><form onSubmit={send}><input aria-label={t.placeholder} placeholder={t.placeholder} value={body} onChange={e => setBody(e.target.value)} maxLength={1200} required /><button disabled={busy || !body.trim()}>{t.send}</button></form></section>
      <aside className="st-right" />
    </div>}
    <dialog ref={dialog} onCancel={() => { setPanel(null); setPlayer(null); }} onClose={() => { setPanel(null); setPlayer(null); }}>
      <button className="st-close" onClick={() => { setPanel(null); setPlayer(null); }}>{t.close}</button>
      {/* Genuine ratings will be introduced by the future Glicko-2 task; do not display stored placeholder values here. */}
      {player ? <><h2>{player.username}</h2><p>{t.noLocation}</p><dl><dt>{t.blitz}</dt><dd>—</dd><dt>{t.rapid}</dt><dd>—</dd></dl><VorbereitungLink onClick={()=>{setPlayer(null);setPanel(null);}}/></> : panel === 'tournaments' ? <><h2 className="st-display">{t.tournamentTitle}</h2><p>{t.tournamentText}</p><button aria-pressed={notify} onClick={() => setNotify(!notify)}>{notify ? t.notified : t.notify}</button></> : panel === 'about' ? <><h2>{t.about}</h2><p>{t.aboutText}</p></> : panel === 'ranking' ? <><h2>{t.ranking}</h2><p>{t.rankingSoon}</p></> : panel && <><h2>{t[panel]}</h2>{!members.length && !error && <p>{t.noMembers}</p>}{members.map(p => <div className="st-member" key={p.id}><button className="st-name" onClick={() => setPlayer(p)}>{p.username}</button></div>)}</>}
    </dialog>
  </section>;
}
