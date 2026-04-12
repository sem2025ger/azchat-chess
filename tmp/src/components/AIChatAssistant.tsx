import { useState, useEffect } from 'react';
import { Sparkles, Languages, Smile, ShieldAlert, Info, X, Check, Ghost, MessageSquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  getChessTerms, 
  getQuickPhrases, 
  getQuickReplies, 
  rewriteMessage, 
  translateMock, 
  checkToxicity 
} from '../utils/chatAssistantLogic';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface AIChatAssistantProps {
  currentInput: string;
  onSelect: (text: string) => void;
  onClose: () => void;
}

export default function AIChatAssistant({ currentInput, onSelect, onClose }: AIChatAssistantProps) {
  const { t } = useLanguage();
  const [suggestion, setSuggestion] = useState("");
  const [activeTab, setActiveTab] = useState<'tone' | 'translate' | 'quick' | 'terms'>('tone');
  const [toxicity, setToxicity] = useState<{ isToxic: boolean, suggestion?: string }>({ isToxic: false });

  const terms = getChessTerms();
  const phrases = getQuickPhrases();
  const replies = getQuickReplies();

  useEffect(() => {
    if (currentInput) {
      setToxicity(checkToxicity(currentInput));
    } else {
      setToxicity({ isToxic: false });
    }
  }, [currentInput]);

  const handleRewrite = (tone: 'polite' | 'friendly' | 'neutral') => {
    setSuggestion(rewriteMessage(currentInput, tone));
  };

  const handleTranslate = (lang: 'az' | 'tr' | 'ru') => {
    setSuggestion(translateMock(currentInput, lang));
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-4 bg-neutral-900/95 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] z-50 animate-fade-in-up overflow-hidden ring-1 ring-white/5">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-chess-active/20 flex items-center justify-center text-chess-active ring-1 ring-chess-active/30 shadow-[0_0_15px_rgba(0,206,209,0.2)]">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white tracking-tight uppercase italic">{t('chat.assistant.title')}</h3>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-neutral-500 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row h-[400px]">
        
        {/* Navigation Sidebar */}
        <div className="w-full md:w-20 border-r border-white/5 bg-black/20 flex flex-row md:flex-col items-center justify-center gap-4 py-4 shrink-0">
          {[
            { id: 'tone', icon: Smile, label: 'Tone' },
            { id: 'translate', icon: Languages, label: 'Translate' },
            { id: 'quick', icon: MessageSquare, label: 'Quick' },
            { id: 'terms', icon: Info, label: 'Terms' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cx(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative",
                activeTab === tab.id ? "bg-chess-active text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
              )}
            >
              <tab.icon size={22} className="group-hover:scale-110 transition-transform" />
              {activeTab === tab.id && <div className="absolute hidden md:block -right-[11px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-chess-active" />}
            </button>
          ))}
        </div>

        {/* Action Content Area */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
            
            {activeTab === 'tone' && (
              <div className="space-y-4">
                <h4 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-widest pl-1">Rewriting Styles</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'polite', label: t('chat.assistant.polite'), color: 'hover:border-emerald-500/30' },
                    { id: 'friendly', label: t('chat.assistant.friendly'), color: 'hover:border-chess-gold/30' },
                    { id: 'neutral', label: t('chat.assistant.neutral'), color: 'hover:border-blue-500/30' },
                  ].map((btn) => (
                    <button 
                      key={btn.id}
                      onClick={() => handleRewrite(btn.id as any)}
                      className={cx("p-4 rounded-2xl border border-white/5 bg-white/5 transition-all text-[0.6rem] font-black uppercase tracking-widest text-neutral-300", btn.color)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {toxicity.isToxic && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 animate-shake">
                    <ShieldAlert className="text-red-400 shrink-0" size={18} />
                    <div className="space-y-1">
                       <p className="text-[0.65rem] text-red-400 font-bold leading-tight">{t('chat.assistant.toxicityWarning')}</p>
                       <p className="text-[0.65rem] text-neutral-400 font-bold italic">Suggestion: {toxicity.suggestion}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'translate' && (
              <div className="space-y-4">
                 <h4 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-widest pl-1">Language Translation</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {['az', 'tr', 'ru'].map((lang) => (
                      <button 
                         key={lang}
                         onClick={() => handleTranslate(lang as any)}
                         className="p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-[0.6rem] font-black uppercase tracking-widest text-neutral-300 flex items-center justify-center gap-2"
                      >
                         <span className="text-lg">{lang === 'az' ? '🇦🇿' : lang === 'tr' ? '🇹🇷' : '🇷🇺'}</span>
                         {lang.toUpperCase()}
                      </button>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'quick' && (
              <div className="space-y-6">
                 <div>
                    <h4 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-widest pl-1 mb-3">{t('chat.assistant.phrases')}</h4>
                    <div className="flex flex-wrap gap-2">
                       {phrases.map((phrase, i) => (
                         <button key={i} onClick={() => setSuggestion(phrase)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-chess-gold/30 hover:bg-chess-gold/5 text-[0.65rem] font-bold text-neutral-300 transition-all">
                           {phrase}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div>
                    <h4 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-widest pl-1 mb-3">{t('chat.assistant.suggestions')}</h4>
                    <div className="flex flex-wrap gap-2">
                       {replies.map((reply, i) => (
                         <button key={i} onClick={() => setSuggestion(reply)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-chess-active/30 hover:bg-chess-active/5 text-[0.65rem] font-bold text-neutral-300 transition-all">
                           {reply}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'terms' && (
              <div className="space-y-4">
                 <h4 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-widest pl-1">{t('chat.assistant.terms')}</h4>
                 <div className="space-y-3">
                    {terms.map((term, i) => (
                      <button 
                        key={i} 
                        onClick={() => setSuggestion(`${term.term}: ${term.explanation}`)}
                        className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 group transition-all"
                      >
                        <div className="text-xs font-black text-chess-gold uppercase italic group-hover:underline">{term.term}</div>
                        <p className="text-[0.65rem] text-neutral-500 font-bold mt-1 leading-relaxed">{term.explanation}</p>
                      </button>
                    ))}
                 </div>
              </div>
            )}

          </div>

          {/* Preview Area */}
          <div className="mt-6 pt-6 border-t border-white/5 shrink-0 animate-fade-in">
             <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[0.55rem] font-black text-neutral-500 uppercase tracking-[0.2em]">{t('chat.assistant.preview')}</span>
                {suggestion && (
                  <button onClick={() => setSuggestion("")} className="text-[0.55rem] font-black text-red-400 uppercase tracking-widest">Clear</button>
                )}
             </div>
             <div className="min-h-[60px] bg-black/40 rounded-2xl border border-white/10 p-4 relative group">
                {suggestion ? (
                  <>
                    <p className="text-sm font-bold text-white leading-relaxed pr-8">{suggestion}</p>
                    <button 
                      onClick={() => onSelect(suggestion)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-chess-active text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                    >
                      <Check size={18} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-20 pointer-events-none py-2">
                     <Ghost size={24} className="mb-2" />
                     <span className="text-[0.6rem] font-black uppercase tracking-widest italic">No suggestion generated yet</span>
                  </div>
                )}
             </div>
          </div>

        </div>
      </div>

    </div>
  );
}
