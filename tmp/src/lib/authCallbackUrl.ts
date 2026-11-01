// Keep email callbacks on the same ChessAZ environment as their auth session.
// Preserve each QA branch alias for sign-in and recovery; ephemeral deployment recovery uses the stable QA host.
const qaPreviewHost = /^chessaz-preview-workspace-(?:git-)?[a-z0-9]+-semov20207-3068s-projects\.vercel\.app$/;

export function authCallbackUrl(
  currentOrigin: string,
  path: '/profile' | '/update-password',
  returnToClub = false,
  returnToPlay = false,
): string {
  const current = new URL(currentOrigin);
  const isUniqueDeployment = /^chessaz-preview-workspace-(?!git-)[a-z0-9]{8,16}-semov20207-3068s-projects\.vercel\.app$/.test(current.hostname);
  // Ephemeral deployment hosts cannot be exhaustively allowlisted in Supabase Auth.
  // Stable branch aliases must retain their own origin, or magic links return to an
  // older build on the shared QA hostname and the authenticated session is lost.
  const useStableRecoveryHost = path === '/update-password' &&
    current.protocol === 'https:' && qaPreviewHost.test(current.hostname) && isUniqueDeployment;
  const origin = useStableRecoveryHost
    ? 'https://chessaz-preview-workspace.vercel.app'
    : current.origin;
  const callback = new URL(path, origin);
  if (returnToClub) callback.searchParams.set('returnTo', '/chat');
  else if (returnToPlay) callback.searchParams.set('returnTo', '/play');
  return callback.toString();
}

export function clubReturnTarget(value: string | null): '/chat' | null {
  return value === '/chat' ? '/chat' : null;
}

export function inviteReturnTarget(value: string | null): string | null {
  return value !== null && /^\/schach-treff\/einladung\/[0-9a-f]{32}$/.test(value) ? value : null;
}

export function inviteAuthCallbackUrl(origin: string, path: '/profile' | '/update-password', target: string): string {
  const callback = new URL(authCallbackUrl(origin, path));
  const safe = inviteReturnTarget(target);
  if (safe) callback.searchParams.set('returnTo', safe);
  return callback.toString();
}
