import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clubReturnTarget } from '../lib/authCallbackUrl';
import { supabase, hasPasswordRecoveryIntent, clearPasswordRecoveryIntent } from '../services/supabase';
import { useLanguage } from '../context/LanguageContext';
import { Loader2 } from 'lucide-react';

export default function UpdatePasswordScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturn = searchParams.get('returnTo');
  const backTo = requestedReturn === '/play' ? '/play' : (clubReturnTarget(requestedReturn) ?? '/profile');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        void supabase.auth.getUser().then(({ data, error }) => {
          if (active) setRecoveryStatus(!error && data.user && hasPasswordRecoveryIntent() ? 'ready' : 'invalid');
        }).catch(() => {
          if (active) setRecoveryStatus('invalid');
        });
      }
      if (event === 'SIGNED_OUT') setRecoveryStatus('invalid');
    });

    // Supabase may have consumed the recovery fragment before this lazy route loads.
    // Require both recent recovery intent and an authenticated session.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setRecoveryStatus(!error && data.user && hasPasswordRecoveryIntent() ? 'ready' : 'invalid');
    }).catch(() => {
      if (active) setRecoveryStatus('invalid');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (recoveryStatus !== 'ready') {
      setErrorMsg(t('auth.recoveryError'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('auth.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearPasswordRecoveryIntent();
      setRecoveryStatus('invalid');
      setSuccessMsg(t('auth.passwordUpdated'));
      window.setTimeout(() => navigate(backTo, { replace: true }), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.recoveryError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 overflow-y-auto bg-transparent min-h-0 h-full touch-pan-y flex flex-col items-center justify-center relative max-md:px-3 max-md:py-3 max-md:justify-start">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
      
      <div className="w-full md:w-[700px] lg:w-[740px] max-w-[calc(100vw-2rem)] bg-neutral-900/85 backdrop-blur-2xl border-[2px] border-transparent rounded-[1.75rem] p-7 md:p-10 lg:p-11 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)] relative overflow-hidden panel-glow-cycle transition-all max-md:p-4 max-md:rounded-2xl max-md:my-auto max-md:shrink-0">
        <div className="absolute -left-20 -top-20 w-[400px] h-[400px] bg-chess-gold/10 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-[560px] mx-auto relative z-10">
          <div className="text-center mb-8 max-md:mb-4">
            <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase">
              {t('auth.updatePasswordTitle')}
            </h1>
          </div>

          {recoveryStatus === 'invalid' && !successMsg && <p role="alert" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{t('auth.recoveryLinkInvalid')}</p>}
          {recoveryStatus === 'checking' && <p className="mb-4 text-center text-sm text-neutral-300">{t('auth.recoveryChecking')}</p>}
          {successMsg && <p role="status" className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-emerald-300 text-center">{successMsg}</p>}
          {recoveryStatus === 'ready' && !successMsg && <form onSubmit={handleUpdate} className="space-y-3 md:space-y-6">
            <div className="space-y-1">
              <label className="text-base font-semibold text-neutral-200 block mb-1">
                {t('auth.newPasswordLabel')}
              </label>
              <input 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                type="password" 
                className="w-full px-5 py-3 md:py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-base font-semibold text-neutral-200 block mb-1">
                {t('auth.confirmPasswordLabel')}
              </label>
              <input 
                required 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                type="password" 
                className="w-full px-5 py-3 md:py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
              />
            </div>

            {errorMsg && (
              <div className="text-center p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg mt-4">
                {errorMsg}
              </div>
            )}

            <button disabled={loading || !!successMsg || recoveryStatus !== 'ready'} type="submit" className="w-full py-3 md:py-5 mt-2 md:mt-4 bg-chess-gold/90 hover:bg-chess-gold disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-xl font-bold text-lg shadow-lg shadow-chess-gold/10 transition-colors active:scale-[0.99] flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t('auth.updatePasswordButton')}
            </button>

            {!successMsg && (
               <div className="mt-4 text-center">
                 <button type="button" onClick={() => navigate(backTo)} className="text-sm text-neutral-500 hover:text-white transition-colors underline decoration-white/30 underline-offset-4">
                   {t('auth.backToSignIn')}
                 </button>
               </div>
            )}
          </form>}
        </div>
      </div>
    </div>
  );
}
