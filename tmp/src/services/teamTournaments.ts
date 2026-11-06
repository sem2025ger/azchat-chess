import { abortWithTimeout } from '../lib/abortWithTimeout.ts';

export type TournamentStatus = 'draft' | 'registration' | 'locked' | 'published' | 'finished';
export type TournamentRole = 'organizer' | 'arbiter' | 'captain';
export const boardResults = ['1-0', '0-1', '1/2-1/2', '+/-', '-/+', '-/-'] as const;
export type BoardResult = typeof boardResults[number];
export type BoardAction = 'record' | 'confirm' | 'correct';
export type TournamentAction = 'register' | 'lock' | 'publish' | 'finish';
export type TournamentRules = {
  board_count: number;
  home_white_board_one: boolean;
  win_points: number;
  draw_points: number;
  loss_points: number;
  forfeit_win_units: number;
  forfeit_loss_units: number;
};
export const tournamentDefaults: TournamentRules = {
  board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1, loss_points: 0,
  forfeit_win_units: 2, forfeit_loss_units: 0,
};
export type TournamentEntry = {
  id: string; name: string; status: TournamentStatus; current_round: number | null; captain_team_id?: string | null;
};
export type TournamentList = { can_create: boolean; tournaments: TournamentEntry[] };
export type TournamentBoard = {
  board_no: number; home_white: boolean; result: BoardResult | 'pending'; confirmed: boolean; revision: number;
};
export type Pairing<T> = { home_team_id: string; away_team_id: string; boards: T[] };
export type TournamentMatch = Pairing<TournamentBoard> & { id: string; round_no: number };
export type TournamentRound = { round_no: number; bye_team_id: string | null };
export type TournamentPreview = {
  ruleset_version: number;
  rounds: (TournamentRound & { matches: Pairing<Pick<TournamentBoard, 'board_no' | 'home_white'>>[] })[];
};
export type TournamentTeam = { id: string; name: string; seed: number };
type Threshold = { draw_points_needed: number | null; win_points_needed: number | null };
export type MatchScore = {
  match_id: string; home_board_points: number; away_board_points: number; remaining_boards: number;
  scenarios: { outcome: 'home_win' | 'away_win' | 'draw' | 'double_forfeit' | null; home: Threshold; away: Threshold };
};
export type Standing = {
  team_id: string; rank: number; played: number; match_points: number; board_points: number; berliner_wertung: number;
};
type ScoreTable = { standings: Standing[]; matches: MatchScore[] };
export type Tournament = {
  id: string; name: string; status: TournamentStatus; rules: TournamentRules & { version: number }; roles: TournamentRole[];
  teams: TournamentTeam[]; rounds: TournamentRound[]; matches: TournamentMatch[]; official: ScoreTable; provisional: ScoreTable;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function tournamentId(value: string) {
  if (!uuid.test(value)) throw new TournamentError('invalid_input');
  return value;
}
export function tournamentsEnabled(value: unknown) { return value === 'true'; }
export class TournamentError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export function createTournamentApi(base: string, token?: string, fetchImpl: typeof fetch = fetch) {
  let root: URL;
  try { root = new URL(base); } catch { throw new TournamentError('configuration'); }
  if (root.username || root.password || (root.protocol !== 'https:' &&
      !(root.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(root.hostname)))) {
    throw new TournamentError('configuration');
  }
  async function request<T>(path: string, signal: AbortSignal, { body, privateRead = false }: { body?: object; privateRead?: boolean } = {}) {
    if ((body || privateRead) && !token) throw new TournamentError('authentication_required');
    const timeout = abortWithTimeout(signal, 15000);
    try {
      const response = await fetchImpl(new URL('/api/team-tournaments' + path, root), {
        method: body ? 'POST' : 'GET', signal: timeout.signal, cache: 'no-store',
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new TournamentError(typeof data?.code === 'string' ? data.code : 'temporarily_unavailable');
      return data as T;
    } finally {
      timeout.cancel();
    }
  }
  const eventPath = (id: string) => '/' + tournamentId(id);
  return {
    list: (signal: AbortSignal) => request<TournamentList>('', signal),
    detail: (id: string, signal: AbortSignal) => request<Tournament>(eventPath(id), signal),
    workspace: (id: string, signal: AbortSignal) => request<Tournament>(eventPath(id) + '/workspace', signal, { privateRead: true }),
    create: (name: string, rules: TournamentRules, signal: AbortSignal) =>
      request<{ id: string }>('', signal, { body: { name, rules } }),
    team: (id: string, name: string, captainId: string | null, signal: AbortSignal) =>
      request(eventPath(id) + '/teams', signal, { body: { name, captain_id: captainId ? tournamentId(captainId) : null } }),
    arbiter: (id: string, actor: string, signal: AbortSignal) =>
      request(eventPath(id) + '/arbiters', signal, { body: { user_id: tournamentId(actor) } }),
    preview: (id: string, signal: AbortSignal) =>
      request<TournamentPreview>(eventPath(id) + '/preview', signal, { privateRead: true }),
    transition: (id: string, action: TournamentAction, signal: AbortSignal) =>
      request(eventPath(id) + '/' + action, signal, { body: {} }),
    result: (id: string, match: string, board: TournamentBoard, action: BoardAction, result: BoardResult, reason: string, signal: AbortSignal) => {
      if (!Number.isInteger(board.board_no) || board.board_no < 1 || board.board_no > 16) throw new TournamentError('invalid_input');
      return request(eventPath(id) + '/matches/' + tournamentId(match) + '/boards/' + board.board_no + '/' + action, signal,
        { body: { result, reason, revision: board.revision } });
    },
  };
}


export type MyTournamentBoard = {
  tournament_id: string;
  tournament_name: string;
  match_id: string;
  round_no: number;
  board_no: number;
  opponent: string;
  side: 'white' | 'black';
  result: BoardResult | 'pending';
  confirmed: boolean;
  status: 'pending' | 'reported' | 'confirmed' | 'disputed';
  opponent_report: BoardResult | null;
  opponent_kind: 'game' | 'forfeit' | null;
};
export type M3TeamEntry = { id: string; club_name: string; captain_id: string; submitted_at: string | null };
export type M3Lineup = { entry_id: string; board_no: number; player_id: string; consented_at: string | null };
export type M3Event = {
  id: string; name: string; status: TournamentStatus | 'cancelled';
  board_count: number;
  starts_at: string; registration_deadline: string; min_teams: number; max_teams: number;
  teams: { id: string; name: string }[]; remaining_spots: number;
  entries?: M3TeamEntry[]; roles?: { role: TournamentRole; team_id: string | null }[];
  lineups?: M3Lineup[]; profiles?: { id: string; username: string }[];
  matches?: { id: string; round_no: number; home_team_id: string; away_team_id: string }[];
  states?: { match_id: string; board_no: number; status: string }[];
  reports?: { match_id: string; board_no: number; side: 'white' | 'black'; result: BoardResult; kind: string }[];
};
export type M3EventInput = {
  name: string;
  start_time: string;
  registration_deadline: string;
  boards_per_team: number;
  min_teams: number;
  max_teams: number;
};
export function createTournamentM3Api(base: string, token: string, fetchImpl: typeof fetch = fetch) {
  if (!token) throw new TournamentError('authentication_required');
  let root: URL;
  try { root = new URL(base); } catch { throw new TournamentError('configuration'); }
  if (root.username || root.password || (root.protocol !== 'https:' &&
      !(root.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(root.hostname)))) {
    throw new TournamentError('configuration');
  }
  async function request<T>(path: string, signal: AbortSignal, body?: object) {
    const timeout = abortWithTimeout(signal, 15000);
    try {
      const response = await fetchImpl(new URL('/api/team-tournaments' + path, root), {
        method: body ? 'POST' : 'GET', signal: timeout.signal, cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result == null) {
        throw new TournamentError(typeof result?.code === 'string' ? result.code : 'temporarily_unavailable');
      }
      return result as T;
    } finally { timeout.cancel(); }
  }
  const at = (id: string) => '/' + tournamentId(id);
  const boardPath = (event: string, match: string, board: number) => {
    if (!Number.isInteger(board) || board < 1 || board > 16) throw new TournamentError('invalid_input');
    return at(event) + '/matches/' + tournamentId(match) + '/boards/' + board + '/m3';
  };
  return {
    myBoard: (signal: AbortSignal) => request<{ board: MyTournamentBoard | null }>('/my-board', signal),
    create: (input: M3EventInput, signal: AbortSignal) =>
      request<{ id: string; status: string }>('/self-service', signal, input),
    publicEvent: (event: string, signal: AbortSignal) =>
      request<M3Event>(at(event) + '/self-service/public', signal),
    event: (event: string, signal: AbortSignal) => request<M3Event>(at(event) + '/self-service', signal),
    userSearch: (term: string, signal: AbortSignal) => {
      if (!/^[A-Za-z0-9_-]{2,30}$/.test(term)) throw new TournamentError('invalid_input');
      return request<{ users: { id: string; username: string }[] }>('/user-search?q=' + encodeURIComponent(term), signal);
    },
    invite: (event: string, club_name: string, signal: AbortSignal) =>
      request<{ token: string; invite_id: string }>(at(event) + '/invites', signal, { club_name }),
    revoke: (event: string, invite: string, signal: AbortSignal) =>
      request(at(event) + '/invites/' + tournamentId(invite) + '/revoke', signal, {}),
    redeem: (event: string, tokenValue: string, signal: AbortSignal) =>
      request(at(event) + '/redeem', signal, { token: tokenValue }),
    lineup: (event: string, players: string[], signal: AbortSignal) =>
      request(at(event) + '/lineup', signal, { players: players.map(tournamentId) }),
    lineupAction: (event: string, action: 'previous' | 'consent' | 'submit' | 'withdraw', signal: AbortSignal) =>
      request(at(event) + '/lineup/' + action, signal, {}),
    report: (board: MyTournamentBoard, action: 'report' | 'confirm' | 'reject' | 'forfeit' | 'decide' | 'correct',
      result: BoardResult | null, reason: string | null, signal: AbortSignal) =>
      request(boardPath(board.tournament_id, board.match_id, board.board_no) + '/' + action, signal,
        { result, reason }),
    boardAction: (event: string, match: string, board: number,
      action: 'report' | 'confirm' | 'reject' | 'forfeit' | 'decide' | 'correct',
      result: BoardResult | null, reason: string | null, signal: AbortSignal) =>
      request(boardPath(event, match, board) + '/' + action, signal, { result, reason }),
  };
}

export type TournamentApi = ReturnType<typeof createTournamentApi>;
