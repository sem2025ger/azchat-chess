import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  createTournamentApi, TournamentError, type Tournament, type TournamentApi, type TournamentList, type TournamentPreview,
} from '../../services/teamTournaments';
import { tournamentCopy, tournamentErrorMessage, type TournamentCopy } from './copy';
import { CreateTournament, TournamentDetail } from './TeamTournamentViews';
import { M3Create, M3EventPanel } from './TeamTournamentsM3Panel';
import '../../styles/sections.css';

type ScopeProps = { selected: string | null; onSelect: (id: string | null) => void };
export default function TeamTournamentsTab(props: ScopeProps) {
  const { session, isLoading } = useAuth();
  const { language } = useLanguage();
  const tr = tournamentCopy(language);
  if (isLoading) return <p role="status">{tr('loading')}</p>;
  return <TournamentScope key={props.selected + ':' + (session?.user.id ?? 'spectator')}
    {...props} token={session?.access_token} actorId={session?.user.id} tr={tr} />;
}

function TournamentScope({ selected, onSelect, token, actorId, tr }: ScopeProps & { token?: string; actorId?: string; tr: TournamentCopy }) {
  const location = useLocation();
  const [list, setList] = useState<TournamentList | null>(null);
  const [event, setEvent] = useState<Tournament | null>(null);
  const [preview, setPreview] = useState<TournamentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const mutation = useRef<AbortController | null>(null);

  function reload() {
    setError(null);
    setSaved(false);
    setRevision(x => x + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setBusy(false);
    setPreview(null);
    setError(null);
    async function load() {
      const api = createTournamentApi(import.meta.env.VITE_SERVER_URL, token);
      const rows = await api.list(signal);
      if (!selected) return { rows, detail: null };
      let detail: Tournament | null = null;
      if (token) {
        try { detail = await api.workspace(selected, signal); }
        catch (error) {
          if (!(error instanceof TournamentError) || error.code !== 'not_found') throw error;
        }
      }
      if (detail) return { rows, detail };
      try { detail = await api.detail(selected, signal); }
      catch (error) {
        if (import.meta.env.VITE_TEAM_TOURNAMENTS_M3_ENABLED !== 'true' ||
            !(error instanceof TournamentError) || error.code !== 'not_found') throw error;
        // Registration has a separate M3 public view; no M1 pairing exists yet.
      }
      return { rows, detail };
    }
    void load().then(({ rows, detail }) => {
      if (!signal.aborted) { setList(rows); setEvent(detail); }
    }, error => {
      if (!signal.aborted) {
        setList(null);
        setEvent(null);
        setSaved(false);
        setError(error);
      }
    }).finally(() => { if (!signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      mutation.current?.abort();
      mutation.current = null;
    };
  }, [selected, token, revision]);

  async function run(action: (api: TournamentApi, signal: AbortSignal) => Promise<unknown>, refresh = true) {
    if (mutation.current || loading) return;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await action(createTournamentApi(import.meta.env.VITE_SERVER_URL, token), controller.signal);
      if (!controller.signal.aborted && refresh) {
        setSaved(true);
        setRevision(x => x + 1);
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (mutation.current === controller) mutation.current = null;
    }
  }

  const current = list?.tournaments.find(x => x.id === selected);
  const conflict = error instanceof TournamentError && ['result_conflict', 'invalid_state'].includes(error.code);
  const locked = busy || conflict || loading;
  // A captain's single-use invitation must survive the sign-in redirect.
  // Restrict the return location to our own Spieltag route (never an external URL).
  const invite = new URLSearchParams(location.search).get('invite');
  const returnTo = selected && invite && /^[a-f0-9]{64}$/.test(invite)
    ? '/spieltag?tab=turniere&tournament=' + encodeURIComponent(selected) + '&invite=' + invite
    : '/spieltag?tab=turniere' + (selected ? '&tournament=' + encodeURIComponent(selected) : '');
  const signIn = '/profile?returnTo=' + encodeURIComponent(returnTo);
  return <section className="section-page team-tournament-page">
    <header>
      <h1>{event?.name ?? tr('tab')}</h1>
      {event && <p>{tr(event.status)}{current?.current_round ? ' · ' + tr('round') + ' ' + current.current_round : ''}</p>}
      <div className="team-tournament-actions">
        {selected && <button type="button" onClick={() => onSelect(null)}>{tr('back')}</button>}
        {!token && <Link to={signIn}>{tr('signIn')}</Link>}
        <button type="button" disabled={busy || loading} onClick={reload}>{tr('refresh')}</button>
      </div>
    </header>
    {loading && <p role="status">{tr('loading')}</p>}
    {error != null && <p role="alert">{tournamentErrorMessage(error instanceof TournamentError ? error.code : '', tr)}</p>}
    {saved && !loading && <p role="status">{tr('saved')}</p>}
    {!selected && list && <>
      <section className="section-card">
        <h2>{tr('tab')}</h2>
        {list.tournaments.length === 0 ? <p>{tr('empty')}</p> : <ul className="team-tournament-list">
          {list.tournaments.map(item => <li key={item.id}>
            <Link to={'/spieltag?tab=turniere&tournament=' + item.id}>{item.name}</Link>
            <span>{tr(item.status)}{item.current_round ? ' · ' + tr('round') + ' ' + item.current_round : ''}</span>
          </li>)}
        </ul>}
      </section>
      {list.can_create && <CreateTournament tr={tr} busy={locked} onCreate={(name, rules) => void run(async (api, signal) => {
        const result = await api.create(name, rules, signal);
        if (!signal.aborted) onSelect(result.id);
      }, false)} />}
      {import.meta.env.VITE_TEAM_TOURNAMENTS_M3_ENABLED === 'true' && token && list.can_create &&
        <M3Create tr={tr} token={token} onCreated={id => onSelect(id)} />}
    </>}
    {selected && import.meta.env.VITE_TEAM_TOURNAMENTS_M3_ENABLED === 'true' &&
      <M3EventPanel tr={tr} id={selected} token={token}
        userId={actorId}
        onUpdated={reload} />}
    {event && <TournamentDetail event={event} preview={preview} tr={tr} busy={locked}
      captainId={current?.captain_team_id} activeRound={current?.current_round} actions={{
        team: (name, captainId) => void run((api, signal) => api.team(event.id, name, captainId, signal)),
        arbiter: actor => void run((api, signal) => api.arbiter(event.id, actor, signal)),
        transition: action => void run((api, signal) => api.transition(event.id, action, signal)),
        requestPreview: () => void run(async (api, signal) => {
          const value = await api.preview(event.id, signal);
          if (!signal.aborted) setPreview(value);
        }, false),
      }} onResult={(match, board, action, result, reason) =>
        void run((api, signal) => api.result(event.id, match.id, board, action, result, reason, signal))} />}
  </section>;
}
