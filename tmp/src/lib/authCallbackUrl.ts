// Keep email callbacks on the same ChessAZ environment as their auth session.
// Unique QA preview URLs are not stable callback destinations; prefer the QA alias.
const qaPreviewHost = /^chessaz-preview-workspace-(?:git-)?[a-z0-9]+-semov20207-3068s-projects\.vercel\.app$/;

export function authCallbackUrl(
  currentOrigin: string,
  path: '/profile' | '/update-password',
  returnToClub = false,
): string {
  const current = new URL(currentOrigin);
  const origin = current.protocol === 'https:' && qaPreviewHost.test(current.hostname)
    ? 'https://chessaz-preview-workspace.vercel.app'
    : current.origin;
  const callback = new URL(path, origin);
  if (returnToClub) callback.searchParams.set('returnTo', '/chat');
  return callback.toString();
}

export function clubReturnTarget(value: string | null): '/chat' | null {
  return value === '/chat' ? '/chat' : null;
}
