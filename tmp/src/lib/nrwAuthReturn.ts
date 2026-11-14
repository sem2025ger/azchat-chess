const tournamentReturnPath = /^\/spieltag\?tab=turniere(?:&tournament=[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?:&invite=[a-f0-9]{64})?)?$/;

export function isTournamentReturnPath(value: string): boolean {
  return tournamentReturnPath.test(value);
}

export function nrwAuthReturnTarget(
  value: string | null,
  { clubs, spieltag, preparation, tournaments }: { clubs: boolean; spieltag: boolean; preparation: boolean; tournaments?: boolean },
): string | null {
  if (!value || /[\r\n]/.test(value)) return null;
  if (tournaments && isTournamentReturnPath(value)) return value;
  if (spieltag && value === '/spieltag') return value;
  if (preparation && value === '/vorbereitung') return value;
  if (!clubs) return null;
  return /^\/region\/nrw(?:\/(?:turniere|ligen|vereine|news|live))?$/.test(value) ||
    /^\/clubs-nrw(?:\/[a-z0-9-]{3,64})?$/.test(value) ? value : null;
}
