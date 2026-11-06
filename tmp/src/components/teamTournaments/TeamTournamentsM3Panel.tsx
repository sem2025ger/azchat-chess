import { useEffect, useState, type FormEvent } from 'react';
import {
  createTournamentM3Api, createTournamentApi,
  type M3Event, type M3EventInput, type Tournament, type BoardResult,
} from '../../services/teamTournaments';
import type { TournamentCopy } from './copy';

const outcomes: { result: BoardResult; text: string }[] = [
  { result: '1-0', text: '1–0' },
  { result: '1/2-1/2', text: '½–½' },
  { result: '0-1', text: '0–1' },
  { result: '+/-', text: '+/−' },
  { result: '-/+', text: '−/+' },
  { result: '-/-', text: '−/−' },
];

export function M3Create({ tr, token, onCreated }: {
  tr: TournamentCopy; token: string; onCreated: (event: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (busy) return;
    const data = new FormData(form.currentTarget);
    const input: M3EventInput = {
      name: String(data.get('name') ?? '').trim(),
      start_time: String(data.get('start_time') ?? ''),
      registration_deadline: String(data.get('registration_deadline') ?? ''),
      boards_per_team: Number(data.get('boards_per_team') ?? 4),
      min_teams: Number(data.get('min_teams') ?? 2),
      max_teams: Number(data.get('max_teams') ?? 4),
    };
    setBusy(true);
    setError('');
    try {
      const controller = new AbortController();
      const created = await createTournamentM3Api(import.meta.env.VITE_SERVER_URL, token).create(input, controller.signal);
      onCreated(created.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'temporarily_unavailable');
    } finally { setBusy(false); }
  }
  return <section className="section-card">
    <h2>{tr('m3Create')}</h2>
    <form onSubmit={event => void submit(event)} className="grid gap-3">
      <label>{tr('name')}<input name="name" required maxLength={120} className="w-full min-h-11" /></label>
      <label>{tr('m3Start')}<input name="start_time" type="datetime-local" required className="w-full min-h-11" /></label>
      <label>{tr('m3Deadline')}<input name="registration_deadline" type="datetime-local" required className="w-full min-h-11" /></label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label>{tr('boards')}<input name="boards_per_team" type="number" min="1" max="16" defaultValue="4" required className="w-full min-h-11" /></label>
        <label>{tr('m3MinTeams')}<input name="min_teams" type="number" min="2" max="16" defaultValue="2" required className="w-full min-h-11" /></label>
        <label>{tr('m3MaxTeams')}<input name="max_teams" type="number" min="2" max="16" defaultValue="4" required className="w-full min-h-11" /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="min-h-11" disabled={busy}>{tr('m3Create')}</button>
    </form>
  </section>;
}

export function M3EventPanel({ tr, id, token, userId, onUpdated }: {
  tr: TournamentCopy; id: string; token?: string; userId?: string;
  onUpdated?: () => void;
}) {
  const [event, setEvent] = useState<M3Event | null>(null);
  const [published, setPublished] = useState<Tournament | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [choices, setChoices] = useState<{ id: string; username: string }[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [club, setClub] = useState('');
  const [invite, setInvite] = useState<{ id: string; token: string } | null>(null);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<BoardResult>('1-0');

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setEvent(null);
    setPublished(null);
    async function load() {
      const apiBase = import.meta.env.VITE_SERVER_URL;
      let data: M3Event;
      if (token) {
        const api = createTournamentM3Api(apiBase, token);
        try { data = await api.event(id, controller.signal); }
        catch (failure) {
          if (!(failure instanceof Error) || failure.message !== 'not_found') throw failure;
          // Signed-in spectators still see the roster-free public data only.
          const response = await fetch(new URL('/api/team-tournaments/' + id + '/self-service/public', apiBase),
            { signal: controller.signal, cache: 'no-store' });
          if (!response.ok) throw new Error('not_found');
          data = await response.json() as M3Event;
        }
      } else {
        const response = await fetch(new URL('/api/team-tournaments/' + id + '/self-service/public', apiBase),
          { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('not_found');
        data = await response.json() as M3Event;
      }
      let full: Tournament | null = null;
      if (token && ['published','finished'].includes(data.status)) {
        try { full = await createTournamentApi(apiBase, token).workspace(id, controller.signal); }
        catch { /* A signed-in player may have no staff workspace permissions. */ }
      }
      return { data, full };
    }
    void load().then(({data,full}) => {
      if (controller.signal.aborted) return;
      setEvent(data);
      setPublished(full);
      const mine = data.entries?.find(entry => entry.captain_id === userId);
      setDraft((data.lineups ?? []).filter(row => row.entry_id === mine?.id)
        .sort((a,b) => a.board_no-b.board_no).map(row => row.player_id));
    }, failure => {
      if (!controller.signal.aborted && (!(failure instanceof Error) || failure.message !== 'not_found')) {
        setError(failure instanceof Error ? failure.message : 'temporarily_unavailable');
      }
    });
    return () => controller.abort();
  }, [id, token, userId, version]);

  const api = token ? createTournamentM3Api(import.meta.env.VITE_SERVER_URL, token) : null;
  function reload() { setVersion(v => v + 1); onUpdated?.(); }
  async function mutate(action: (signal: AbortSignal) => Promise<unknown>) {
    if (!api || busy) return;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    try { await action(controller.signal); reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'temporarily_unavailable'); }
    finally { setBusy(false); }
  }
  async function searchPlayers() {
    if (!api || busy || !/^[A-Za-z0-9_-]{2,30}$/.test(search)) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.userSearch(search, new AbortController().signal);
      setChoices(result.users);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'temporarily_unavailable');
    } finally { setBusy(false); }
  }

  if (!event && !error) return null;
  if (!event) return <p role="alert">{error}</p>;
  const organizer = event.roles?.some(role => role.role === 'organizer') ?? false;
  const arbiter = event.roles?.some(role => role.role === 'arbiter') ?? false;
  const staff = organizer || arbiter;
  const myEntry = event.entries?.find(entry => entry.captain_id === userId);
  const active = event.status === 'registration' && Date.parse(event.registration_deadline) > Date.now();
  const boardCount = event.board_count;
  const myLineups = (event.lineups ?? [])
    .filter(row => row.entry_id === myEntry?.id)
    .sort((a, b) => a.board_no - b.board_no);
  const canSubmit = draft.length === event.board_count &&
    draft.every((playerId, index) => playerId === myLineups[index]?.player_id) &&
    myLineups.every(row => !!row.consented_at);
  const pendingConsents = [...new Set((event.lineups ?? [])
    .filter(row => row.player_id === userId && !row.consented_at)
    .map(row => row.entry_id))];
  const people = new Map((event.profiles ?? []).map(row => [row.id, row.username]));
  const invitationToken = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('invite') : null;

  return <section className="section-card" aria-label={tr('m3Create')}>
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <h2>{event.name}</h2>
      <button type="button" className="min-h-11" disabled={busy} onClick={reload}>{tr('refresh')}</button>
    </div>
    <p>{tr('m3Start')}: {new Date(event.starts_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})}</p>
    <p>{tr('m3Deadline')}: {new Date(event.registration_deadline).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})}</p>
    <p>{tr('m3Spots')}: {event.remaining_spots}/{event.max_teams}</p>
    {event.status === 'cancelled' && <p role="status">{tr('m3Cancelled')}</p>}
    <ul>{event.teams.map(team => <li key={team.id}>{team.name}</li>)}</ul>
    {(event.status === 'published' || event.status === 'finished') &&
      !!event.published_lineups?.length && <div className="mt-3 grid gap-2">
        <h3>{tr('m3Lineup')}</h3>
        {event.teams.map(team => <section key={team.id} className="rounded-lg border border-current/20 p-2">
          <h4>{team.name}</h4>
          <ol className="list-decimal list-inside">
            {event.published_lineups?.filter(line => line.entry_id === team.id)
              .sort((a,b) => a.board_no-b.board_no)
              .map(line => <li key={line.board_no}>{tr('board')} {line.board_no}: {line.username ?? '—'}</li>)}
          </ol>
        </section>)}
      </div>}
    {error && <p role="alert">{error}</p>}
    {active && !!invitationToken && !myEntry && !!api && <button type="button" className="min-h-11"
      disabled={busy} onClick={() => void mutate(signal => api.redeem(id, invitationToken, signal))}>
      {tr('m3Redeem')}
    </button>}
    {organizer && active && api && <form onSubmit={form => {
      form.preventDefault();
      void mutate(async signal => {
        const result = await api.invite(id, club.trim(), signal);
        setInvite({ id: result.invite_id, token: result.token });
      });
    }} className="mt-3 grid gap-2">
      <h3>{tr('m3Invite')}</h3>
      <label>{tr('m3ClubName')}<input required maxLength={120} className="w-full min-h-11"
        value={club} onChange={evt=>setClub(evt.target.value)} /></label>
      <button className="min-h-11" disabled={busy} type="submit">{tr('m3Invite')}</button>
      {invite && <>
        <p>{tr('m3InviteNote')}</p>
        <input readOnly className="w-full" aria-label={tr('m3Invite')}
          value={new URL('/spieltag?tab=turniere&tournament='+id+'&invite='+invite.token,window.location.origin).href} />
        <button className="min-h-11" type="button" disabled={busy}
          onClick={()=>void mutate(async signal=>{
            await api.revoke(id,invite.id,signal);
            setInvite(null);
          })}>{tr('m3Withdraw')}</button>
      </>}
    </form>}
    {api && active && pendingConsents.map(entryId =>
      <button key={entryId} className="mt-3 min-h-11" type="button" disabled={busy}
        onClick={() => void mutate(signal => api.consent(id, entryId, signal))}>
        {tr('m3Consent')} · {event.entries?.find(entry => entry.id === entryId)?.club_name ?? '—'}
      </button>)}
    {myEntry && active && api && <section className="mt-4 grid gap-2">
      <h3>{tr('m3Lineup')} · {myEntry.club_name}</h3>
      {myEntry.submitted_at && <p role="status">{tr('m3Submitted')}</p>}
      <ol className="list-decimal list-inside">{draft.map((player,index)=><li key={player}>
        {people.get(player) ?? player}
        <button type="button" className="min-h-11 mx-2" disabled={busy || index===0}
          onClick={()=>setDraft(curr=>{
            const next=[...curr];[next[index-1],next[index]]=[next[index],next[index-1]];return next;
          })}>↑</button>
        <button type="button" className="min-h-11 mx-2" disabled={busy || index===draft.length-1}
          onClick={()=>setDraft(curr=>{
            const next=[...curr];[next[index],next[index+1]]=[next[index+1],next[index]];return next;
          })}>↓</button>
        <button type="button" className="min-h-11" disabled={busy}
          onClick={()=>setDraft(curr=>curr.filter((_,i)=>i!==index))}>×</button>
      </li>)}</ol>
      <div className="flex flex-wrap gap-2">
        <input value={search} aria-label={tr('m3Search')} className="min-h-11"
          onChange={e=>setSearch(e.target.value)} placeholder={tr('m3Search')} />
        <button type="button" disabled={busy || search.length < 2} className="min-h-11"
          onClick={()=>void searchPlayers()}>{tr('m3Search')}</button>
      </div>
      {choices.map(player=><button type="button" key={player.id}
        disabled={busy || draft.includes(player.id) || draft.length>=boardCount}
        onClick={()=>{setDraft(curr=>[...curr,player.id]);setChoices([]);setSearch('');}}
        className="min-h-11 text-left">{tr('m3Add')}: {player.username}</button>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11" disabled={busy}
          onClick={()=>void mutate(signal=>api.lineup(id,draft,signal))}>{tr('m3Draft')}</button>
        <button type="button" className="min-h-11" disabled={busy}
          onClick={()=>void mutate(signal=>api.lineupAction(id,'previous',signal))}>{tr('m3Previous')}</button>
        <button type="button" className="min-h-11" disabled={busy || !canSubmit}
          onClick={()=>void mutate(signal=>api.lineupAction(id,'submit',signal))}>{tr('m3Submit')}</button>
        {myEntry.submitted_at && <button type="button" className="min-h-11" disabled={busy}
          onClick={()=>void mutate(signal=>api.lineupAction(id,'withdraw',signal))}>{tr('m3Withdraw')}</button>}
      </div>
      {myLineups.some(row=>!row.consented_at) && <p>{tr('m3Waiting')}</p>}
    </section>}
    {published && (staff || !!myEntry) && api && <section className="mt-4 grid gap-3">
      <h3>{tr('m3Disputes')}</h3>
      {published.matches.map(match => <section className="rounded-xl border border-current/20 p-3" key={match.id}>
        <h4>{tr('round')} {match.round_no}: {event.teams.find(team=>team.id===match.home_team_id)?.name} – {event.teams.find(team=>team.id===match.away_team_id)?.name}</h4>
        {match.boards.map(board => {
          const state=event.states?.find(row=>row.match_id===match.id && row.board_no===board.board_no);
          const reported=(event.reports??[]).filter(row=>row.match_id===match.id && row.board_no===board.board_no);
          const homePlayer=(event.lineups??[]).find(row=>row.entry_id===match.home_team_id&&row.board_no===board.board_no);
          const awayPlayer=(event.lineups??[]).find(row=>row.entry_id===match.away_team_id&&row.board_no===board.board_no);
          const isOwnTeam = !!myEntry && [match.home_team_id,match.away_team_id].includes(myEntry.id);
          return <div key={board.board_no} className={state?.status === 'disputed'
            ? 'rounded-lg border-2 border-red-500/80 bg-red-950/20 px-2 py-3'
            : 'py-3 border-t border-current/10'}>
            <p>{tr('board')} {board.board_no}: {people.get(homePlayer?.player_id ?? '')??'–'} – {people.get(awayPlayer?.player_id ?? '')??'–'}</p>
            <p>{tr('white')}: {board.home_white ? people.get(homePlayer?.player_id??'') : people.get(awayPlayer?.player_id??'')}</p>
            <p>{board.result} · {state?.status ?? 'pending'}</p>
            {reported.map(report => <p key={report.side}>{report.side}: {report.result} ({report.kind})</p>)}
            {isOwnTeam && !board.confirmed && <div className="flex flex-wrap gap-2">
              {(['1-0','1/2-1/2','0-1'] as const).map(result=><button type="button" key={result}
                className="min-h-11" disabled={busy} onClick={()=>void mutate(signal=>
                  api.boardAction(id,match.id,board.board_no,'report',result,null,signal))}>{result}</button>)}
              {(['+/-','-/+','-/-'] as const).map(result=><button type="button" key={'forfeit-'+result}
                className="min-h-11" disabled={busy}
                aria-label={tr('whiteForfeit')+' / '+tr('blackForfeit')+': '+result}
                onClick={()=>void mutate(signal=>
                  api.boardAction(id,match.id,board.board_no,'forfeit',result,null,signal))}>
                {result}</button>)}
              <button type="button" className="min-h-11" disabled={busy}
                onClick={()=>void mutate(signal=>api.boardAction(id,match.id,board.board_no,'confirm',null,null,signal))}>
                {tr('confirm')}</button>
            </div>}
            {staff && <div className="grid gap-2 mt-2">
              <select className="min-h-11" value={decision}
                onChange={e=>setDecision(e.target.value as BoardResult)}>
                {outcomes.map(item=><option value={item.result} key={item.result}>{item.text}</option>)}
              </select>
              <input className="min-h-11 w-full" value={reason} maxLength={500}
                onChange={e=>setReason(e.target.value)} placeholder={tr('reason')} />
              <button type="button" className="min-h-11" disabled={busy||!reason.trim()}
                onClick={()=>void mutate(signal=>api.boardAction(id,match.id,board.board_no,
                  board.confirmed?'correct':'decide',decision,reason.trim(),signal))}>
                {board.confirmed?tr('m3Correction'):tr('m3Decide')}
              </button>
            </div>}
          </div>;
        })}
      </section>)}
    </section>}
  </section>;
}
