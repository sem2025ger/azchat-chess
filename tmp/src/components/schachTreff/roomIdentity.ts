/** Display a stable public room marker only when multiple rooms share a name.
 * The underlying room ID, its permissions and invitation URL are unchanged. */
export type RoomIdentity = { id: string; name: string };

export function roomDisplayLabel(room: RoomIdentity, rooms: readonly RoomIdentity[]): string {
  const sameName = rooms.filter(item => item.name.trim().toLocaleLowerCase() === room.name.trim().toLocaleLowerCase());
  if (sameName.length < 2) return room.name;
  const compact = room.id.replace(/-/g, '').toUpperCase();
  const others = sameName.filter(item => item.id !== room.id).map(item => item.id.replace(/-/g, '').toUpperCase());
  let length = 6;
  while (length < compact.length && others.some(id => id.slice(0, length) === compact.slice(0, length))) length += 2;
  return `${room.name} · #${compact.slice(0, length)}`;
}
