import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useLanguage } from '../context/LanguageContext';
import { Loader2 } from 'lucide-react';

export default function UpdatePasswordScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setErrorMsg(t('auth.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessMsg(t('auth.passwordUpdated'));
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.recoveryError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 overflow-y-auto lg:overflow-hidden bg-transparent h-full min-h-0 touch-pan-y pb-28 lg:pb-0 lg:h-full flex flex-col items-center justify-center relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
      
      <div className="w-full md:w-[700px] lg:w-[740px] max-w-[calc(100vw-2rem)] bg-neutral-900/85 backdrop-blur-2xl border-[2px] border-transparent rounded-[1.75rem] p-7 md:p-10 lg:p-11 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)] animate-fade-in-up relative overflow-hidden panel-glow-cycle transition-all">
        <div className="absolute -left-20 -top-20 w-[400px] h-[400px] bg-chess-gold/10 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-[560px] mx-auto relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase">
              {t('auth.updatePasswordTitle')}
            </h1>
          </div>

          <form onSubmit={handleUpdate} className="space-y-5 md:space-y-6">
            <div className="space-y-1">
              <label className="text-base font-semibold text-neutral-200 block mb-1">
                {t('auth.newPasswordLabel')}
              </label>
              <input 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                type="password" 
                className="w-full px-5 py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
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
                className="w-full px-5 py-4 bg-neutral-950/70 border border-white/15 rounded-xl text-base md:text-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-chess-gold/60 focus:ring-2 focus:ring-chess-gold/20 transition-colors [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.55)] [&:-webkit-autofill]:![-webkit-text-fill-color:#ffffff] [&:-webkit-autofill]:caret-white [&:-webkit-autofill]:transition-[background-color] [&:-webkit-autofill]:duration-[9999s]" 
              />
            </div>

            {errorMsg && (
              <div className="text-center p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg mt-4">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="text-center p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg mt-4">
                {successMsg}
              </div>
            )}

            <button disabled={loading || !!successMsg} type="submit" className="w-full py-4 md:py-5 mt-4 bg-chess-gold/90 hover:bg-chess-gold disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-xl font-bold text-lg shadow-lg shadow-chess-gold/10 transition-colors active:scale-[0.99] flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t('auth.updatePasswordButton')}
            </button>

            {successMsg && (
              <button type="button" onClick={() => navigate('/profile')} className="w-full py-4 md:py-5 mt-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold text-lg border border-white/5 transition-colors active:scale-[0.99] flex items-center justify-center gap-2">
                {t('auth.backToSignIn')}
              </button>
            )}
            
            {!successMsg && (
               <div className="mt-4 text-center">
                 <button type="button" onClick={() => navigate('/profile')} className="text-sm text-neutral-500 hover:text-white transition-colors underline decoration-white/30 underline-offset-4">
                   {t('auth.backToSignIn')}
                 </button>
               </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
