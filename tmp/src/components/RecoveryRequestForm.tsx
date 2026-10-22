import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabase';
import { authErrorKey, requestRecoveryEmail } from '../utils/authFlow';

export default function RecoveryRequestForm({ initialEmail = '', returnTo }: { initialEmail?: string; returnTo: string | null }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || cooldown) return;
    inFlight.current = true;
    setPending(true); setSent(false); setError('');
    try {
      await requestRecoveryEmail(supabase.auth, email, window.location.origin, returnTo);
      setSent(true); setCooldown(60);
    } catch (failure) {
      const key = authErrorKey(failure);
      setError(t(key));
      if (key === 'auth.emailRateLimit') setCooldown(60);
    } finally {
      inFlight.current = false; setPending(false);
    }
  }

  return <form onSubmit={submit} className="space-y-4" aria-label={t('auth.requestNewRecovery')}>
    <label htmlFor="recovery-email" className="block text-sm font-semibold text-neutral-200">{t('auth.emailLabel')}</label>
    <input id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
      required disabled={pending} value={email} onChange={event => setEmail(event.target.value)}
      className="w-full rounded-xl border border-white/15 bg-neutral-950/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-chess-gold/60" />
    {sent && <p role="status" className="text-sm text-emerald-200">{t('auth.resetEmailSent')}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {cooldown > 0 && <p role="status" className="text-sm text-neutral-300">{t('auth.emailCooldown')} {cooldown} s</p>}
    <button type="submit" disabled={pending || cooldown > 0}
      className="min-h-11 w-full rounded-xl bg-chess-gold px-4 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? t('auth.requestingRecovery') : t('auth.requestNewRecovery')}
    </button>
  </form>;
}
