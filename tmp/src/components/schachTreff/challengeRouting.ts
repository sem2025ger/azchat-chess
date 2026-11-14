// Pure routing helpers for chat challenges (kept apart from components for fast refresh).
type Row = { id: string; created_by: string; status: string; room_id: string | null };
export const ROOM_ID = /^[0-9a-f-]{36}$/i;
/** A finished challenge game stays reachable for its two players from the card (the server re-authorises on reconnect). */
export const gamePath = (roomId: string) => `/play?roomId=${roomId}`;
/**
 * The server sends match_found to only one socket of the challenge creator (its first connection). With the chat open
 * in more than one tab that can be another tab, and this one would stay on "game started". So the tab that created
 * the offer opens the started game itself; the game page takes the colour from the server on reconnect.
 */
export function ownStartedGame(rows: readonly Row[], me: string, createdHere: ReadonlySet<string>, opened: ReadonlySet<string>): string | null {
  const row = rows.find(item => item.created_by===me && item.status==='accepted' && item.room_id && ROOM_ID.test(item.room_id) && createdHere.has(item.id) && !opened.has(item.room_id));
  return row?.room_id ?? null;
}
