import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ChatScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center bg-transparent p-4 lg:p-8 overflow-hidden animate-fade-in min-h-0">
      <div className="w-full max-w-[40rem] flex flex-col items-center justify-center gap-6 py-12 px-6 bg-neutral-900/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/[0.05] shadow-[0_0_25px_rgba(0,0,0,0.4)]">
        <div className="w-16 h-16 rounded-2xl bg-chess-active/10 flex items-center justify-center text-chess-active border border-chess-active/20 shadow-[0_0_20px_#00ced120]">
          <Globe size={32} aria-hidden="true" />
        </div>

        <h2 className="font-black text-premium-animate text-base lg:text-xl text-center leading-tight uppercase italic tracking-wide">
          {t('chat.comingSoon')}
        </h2>
      </div>
    </div>
  );
}
