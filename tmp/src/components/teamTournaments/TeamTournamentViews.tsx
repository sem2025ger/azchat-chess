import { useId, useState, type FormEvent } from 'react';
import {
  boardResults, tournamentDefaults, type BoardAction, type BoardResult, type MatchScore, type Standing,
  type Tournament, type TournamentAction, type TournamentBoard, type TournamentMatch, type TournamentPreview,
  type TournamentRules, type TournamentTeam,
} from '../../services/teamTournaments';
import type { TournamentCopy } from './copy';

const resultLabel = {
  '1-0': 'whiteWins', '0-1': 'blackWins', '1/2-1/2': 'draw',
  '+/-': 'whiteForfeit', '-/+': 'blackForfeit', '-/-': 'doubleForfeit', pending: 'pending',
} as const;

function points(value: number) {
  return value % 1 === 0 ? String(value) : (value >= 1 ? String(Math.floor(value)) : '') + '½';
}

type Display = { tr: TournamentCopy; names: Record<string, string> };
type BoardColors = { board_no: number; home_white: boolean };
function Colors({ board, home, away, tr }: { board: BoardColors; home: string; away: string; tr: TournamentCopy }) {
  return <p className="team-tournament-colors">
    <span>{tr('white')} · {board.home_white ? home : away}</span>
    <span>{tr('black')} · {board.home_white ? away : home}</span>
  </p>;
}

