import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createIndividualEventsApi, type EventCommand, type EventDetail, type EventSummary,
  type Pair, type Result } from '../../services/individualTournaments';
import { tournamentErrorMessage, type TournamentCopy } from './copy';

export function individualEventError(error: unknown, tr: TournamentCopy) {
  const code = error instanceof Error ? error.message : 'temporarily_unavailable';
  if (code === 'registration_closed') return tr('individualClosed');
  if (code === 'event_full') return tr('individualFull');
  if (code === 'request_conflict') return tr('m3RequestConflict');
  if (code === 'invalid_time') return tr('individualInvalidStart');
  return tournamentErrorMessage(code, tr);
}

type ViewProps = { token?: string; format: Intl.DateTimeFormat; tr: TournamentCopy };

export function IndividualEventList({ token, format, tr }: ViewProps) {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    const api = createIndividualEventsApi(token);
    const refresh = () => void api.list(controller.signal).then(items => {
      if (controller.signal.aborted) return;
      setEvents(items);
      setFailure(null);
    }).catch(error => { if (!controller.signal.aborted) setFailure(error); });
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [token]);

  return <section className="section-card">
    <h3>{tr('individualEvents')}</h3>
    {failure != null ? <p role="alert">{individualEventError(failure,tr)}</p> :
      !events ? <p role="status">{tr('loading')}</p> :
      !events.length ? <p>{tr('empty')}</p> :
      <ul className="team-tournament-list">
        {events.map(event => <li key={event.id}>
          <Link to={'?individual=' + event.id}>{event.name}</Link>
          <time dateTime={event.starts_at}>{format.format(new Date(event.starts_at))}</time>
        </li>)}
      </ul>}
  </section>;
}

export function IndividualEventView({ id, token, format, tr }: ViewProps & { id: string }) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const action = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const api = createIndividualEventsApi(token);
    function refresh() {
      if (action.current) return;
      const current = generation.current;
      void api.detail(id,controller.signal).then(value => {
        if (controller.signal.aborted || generation.current !== current) return;
        setEvent(value);
      }).catch(error => {
        if (!controller.signal.aborted && generation.current === current) setFailure(error);
      });
    }
    refresh();
    const timer = window.setInterval(refresh,8000);
    return () => { controller.abort(); action.current?.abort(); window.clearInterval(timer); };
  }, [id,token]);

  async function send(command: EventCommand) {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    generation.current++;
    setBusy(true);
    setFailure(null);
    try {
      const current = await createIndividualEventsApi(token).command(id,command,controller.signal);
      if (!controller.signal.aborted) setEvent(current);
    } catch (error) { if (!controller.signal.aborted) setFailure(error); }
    finally {
      if (action.current === controller) action.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function register(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    void send({ action:'join',input:{ name:nickname.trim() } });
  }

  const open = event?.status === 'registration' && Date.parse(event.starts_at) > Date.now();
  const names = new Map(event?.players.map(p => [p.no,p.name]));
  const status = {
    registration:open ? tr('individualRegistration') : tr('individualClosed'),
    playing:tr('individualPlaying'), finished:tr('finished'),
    cancelled:tr('individualCancelled'), pairing_blocked:tr('individualBlocked'),
  };

  return <section className="team-tournament-page section-card">
    <Link to="/spieltag">{tr('individualEvents')}</Link>
    {failure != null && <p role="alert">{individualEventError(failure,tr)}</p>}
    {!event && failure == null && <p role="status">{tr('loading')}</p>}
    {event && <>
      <h3>{event.name}</h3>
      <p><time dateTime={event.starts_at}>{format.format(new Date(event.starts_at))}</time>
        {' · '}{event.players.length}/{event.max_players}{' · '}{status[event.status]}</p>
      {open && (event.joined ?
        <button type="button" disabled={busy} onClick={() => void send({ action:'leave',input:{} })}>
          {tr('individualLeave')}
        </button> : event.players.length >= event.max_players ? <p>{tr('individualFull')}</p> :
        token ? <form className="team-create-manual-form" onSubmit={register}>
          <label>{tr('individualNickname')}
            <input value={nickname} required maxLength={40} onChange={e => setNickname(e.target.value)} />
          </label>
          <button disabled={busy || !nickname.trim()} type="submit">{tr('individualJoin')}</button>
        </form> : <Link to={'/profile?returnTo=' + encodeURIComponent('/spieltag?individual=' + id)}>
          {tr('individualJoin')}
        </Link>)}
      {event.organizer && event.status !== 'finished' && event.status !== 'cancelled' &&
        <button type="button" disabled={busy} onClick={() => {
          if (window.confirm(tr('individualCancelConfirm'))) void send({ action:'cancel',input:{} });
        }}>{tr('individualCancel')}</button>}
      {event.status === 'playing' && <p>{tr('individualResultHint')}</p>}
      {Array.from({ length:event.round_no },(_,i) => event.round_no-i).map(round =>
        <details key={round} open={round === event.round_no}>
          <summary>{tr('round')} {round}/{event.round_limit}</summary>
          <ol className="team-tournament-list">
            {event.pairs.filter(pair => pair.round_no === round).map(pair => <li key={pair.board_no}>
              <span>{names.get(pair.white_no)}{pair.black_no === null ?
                ' · ' + tr('individualBye') : ' – ' + names.get(pair.black_no)}</span>
              {pair.result && pair.result !== 'bye' && <span>{pair.result}</span>}
              {event.organizer && event.status === 'playing' && round === event.round_no &&
                pair.black_no !== null && !pair.result &&
                <ResultForm pair={pair} tr={tr} busy={busy} submit={result => void send({
                  action:'result',input:{ round_no:round,board_no:pair.board_no,result },
                })} />}
            </li>)}
          </ol>
        </details>)}
    </>}
  </section>;
}

function ResultForm({ pair,tr,busy,submit }: {
  pair: Pair; tr: TournamentCopy; busy: boolean; submit: (result: Result) => void;
}) {
  const [result,setResult] = useState<Result | ''>('');
  return <form className="team-tournament-actions" onSubmit={e => { e.preventDefault(); if (result) submit(result); }}>
    <select aria-label={tr('individualRecord') + ' ' + pair.board_no} value={result}
      disabled={busy} onChange={e => setResult(e.target.value as Result | '')}>
      <option value="">—</option>
      <option value="1-0">1-0</option>
      <option value="1/2-1/2">1/2-1/2</option>
      <option value="0-1">0-1</option>
    </select>
    <button type="submit" disabled={busy || !result}>{tr('individualRecord')}</button>
  </form>;
}
