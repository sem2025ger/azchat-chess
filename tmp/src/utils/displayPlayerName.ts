// Bootstrap profiles append the auth UUID for uniqueness. Keep that stored value
// intact and remove only the generated suffix at presentation boundaries.
export function displayPlayerName(value: unknown, fallback = 'Player'): string {
  if (typeof value !== 'string') return fallback;
  const name = value.trim();
  if (!name || /^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(name)) return fallback;
  return name.replace(/_(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i, '') || fallback;
}