function Standings({ rows, title, tr, names }: Display & { rows: Standing[]; title: string }) {
  return <div className="team-tournament-table" tabIndex={0} aria-label={title} role="region">
    <table>
      <caption>{title}</caption>
      <thead><tr>{(['rank', 'team', 'mp', 'bp', 'berlin'] as const).map(key => <th key={key} scope="col">{tr(key)}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.team_id}>
        <td>{row.rank}</td><th scope="row">{names[row.team_id]}</th><td>{row.match_points}</td>
        <td>{points(row.board_points)}</td><td>{points(row.berliner_wertung)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function Scenario({ score, home, away, tr }: { score: MatchScore; home: string; away: string; tr: TournamentCopy }) {
  if (!score.remaining_boards) return null;
  const sides = [[home, score.scenarios.home], [away, score.scenarios.away]] as const;
  return <div className="team-tournament-scenario">
    <p>{tr('remaining')}: {score.remaining_boards}</p>
    {sides.map(([name, threshold], i) => {
      const draw = threshold.draw_points_needed;
      const win = threshold.win_points_needed;
      if (draw === null && win === null) return null;
      const labels = win === 0 ? [tr('winner')] : [
        draw === null ? '' : draw === 0 ? tr('secured') : tr('drawNeed').replace('{n}', points(draw)),
        win === null ? '' : tr('winNeed').replace('{n}', points(win)),
      ].filter(Boolean);
      return <p key={i}><strong>{name}</strong> · {labels.join(', ')}</p>;
    })}
  </div>;
}

type ResultHandler = (match: TournamentMatch, board: TournamentBoard, action: BoardAction, result: BoardResult, reason: string) => void;
function BoardEditor({ match, board, tr, busy, onResult }: {
  match: TournamentMatch; board: TournamentBoard; tr: TournamentCopy; busy: boolean; onResult: ResultHandler;
}) {
  const id = useId();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const result = form.get('result') as BoardResult;
    const reason = String(form.get('reason') ?? '').trim();
    if (!boardResults.includes(result) || !reason) return;
    if (action === 'record' || action === 'confirm' || action === 'correct') onResult(match, board, action, result, reason);
  }
  return <form className="team-tournament-form" onSubmit={save} aria-label={tr('board') + ' ' + board.board_no + ' · ' + tr('result')}>
    <fieldset disabled={busy}>
      <label htmlFor={id + '-result'}>{tr('result')}</label>
      <select id={id + '-result'} name="result" defaultValue={board.result === 'pending' ? '' : board.result} required>
        <option value="" disabled>{tr('pending')}</option>
        {boardResults.map(result => <option key={result} value={result}>{result} · {tr(resultLabel[result])}</option>)}
      </select>
      <label htmlFor={id + '-reason'}>{tr('reason')}</label>
      <input id={id + '-reason'} name="reason" maxLength={500} required />
      <div className="team-tournament-actions">
        {board.confirmed ? <button value="correct">{tr('correct')}</button> : <>
          <button value="record">{tr('record')}</button><button value="confirm">{tr('confirm')}</button>
        </>}
      </div>
    </fieldset>
  </form>;
}

export function TournamentRounds({ event, tr, names, captainId, activeRound, busy, onResult }: Display & {
  event: Tournament; captainId?: string | null; activeRound?: number | null; busy: boolean; onResult?: ResultHandler;
}) {
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const round = event.rounds.find(r => r.round_no === (selected ?? activeRound)) ?? event.rounds[0];
  const matches = event.matches.filter(m => m.round_no === round?.round_no &&
    (captainId == null || [m.home_team_id, m.away_team_id].includes(captainId)));
  const hasProvisional = event.matches.some(m => m.boards.some(b => b.result !== 'pending' && !b.confirmed));
  return <>
    <section className="section-card" aria-label={tr('official')}>
      <Standings rows={event.official.standings} title={tr('official')} tr={tr} names={names} />
      {hasProvisional && <Standings rows={event.provisional.standings} title={tr('provisional')} tr={tr} names={names} />}
    </section>
    {round && <section className="section-card">
      <h2>{captainId ? tr('workspace') + ' · ' + names[captainId] : tr('rounds')}</h2>
      <label className="team-tournament-select">{tr('round')}
        <select value={round.round_no} onChange={e => setSelected(Number(e.target.value))}>
          {event.rounds.map(r => <option value={r.round_no} key={r.round_no}>{tr('round')} {r.round_no}</option>)}
        </select>
      </label>
      {round.bye_team_id && (captainId == null || captainId === round.bye_team_id) &&
        <p>{names[round.bye_team_id]} · {tr('bye')}</p>}
      {matches.map(match => {
        const home = names[match.home_team_id], away = names[match.away_team_id];
        const score = event.official.matches.find(m => m.match_id === match.id);
        return <article className="team-tournament-match" key={match.id}>
          <h3>
            {home}
            {score && <>{' — '}<span className="whitespace-nowrap">{points(score.home_board_points)} : {points(score.away_board_points)}</span></>}
            {' — '}{away}
          </h3>
          {score && <Scenario score={score} home={home} away={away} tr={tr} />}
          <ol className="team-tournament-boards">{match.boards.map(board => <li key={board.board_no}>
            <strong>{tr('board')} {board.board_no}</strong>
            <Colors board={board} home={home} away={away} tr={tr} />
            <p>{board.result === 'pending' ? tr('pending') : board.result + ' · ' + tr(resultLabel[board.result])}
              {board.result !== 'pending' && !board.confirmed && <span className="team-tournament-badge">{tr('provisional')}</span>}
            </p>
            {onResult && <BoardEditor key={board.revision} match={match} board={board} tr={tr} busy={busy} onResult={onResult} />}
          </li>)}</ol>
        </article>;
      })}
    </section>}
  </>;
}

type OrganizerHandlers = {
  team: (name: string, captain: string | null) => void;
  arbiter: (actor: string) => void;
  transition: (action: TournamentAction) => void;
  requestPreview: () => void;
};
export function Organizer({ event, preview, tr, names, busy, actions }: Display & {
  event: Tournament; preview: TournamentPreview | null; busy: boolean; actions: OrganizerHandlers;
}) {
  function form(event: FormEvent<HTMLFormElement>, action: (data: FormData) => void) {
    event.preventDefault();
    action(new FormData(event.currentTarget));
  }
  const allConfirmed = event.matches.length > 0 && event.matches.every(m => m.boards.every(b => b.confirmed));
  return <section className="section-card">
    <h2>{tr('organizer')}</h2>
    <h3>{tr('teams')}</h3>
    <ol>{event.teams.map(team => <li key={team.id}>{team.name}</li>)}</ol>
    {event.status !== 'finished' && <form className="team-tournament-form" onSubmit={e => form(e, d => actions.arbiter(String(d.get('actor')).trim()))}>
      <fieldset disabled={busy}>
        <label>{tr('arbiterId')}<input name="actor" required maxLength={36} /></label>
        <button>{tr('assign')}</button>
      </fieldset>
    </form>}
    {event.status === 'registration' && <form className="team-tournament-form" onSubmit={e => form(e, d => actions.team(String(d.get('name')).trim(), String(d.get('captain')).trim() || null))}>
      <fieldset disabled={busy}>
        <label>{tr('team')}<input name="name" required maxLength={120} /></label>
        <label>{tr('captainId')}<input name="captain" maxLength={36} /></label>
        <button>{tr('approve')}</button>
      </fieldset>
    </form>}
    <div className="team-tournament-actions">
      {event.status === 'draft' && <button disabled={busy} onClick={() => actions.transition('register')}>{tr('register')}</button>}
      {event.status === 'registration' && <button disabled={busy || event.teams.length < 2} onClick={() => actions.transition('lock')}>{tr('lock')}</button>}
      {event.status === 'locked' && <button disabled={busy} onClick={actions.requestPreview}>{tr('preview')}</button>}
      {event.status === 'published' && <button disabled={busy || !allConfirmed} onClick={() => actions.transition('finish')}>{tr('finish')}</button>}
    </div>
    {event.status === 'locked' && preview && <>
      <h3>{tr('schedule')}</h3>
      {preview.rounds.map(round => <details key={round.round_no}>
        <summary>{tr('round')} {round.round_no}</summary>
        {round.bye_team_id && <p>{names[round.bye_team_id]} · {tr('bye')}</p>}
        {round.matches.map(match => {
          const home = names[match.home_team_id], away = names[match.away_team_id];
          return <div className="team-tournament-match" key={match.home_team_id}>
            <h4>{home} – {away}</h4>
            <ol className="team-tournament-boards">{match.boards.map(board => <li key={board.board_no}>
              <strong>{tr('board')} {board.board_no}</strong><Colors board={board} home={home} away={away} tr={tr} />
            </li>)}</ol>
          </div>;
        })}
      </details>)}
      <button disabled={busy} onClick={() => actions.transition('publish')}>{tr('publish')}</button>
    </>}
  </section>;
}

const pointFields = [
  ['board_count', 'boards', 1, 16], ['win_points', 'winPoints', 0, 10],
  ['draw_points', 'drawPoints', 0, 10], ['loss_points', 'lossPoints', 0, 10],
] as const;

export function CreateTournament({ tr, busy, onCreate }: {
  tr: TournamentCopy; busy: boolean; onCreate: (name: string, rules: TournamentRules) => void;
}) {
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rules = { ...tournamentDefaults, home_white_board_one: data.has('white') };
    for (const [name] of pointFields) rules[name] = Number(data.get(name));
    rules.forfeit_win_units = Number(data.get('forfeit_win_units'));
    rules.forfeit_loss_units = Number(data.get('forfeit_loss_units'));
    onCreate(String(data.get('name')).trim(), rules);
  }
  return <section className="section-card">
    <h2>{tr('create')}</h2>
    <form className="team-tournament-form" onSubmit={save}>
      <fieldset disabled={busy}>
        <label>{tr('name')}<input name="name" maxLength={120} required /></label>
        <div className="team-tournament-rules">
          {pointFields.map(([name, key, min, max]) => <label key={name}>{tr(key)}
            <input name={name} type="number" min={min} max={max} defaultValue={tournamentDefaults[name]} required />
          </label>)}
          {([['forfeit_win_units','forfeitWin'], ['forfeit_loss_units','forfeitLoss']] as const).map(([name, key]) =>
            <label key={name}>{tr(key)}<select name={name} defaultValue={tournamentDefaults[name]}>
              {[0, 1, 2].map(units => <option value={units} key={units}>{points(units / 2)}</option>)}
            </select></label>)}
        </div>
        <label className="team-tournament-checkbox"><input type="checkbox" name="white" defaultChecked />{tr('firstWhite')}</label>
        <button>{tr('create')}</button>
      </fieldset>
    </form>
  </section>;
}

export function TournamentDetail({ event, preview, tr, activeRound, captainId, busy, actions, onResult }: {
  event: Tournament; preview: TournamentPreview | null; tr: TournamentCopy; activeRound?: number | null;
  captainId?: string | null; busy: boolean; actions: OrganizerHandlers; onResult: ResultHandler;
}) {
  const names = teamNames(event.teams);
  const organizer = event.roles.includes('organizer');
  const arbiter = event.roles.includes('arbiter');
  const captainOnly = event.roles.includes('captain') && !organizer && !arbiter;
  return <>
    {organizer && <Organizer event={event} preview={preview} tr={tr} names={names} busy={busy} actions={actions} />}
    {arbiter && <p>{tr('arbiter')}</p>}
    {captainOnly && !event.rounds.length && <section className="section-card">
      <h2>{tr('workspace')}</h2>{event.teams.map(team => <p key={team.id}>{team.name}</p>)}
    </section>}
    {(event.status === 'published' || event.status === 'finished') && <TournamentRounds event={event} tr={tr} names={names}
      captainId={captainOnly ? (captainId ?? '') : null} activeRound={activeRound} busy={busy}
      onResult={arbiter && event.status === 'published' ? onResult : undefined} />}
  </>;
}

function teamNames(teams: TournamentTeam[]) {
  return Object.fromEntries(teams.map(t => [t.id, t.name]));
}
