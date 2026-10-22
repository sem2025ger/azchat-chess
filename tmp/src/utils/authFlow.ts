// When Supabase's allowed redirect configuration falls back to its Site URL,
// an implicit recovery callback can arrive at / or /profile. Route it to the
// password screen BEFORE React and Supabase finish processing the URL fragment.
// Never log or store the access/refresh tokens from the callback URL.
export function recoveryCallbackDestination(href: string): string | null {
  const url = new URL(href);
  if (!['/', '/home', '/profile'].includes(url.pathname)) return null;
  const callback = new URLSearchParams(url.hash.replace(/^#/, ''));
  const validRecoveryShape = callback.get('type') === 'recovery'
    && callback.has('access_token') && callback.has('refresh_token');
  // Used/expired links returned by Supabase must show an error instead of the home page.
  const expiredLink = callback.get('error_code') === 'otp_expired'
    || url.searchParams.get('error_code') === 'otp_expired';
  if (!validRecoveryShape && !expiredLink) return null;
  return '/update-password' + url.search + url.hash;
}

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
  if (details.code === 'invalid_email') return 'auth.emailRequired';
  if (details.message === 'Failed to fetch' || error instanceof TypeError) return 'auth.networkError';
  return 'auth.recoveryError';
}

interface RecoveryEmailAuth {
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: unknown }>;
}

export async function requestRecoveryEmail(auth: RecoveryEmailAuth, email: string, origin: string, returnTo: string | null) {
  if (!validEmail(email)) throw Object.assign(new Error('Invalid email'), { code: 'invalid_email' });
  const { error } = await auth.resetPasswordForEmail(normalizedEmail(email), {
    redirectTo: authRedirect(origin, '/update-password', returnTo),
  });
  if (error && !accountNotFoundError(error)) throw error;
}

export function canUpdatePassword(verifiedRecoverySession: boolean, loading: boolean, search: string, hash: string): boolean {
  return verifiedRecoverySession && !loading
    && !hasAuthCallbackError(search, hash);
}

export function hasAuthCallbackError(search: string, hash: string): boolean {
  return [new URLSearchParams(search), new URLSearchParams(hash.replace(/^#/, ''))]
    .some(params => ['error', 'error_code', 'error_description'].some(key => params.has(key)));
}

// Supabase can respond with an account-related error for email links even when
// the UI must not disclose whether the account exists. Never echo the raw error.
export function accountNotFoundError(error: unknown): boolean {
  const details = error && typeof error === 'object'
    ? error as { code?: string }
    : {};
  return details.code === 'user_not_found' || details.code === 'otp_disabled'
    || details.code === 'user_already_exists';
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
