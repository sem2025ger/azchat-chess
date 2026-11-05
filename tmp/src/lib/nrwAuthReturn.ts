export function nrwAuthReturnTarget(
  value: string | null,
  { clubs, spieltag, preparation }: { clubs: boolean; spieltag: boolean; preparation: boolean },
): string | null {
  if (!value || /[\r\n]/.test(value)) return null;
  if (spieltag && value === '/spieltag') return value;
  if (preparation && value === '/vorbereitung') return value;
  if (!clubs) return null;
  return /^\/region\/nrw(?:\/(?:turniere|ligen|vereine|news|live))?$/.test(value) ||
    /^\/clubs-nrw(?:\/[a-z0-9-]{3,64})?$/.test(value) ? value : null;
}
