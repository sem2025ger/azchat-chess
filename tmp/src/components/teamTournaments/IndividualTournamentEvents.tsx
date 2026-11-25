import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createIndividualEventsApi, type EventCommand, type EventDetail, type EventSummary,
  type Pair, type Result, type EventStatus } from '../../services/individualTournaments';
import { tournamentErrorMessage, type TournamentCopy } from './copy';
import { individualStandings } from './individualStandings';

export function individualEventError(error: unknown, tr: TournamentCopy) {
  const code = error instanceof Error ? error.message : 'temporarily_unavailable';
  if (code === 'registration_closed') return tr('individualClosed');
  if (code === 'event_full') return tr('individualFull');
  if (code === 'request_conflict') return tr('m3RequestConflict');
  if (code === 'invalid_time') return tr('individualInvalidStart');
  return tournamentErrorMessage(code, tr);
}

type ViewProps = { token?: string; format: Intl.DateTimeFormat; tr: TournamentCopy };

function statusLabel(status: EventStatus, startsAt: string, tr: TournamentCopy) {
  if (status === 'registration') return Date.parse(startsAt) > Date.now() ? tr('individualRegistration') : tr('individualClosed');
  return ({ playing: tr('individualPlaying'), finished: tr('finished'),
    cancelled: tr('individualCancelled'), pairing_blocked: tr('individualBlocked') })[status];
}

export function IndividualEventList({ token, format, tr, onEvents }: ViewProps & {
  onEvents?: (events: EventSummary[]) => void;
}) {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    const api = createIndividualEventsApi(token);
    const refresh = () => void api.list(controller.signal).then(items => {
      if (controller.signal.aborted) return;
      setEvents(items);
      onEvents?.(items);
      setFailure(null);
    }).catch(error => { if (!controller.signal.aborted) setFailure(error); });
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [token,onEvents]);

  return <section className="section-card individual-event-list">
    <h3>{tr('individualEvents')}</h3>
    {failure != null ? <p role="alert">{individualEventError(failure,tr)}</p> :
      !events ? <p role="status">{tr('loading')}</p> :
      !events.length ? <p>{tr('empty')}</p> :
      <ul className="individual-event-cards">
        {events.map(event => <li key={event.id}>
          <Link className="individual-event-card" to={'?individual=' + event.id}>
            <strong>{event.name}</strong>
            <span className="individual-event-status" data-status={event.status}>{statusLabel(event.status,event.starts_at,tr)}</span>
            <time dateTime={event.starts_at}>{format.format(new Date(event.starts_at))}</time>
            <span>{tr('individualMaxPlayers')}: {event.max_players}</span>
          </Link>
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
    let reading = false;
    function refresh() {
      if (action.current || reading) return;
      reading = true;
      const current = generation.current;
      void api.detail(id,controller.signal).then(value => {
        if (controller.signal.aborted || generation.current !== current) return;
        setEvent(value);
        setFailure(null);
      }).catch(error => {
        if (!controller.signal.aborted && generation.current === current) setFailure(error);
      }).finally(() => { reading = false; });
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
  const standings = event ? individualStandings(event.players,event.pairs) : [];

  return <section className="team-tournament-page individual-event-view">
    <Link className="individual-event-back" to="/spieltag">{tr('back')}</Link>
    {failure != null && <p role="alert">{individualEventError(failure,tr)}</p>}
    {!event && failure == null && <p role="status">{tr('loading')}</p>}
    {event && <>
      <header className="section-card individual-event-header">
        <span className="individual-event-status" data-status={event.status} role="status">{statusLabel(event.status,event.starts_at,tr)}</span>
        <h2>{event.name}</h2>
        <div className="individual-event-metrics">
          <div><span>{tr('m3Start')}</span><time dateTime={event.starts_at}>{format.format(new Date(event.starts_at))}</time></div>
          <div><span>{tr('individualParticipants')}</span><strong>{event.players.length}/{event.max_players}</strong></div>
          {event.round_no > 0 && <div><span>{tr('round')}</span><strong>{event.round_no}/{event.round_limit}</strong></div>}
        </div>
        {event.status === 'registration' && <progress aria-label={tr('individualParticipants')} value={event.players.length} max={event.max_players} />}
      </header>
      {(open || (event.organizer && event.status !== 'finished' && event.status !== 'cancelled')) &&
      <section className="section-card individual-event-controls" aria-label={tr('registration')}>
        {open && event.joined && <p role="status">{tr('individualJoined')}</p>}
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
      </section>}
      {event.status === 'pairing_blocked' && <p role="alert">{tr('individualBlocked')}</p>}
      {event.players.length > 0 && <section className="section-card individual-event-standings">
        {event.round_no > 0 ? <>
          <h3>{tr('individualStandings')}</h3>
          <p className="individual-event-note">{tr('individualPointsOnly')}</p>
          <div className="team-tournament-table"><table>
            <thead><tr><th scope="col">{tr('rank')}</th><th scope="col">{tr('individualNickname')}</th>
              <th scope="col">{tr('individualPoints')}</th><th scope="col">{tr('individualGames')}</th></tr></thead>
            <tbody>{standings.map(player => <tr key={player.no}>
              <td>{player.rank}</td><th scope="row">{player.name}</th>
              <td>{player.points.toLocaleString(format.resolvedOptions().locale)}</td><td>{player.played}</td>
            </tr>)}</tbody>
          </table></div>
        </> : <>
          <h3>{tr('individualParticipants')}</h3>
          <ul className="individual-event-roster">{event.players.map(player => <li key={player.no}>{player.name}</li>)}</ul>
        </>}
      </section>}
      {event.round_no > 0 && <section className="section-card individual-event-rounds">
      <h3>{tr('rounds')}</h3>
      {event.status === 'playing' && event.round_limit !== null && event.round_no < event.round_limit && <p>{tr('individualResultHint')}</p>}
      {Array.from({ length:event.round_no },(_,i) => event.round_no-i).map(round =>
        <details key={round} open={round === event.round_no}>
          <summary>{tr('round')} {round}/{event.round_limit}</summary>
          <ol className="team-tournament-list">
            {event.pairs.filter(pair => pair.round_no === round).map(pair => <li key={pair.board_no}>
              <div className="individual-pair">
                <span className="individual-pair-board">{tr('board')} {pair.board_no}</span>
                <div className="individual-pair-player"><span>{pair.black_no === null ? tr('individualBye') : tr('white')}</span><strong>{names.get(pair.white_no)}</strong></div>
                <strong className="individual-pair-score">{pair.result === 'bye' ? '+1' : pair.result ?? '—'}</strong>
                {pair.black_no !== null && <div className="individual-pair-player"><span>{tr('black')}</span><strong>{names.get(pair.black_no)}</strong></div>}
              </div>
              {event.organizer && event.status === 'playing' && round === event.round_no &&
                pair.black_no !== null && !pair.result &&
                <ResultForm pair={pair} tr={tr} busy={busy} submit={result => void send({
                  action:'result',input:{ round_no:round,board_no:pair.board_no,result },
                })} />}
            </li>)}
          </ol>
        </details>)}
      </section>}
    </>}
  </section>;
}

function ResultForm({ pair,tr,busy,submit }: {
  pair: Pair; tr: TournamentCopy; busy: boolean; submit: (result: Result) => void;
}) {
  const [result,setResult] = useState<Result | ''>('');
  return <form className="team-tournament-actions individual-result-form" onSubmit={e => { e.preventDefault(); if (result) submit(result); }}>
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
