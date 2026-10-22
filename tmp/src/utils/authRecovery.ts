import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

interface AuthEvents {
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
}

// Install immediately after createClient, before React/lazy monitoring loads.
// Only an SDK-verified recovery event unlocks the form. URL flags and an existing
// ordinary login are not proof. Keep no tokens or recovery flags in storage.
export function observePasswordRecovery(auth: AuthEvents) {
  let verifiedUserId: string | null = null;
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') verifiedUserId = session?.user?.id ?? null;
    else if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED'
      || (verifiedUserId && session?.user?.id !== verifiedUserId)) verifiedUserId = null;
  });
  return {
    isVerified: (session: Session | null) => Boolean(verifiedUserId && session?.user?.id === verifiedUserId),
    dispose: () => { verifiedUserId = null; subscription.unsubscribe(); },
  };
}
