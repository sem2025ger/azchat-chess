// Schach-Treff v2 (stage 1) pure helpers. Behind VITE_SCHACH_TREFF_V2, default off.
export const v2Enabled = import.meta.env.VITE_SCHACH_TREFF_V2 === 'true';

export const REACTIONS = ['!!', '!', '!?'] as const;
export type Reaction = typeof REACTIONS[number];
export type ReactionRow = { message_id: string; user_id: string; reaction: string };
export type ReactionSummary = { reaction: Reaction; count: number; mine: boolean };

/** Calm palette that reads on the graphite chat surface (contrast ≥ 4.5:1 on #161719). */
export const NAME_COLORS = ['#5EC4B6', '#E0A458', '#A99BE6', '#7FD49A', '#E88C7A', '#6FB3E8', '#D98BB8', '#CDBE8C'] as const;

/** Stable per-player colour: the same player has the same colour in every room. */
export function nameColor(userId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return NAME_COLORS[hash % NAME_COLORS.length];
}

export function summarizeReactions(rows: readonly ReactionRow[], me: string | undefined): Map<string, ReactionSummary[]> {
  const counts = new Map<string, Map<Reaction, ReactionSummary>>();
  for (const row of rows) {
    if (!(REACTIONS as readonly string[]).includes(row.reaction)) continue;
    const reaction = row.reaction as Reaction;
    const perMessage = counts.get(row.message_id) ?? new Map<Reaction, ReactionSummary>();
    const entry = perMessage.get(reaction) ?? { reaction, count: 0, mine: false };
    entry.count += 1;
    if (me && row.user_id === me) entry.mine = true;
    perMessage.set(reaction, entry);
    counts.set(row.message_id, perMessage);
  }
  const result = new Map<string, ReactionSummary[]>();
  for (const [id, perMessage] of counts) {
    result.set(id, REACTIONS.flatMap(reaction => perMessage.get(reaction) ?? []));
  }
  return result;
}

export function countReplies(rows: readonly { parent_id: string | null }[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) if (row.parent_id) result.set(row.parent_id, (result.get(row.parent_id) ?? 0) + 1);
  return result;
}

/** PostgREST / PostgreSQL codes for "this migration is not applied yet". */
export function isMissingSchema(code: string | undefined): boolean {
  return Boolean(code && ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code));
}

/** Time controls accepted by club_challenge_action (migration 20261112070000) and the game server. */
export const SEEK_CONTROLS = [
  { value: '1+0', kind: 'bullet' },
  { value: '3+0', kind: 'blitz' },
  { value: '3+2', kind: 'blitz' },
  { value: '5+0', kind: 'blitz' },
  { value: '10+0', kind: 'rapid' },
  { value: '15+10', kind: 'rapid' },
] as const;
export type SeekControl = typeof SEEK_CONTROLS[number]['value'];
const SEEK_KEY = 'chessaz.schachTreff.lastSeek';

export function readLastSeek(storage: Pick<Storage, 'getItem'> | null | undefined): SeekControl {
  try {
    const value = storage?.getItem(SEEK_KEY);
    const found = SEEK_CONTROLS.find(control => control.value === value);
    if (found) return found.value;
  } catch { /* Storage can be blocked; fall back to the default. */ }
  return '3+2';
}

export function writeLastSeek(storage: Pick<Storage, 'setItem'> | null | undefined, value: SeekControl): void {
  try { storage?.setItem(SEEK_KEY, value); } catch { /* Remembering is a convenience only. */ }
}

/** Members who wrote in the last 15 minutes are shown as "active now" (no separate presence system yet). */
export function recentlyActive(messages: readonly { author_id: string; created_at: string }[], now: number, windowMs = 15 * 60 * 1000): Set<string> {
  const active = new Set<string>();
  for (const message of messages) {
    const at = Date.parse(message.created_at);
    if (Number.isFinite(at) && now - at <= windowMs && at <= now + 60_000) active.add(message.author_id);
  }
  return active;
}

const FEN_SHAPE = /^[1-8pnbrqkPNBRQK]{1,8}(\/[1-8pnbrqkPNBRQK]{1,8}){7} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) \d{1,4} \d{1,4}$/;
/** Same shape as the database CHECK on chess_club_messages.fen; full legality is checked with chess.js. */
export function fenShapeOk(fen: string): boolean { return fen.length <= 100 && FEN_SHAPE.test(fen); }

export type ChatGameResult = {
  challenge_id: string; message_id: string; match_id: string; white_id: string | null; black_id: string | null;
  white_name: string | null; black_name: string | null; result: '1-0' | '0-1' | '1/2-1/2' | string;
  termination_reason: string | null; time_control: string; completed_at: string; pgn: string | null; initial_fen: string | null;
};

/** Number of full moves in a PGN move list (ignores headers, comments and results). */
export function countFullMoves(pgn: string | null | undefined): number {
  if (!pgn) return 0;
  const body = pgn.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ');
  const numbers = body.match(/(^|\s)(\d+)\.(?!\.)/g) ?? [];
  return numbers.length;
}

/** Pseudo-message id for a finished game shown in the feed timeline. */
export const resultMessageId = (result: Pick<ChatGameResult, 'challenge_id'>) => 'result:' + result.challenge_id;

/** Inserts finished chat games into the feed by completion time (they are not stored as messages). */
export function mergeTimeline<T extends { id: string; created_at: string }>(messages: readonly T[], results: readonly ChatGameResult[], make: (result: ChatGameResult) => T): T[] {
  if (!results.length) return [...messages];
  const oldest = messages.length ? Date.parse(messages[0].created_at) : -Infinity;
  const items = [...messages, ...results.filter(result => Date.parse(result.completed_at) >= oldest).map(make)];
  return items.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
