// Email callbacks must return to the same ChessAZ environment and QA branch.
// The shared QA project domain points to main; never use it as a Preview fallback.
const ephemeralQaHost = /^chessaz-preview-workspace-(?!git-)[a-z0-9]{8,16}-semov20207-3068s-projects\.vercel\.app$/;
const stableQaBranchHost = /^chessaz-preview-workspace-git-(?!main-)[a-z0-9-]+-semov20207-3068s-projects\.vercel\.app$/;

function safeQaBranchOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('https://') ? value : `https://${value}`);
    return url.protocol === 'https:' &&
      stableQaBranchHost.test(url.hostname) &&
      url.pathname === '/' &&
      !url.search && !url.hash && !url.username && !url.password && !url.port
      ? url.origin : null;
  } catch {
    return null;
  }
}

export function authCallbackUrl(
  currentOrigin: string,
  path: '/profile' | '/update-password',
  returnToClub = false,
  returnToPlay = false,
  qaBranchUrl: string | undefined =
    import.meta.env.VITE_QA_AUTH_BRANCH_ORIGIN || import.meta.env.VITE_VERCEL_BRANCH_URL,
): string {
  const current = new URL(currentOrigin);
  let origin = current.origin;

  if (current.protocol === 'https:' && ephemeralQaHost.test(current.hostname)) {
    // Ephemeral deployment URLs are not necessarily on Supabase's redirect allowlist.
    // A fallback to the project's shared Site URL would show an outdated build.
    // Both magic-link sign-in and password recovery need the same branch alias.
    const stableOrigin = safeQaBranchOrigin(qaBranchUrl);
    if (!stableOrigin) {
      throw new Error('QA login not configured: stable branch Preview URL is required.');
    }
    origin = stableOrigin;
  }

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
