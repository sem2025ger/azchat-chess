// Keep email callbacks on the same ChessAZ environment as their auth session.
// Preserve unique deployment URLs for feature QA; keep shared Git aliases on the stable QA host.
const qaPreviewHost = /^chessaz-preview-workspace-(?:git-)?[a-z0-9]+-semov20207-3068s-projects\.vercel\.app$/;

export function authCallbackUrl(
  currentOrigin: string,
  path: '/profile' | '/update-password',
  returnToClub = false,
  returnToPlay = false,
): string {
  const current = new URL(currentOrigin);
  const isUniqueDeployment = /^chessaz-preview-workspace-(?!git-)[a-z0-9]{8,16}-semov20207-3068s-projects\.vercel\.app$/.test(current.hostname);
  const origin = current.protocol === 'https:' && qaPreviewHost.test(current.hostname) && !isUniqueDeployment
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
