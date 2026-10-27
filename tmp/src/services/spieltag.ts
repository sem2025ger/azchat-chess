export type SpieltagTeam = { id: string; club_id: string; name: string; role: 'captain' | 'member' };
export type SpieltagClub = { id: string; name: string; slug: string };
export type SpieltagSchedule = { round_label: string; opponent_name: string; opponent_club_id: string | null; starts_at: string; venue: string; notes: string };
export type SpieltagMatch = SpieltagSchedule & { id: string; team_id: string };
export type SpieltagBoardInput = { home_name: string; home_fide_id: string | number | null; opponent_name: string; opponent_fide_id: string | number | null; result: string | null };
export type SpieltagBoard = SpieltagBoardInput & { match_id: string; board_number: number; opponent_lichess_username?:string|null };
export function spieltagEnabled(value: unknown) { return value === 'true'; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class SpieltagError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export function createSpieltagApi(base: string, token: string, fetchImpl: typeof fetch = fetch) {
  const root = new URL(base);
  if (root.protocol !== 'https:' && !(root.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(root.hostname))) throw new SpieltagError('configuration');
  const id = (value: string) => { if (!uuid.test(value)) throw new SpieltagError('invalid_input'); return value; };
  const number = (value: number) => { if (!Number.isInteger(value) || value<1 || value>32) throw new SpieltagError('invalid_input'); return value; };
  async function request(path: string, signal: AbortSignal, method = 'GET', body?: object) {
    if (!token) throw new SpieltagError('authentication_required');
    const response = await fetchImpl(new URL('/api/spieltag/' + path,root), { signal,method,cache:'no-store',
      headers: { Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}) },body:body?JSON.stringify(body):undefined });
    const data = await response.json();
    if (!response.ok) throw new SpieltagError(typeof data.code==='string'?data.code:'temporarily_unavailable');
    return data;
  }
  return {
    teams: async (s: AbortSignal): Promise<SpieltagTeam[]> => (await request('teams',s)).teams,
    clubs: async (s: AbortSignal): Promise<SpieltagClub[]> => (await request('clubs',s)).clubs,
    matches: async (team: string,s: AbortSignal): Promise<SpieltagMatch[]> => (await request('teams/'+id(team)+'/matches',s)).matches,
    boards: async (match: string,s: AbortSignal): Promise<SpieltagBoard[]> => (await request('matches/'+id(match)+'/boards',s)).boards,
    saveMatch: async (team: string,match: string | null,data: SpieltagSchedule,s: AbortSignal): Promise<SpieltagMatch[]> =>
      (await request(match?'matches/'+id(match):'teams/'+id(team)+'/matches',s,match?'PATCH':'POST',data)).matches,
    saveBoard: async (match: string,board: number,exists: boolean,data: SpieltagBoardInput,s: AbortSignal): Promise<SpieltagBoard[]> =>
      (await request('matches/'+id(match)+'/boards/'+number(board),s,exists?'PATCH':'POST',data)).boards,
    deleteBoard: (match: string,board: number,s: AbortSignal) => request('matches/'+id(match)+'/boards/'+number(board),s,'DELETE'),
    saveLichess: async(match:string,board:number,username:string|null,s:AbortSignal):Promise<SpieltagBoard[]>=>
      (await request('matches/'+id(match)+'/boards/'+number(board)+'/lichess',s,'PATCH',{username})).boards,
  };
}
export function scheduleFromMatch(match: SpieltagMatch): SpieltagSchedule {
  return {round_label:match.round_label,opponent_name:match.opponent_name,opponent_club_id:match.opponent_club_id,
    starts_at:match.starts_at,venue:match.venue,notes:match.notes};
}
export function boardInput(board: SpieltagBoard): SpieltagBoardInput {
  return {home_name:board.home_name,home_fide_id:board.home_fide_id,opponent_name:board.opponent_name,opponent_fide_id:board.opponent_fide_id,result:board.result};
}
export function berlinDateTime(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const get=(type: Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function berlinDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) throw new SpieltagError('invalid_time');
  const guess=Date.parse(value+':00Z');
  // Germany uses UTC+1/+2. Match the actual zone rules to reject nonexistent or
  // ambiguous clock-change times rather than silently moving the appointment.
  const candidates=[1,2].map(hours=>new Date(guess-hours*3600000).toISOString()).filter(iso=>berlinDateTime(iso)===value);
  if (candidates.length!==1) throw new SpieltagError('invalid_time');
  return candidates[0];
}
