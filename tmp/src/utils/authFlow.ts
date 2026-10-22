// Only known application destinations may survive authentication redirects.
export function safeAuthReturn(value: string | null): string | null {
  if (value === '/chat' || value === '/play') return value;
  if (!value || /[\\\r\n]/.test(value)) return null;
  if (value.startsWith('/play?room=') || value.startsWith('/play?invite=1&tc=')) {
    const parsed = new URL(value, 'https://chessaz.invalid');
    if (parsed.origin === 'https://chessaz.invalid' && parsed.pathname === '/play' && !parsed.hash) return value;
  }
  return null;
}

export function authRedirect(origin: string, path: '/profile' | '/update-password', returnTo: string | null): string {
  const url = new URL(path, origin);
  const destination = safeAuthReturn(returnTo);
  if (destination) url.searchParams.set('returnTo', destination);
  return url.toString();
}

export function normalizedEmail(value: string): string {
  return value.trim();
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail(value));
}

export function authErrorKey(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { code?: string; status?: number; message?: string } : {};
  if (details.status === 429 || details.code?.includes('rate_limit')) return 'auth.emailRateLimit';
  if (details.code === 'invalid_credentials') return 'auth.invalidCredentials';
  if (details.code === 'email_not_confirmed') return 'auth.confirmEmail';
  if (details.code === 'weak_password') return 'auth.weakPassword';
  if (details.message === 'Failed to fetch' || error instanceof TypeError) return 'auth.networkError';
  return 'auth.recoveryError';
}

export function canUpdatePassword(hasSession: boolean, loading: boolean, search: string, hash: string): boolean {
  return hasSession && !loading
    && !new URLSearchParams(search).has('error')
    && !new URLSearchParams(hash.replace(/^#/, '')).has('error');
}

// The public Auth settings endpoint contains provider flags, never OAuth secrets.
// Fail closed: a disabled/unreachable provider must not become a broken button.
export async function googleProviderEnabled(baseUrl: string, publishableKey: string, request: typeof fetch = fetch): Promise<boolean> {
  if (!baseUrl || !publishableKey) return false;
  try {
    const response = await request(new URL('/auth/v1/settings', baseUrl), {
      headers: { apikey: publishableKey }, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}
