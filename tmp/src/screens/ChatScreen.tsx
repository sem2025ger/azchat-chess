import { useState } from 'react';
import { Send, Users, Globe, Sparkles, Languages, ChevronRight, Activity } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AIChatAssistant from '../components/AIChatAssistant';
import { translateMock } from '../utils/chatAssistantLogic';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function ChatScreen() {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [showAssistant, setShowAssistant] = useState(false);
  const [translatedIndices, setTranslatedIndices] = useState<Record<number, string>>({});

  const currentUser = profile?.username || user?.user_metadata?.username || 'Guest';

  const initialMsgs = [
    { user: 'BakuMaster', region: '🇦🇿', msg: 'Salam qardaşlar! Kim oynayır?', time: '10:42', type: 'user' },
    { user: 'IstanbulKing', region: '🇹🇷', msg: 'Aleyküm selam, ben varım. 3+0 atalım.', time: '10:43', type: 'user' },
    { user: 'SiberianTiger', region: '🇷🇺', msg: 'Privet! Anyone up for 10+0 rapid?', time: '10:45', type: 'user' },
    { user: 'System', region: '🌐', msg: 'Tournament \"Turan Series #12\" starts in 15 minutes!', time: '10:50', type: 'system' },
    { user: currentUser, region: '🇦🇿', msg: 'I will join the rapid.', time: '10:52', type: 'self' },
  ];

  const [msgs, setMsgs] = useState(initialMsgs);

  const handleTranslateMessage = (index: number, text: string) => {
    if (translatedIndices[index]) {
      const newIndices = { ...translatedIndices };
      delete newIndices[index];
      setTranslatedIndices(newIndices);
    } else {
      setTranslatedIndices({
        ...translatedIndices,
        [index]: translateMock(text, language as any)
      });
    }
  };

  const handleAssistantSelect = (text: string) => {
    setInputValue(text);
    setShowAssistant(false);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const newMsg = {
      user: currentUser,
      region: '🇦🇿',
      msg: inputValue,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'self' as const
    };
    setMsgs([...msgs, newMsg]);
    setInputValue("");
  };

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row items-center justify-start lg:justify-center bg-transparent p-2 pt-4 lg:p-8 lg:pt-8 overflow-hidden animate-fade-in min-h-0">
      <div className="w-full max-w-[85rem] mx-auto flex gap-6 items-stretch h-[calc(100dvh-6rem)] lg:h-[85vh] lg:max-h-[850px] lg:min-h-[500px]">

      {/* Main Chat Area - Premium Container */}
      <div className="flex-1 flex flex-col bg-[#16171a]/95 lg:bg-neutral-900/60 backdrop-blur-3xl rounded-[2rem] lg:rounded-[2.5rem] border border-chess-active/40 overflow-hidden relative shadow-[0_0_25px_rgba(0,206,209,0.15)] transition-all">

        {/* Professional Global Header */}
        <div className="h-14 lg:h-16 shrink-0 border-b border-white/[0.05] flex items-center px-4 lg:px-6 gap-3 lg:gap-4 bg-black/20 z-10">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-chess-active/10 flex items-center justify-center text-chess-active border border-chess-active/20 shadow-[0_0_15px_#00ced130]">
            <Globe size={18} className="lg:w-5 lg:h-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-black text-premium-animate text-[0.85rem] lg:text-base leading-tight tracking-wide uppercase">ARENA CHAT</h2>
            <div className="text-[0.55rem] lg:text-[0.6rem] text-chess-active/80 font-black uppercase tracking-[0.2em] mt-0.5">
              LIVE PLAYERS
            </div>
          </div>
          <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2 shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
            <span className="text-[0.55rem] lg:text-[0.6rem] font-black text-emerald-400 uppercase tracking-widest leading-none">34K</span>
          </div>
        </div>

        {/* Dynamic Message Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 lg:px-6 py-3 lg:py-4 space-y-2.5 lg:space-y-3 bg-transparent">
          {msgs.map((m, i) => (
            <div key={i} className={cx(
              "flex gap-3 px-3 py-2.5 lg:px-4 lg:py-3 border border-transparent rounded-2xl transition-all relative overflow-hidden ring-1 ring-transparent group/msg shadow-lg",
              m.type === 'system' ? "w-full text-center bg-amber-500/5 ring-amber-500/10 justify-center" : 
              (m.type === 'self' ? "ml-auto bg-chess-gold/5 ring-chess-gold/10 hover:ring-chess-gold/20 hover:bg-chess-gold/10 max-w-[92%] lg:max-w-[85%]" : "mr-auto bg-white/[0.02] hover:bg-white/[0.04] hover:ring-white/10 max-w-[92%] lg:max-w-[85%]")
            )}>
              {/* Glow effect on hover */}
              {m.type !== 'system' && (
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/[0.02] blur-xl rounded-full translate-x-4 -translate-y-4" />
              )}
              
              {m.type !== 'system' && (
                <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-neutral-950 flex items-center justify-center shrink-0 text-lg lg:text-xl border border-white/5 relative z-10 shadow-inner group-hover/msg:rotate-3 transition-transform">
                  {m.region}
                </div>
              )}

              <div className={cx("flex flex-col relative z-10 flex-1 min-w-0", m.type === 'system' ? "items-center" : "")}>
                {m.type !== 'system' && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cx("text-[0.7rem] lg:text-[0.75rem] font-black uppercase tracking-[0.1em] truncate", m.type === 'self' ? "text-chess-gold" : "text-neutral-300 group-hover/msg:text-white transition-colors")}>
                      {m.user}
                    </span>
                    <span className="text-[0.55rem] text-neutral-600 font-black tabular-nums ml-auto">{m.time}</span>
                  </div>
                )}
                <div className={cx(
                  "text-[0.75rem] lg:text-[0.82rem] font-medium leading-snug break-words",
                  m.type === 'system' ? "text-amber-200 font-black uppercase tracking-widest text-[0.6rem] lg:text-[0.7rem]" : (m.type === 'self' ? "text-white" : "text-neutral-300")
                )}>
                  {translatedIndices[i] || m.msg}
                </div>
              </div>

              {/* Translation Button */}
              {m.type === 'user' && (
                <button
                  onClick={() => handleTranslateMessage(i, m.msg)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover/msg:opacity-100 transition-all text-neutral-500 hover:text-chess-active bg-neutral-900/90 rounded-lg border border-white/10 shadow-2xl backdrop-blur-3xl active:scale-90"
                  title={t('chat.assistant.translateBubble')}
                >
                  <Languages size={14} className="lg:w-4 lg:h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Integrated User Input Control */}
        <div className="px-3 pt-2.5 pb-5 lg:px-5 lg:py-3 border-t border-white/[0.05] bg-black/40 relative z-30 shrink-0">

          {showAssistant && (
            <div className="animate-fade-in-up mb-2">
              <AIChatAssistant
                currentInput={inputValue}
                onSelect={handleAssistantSelect}
                onClose={() => setShowAssistant(false)}
              />
            </div>
          )}

          <div className="relative flex items-center gap-2 lg:gap-3 group/input">
            <div className="absolute -inset-1 bg-gradient-to-r from-chess-active/10 to-blue-500/10 blur opacity-0 group-hover/input:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={t('chat.sendPlaceholder')}
                className="w-full bg-black/50 border border-white/10 rounded-[1.5rem] lg:rounded-[2rem] py-2.5 lg:py-3.5 pl-4 lg:pl-6 pr-10 lg:pr-14 text-[0.75rem] lg:text-sm text-white placeholder-neutral-500 font-medium shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] focus:outline-none focus:border-chess-active focus:ring-1 focus:ring-chess-active/30 transition-all tracking-wide leading-none"
              />
              <div className="absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 lg:gap-1.5">
                <button
                  onClick={() => setShowAssistant(!showAssistant)}
                  className={cx(
                    "p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all active:scale-95 group/spark",
                    showAssistant ? "bg-chess-active text-white scale-110" : "text-neutral-500 lg:text-neutral-700 hover:text-chess-active hover:bg-chess-active/10"
                  )}
                >
                  <Sparkles size={14} className="lg:w-[18px] lg:h-[18px] group-hover/spark:rotate-12 transition-transform duration-500" />
                </button>
              </div>
            </div>

            <button
               onClick={handleSendMessage}
               className="w-9 h-9 lg:w-12 lg:h-12 bg-white/5 lg:bg-white/[0.02] hover:bg-white/10 lg:hover:bg-white/[0.06] text-neutral-400 lg:text-neutral-300 hover:text-white rounded-[1rem] lg:rounded-[1.25rem] flex items-center justify-center border border-white/10 lg:border-white/[0.04] transition-all shadow-xl active:scale-95 group/send ring-1 ring-white/5"
             >
               <Send size={16} strokeWidth={2.5} className="lg:w-5 lg:h-5 group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform duration-500" />
             </button>
          </div>
        </div>
      </div>

      {/* Online List - Product Style */}
      <div className="hidden lg:flex w-[280px] xl:w-[320px] flex-col bg-neutral-900/60 backdrop-blur-3xl rounded-[2.5rem] border-[2px] border-transparent overflow-hidden animate-fade-in-right border-b-[4px] border-b-black/40 panel-glow-cycle transition-all h-full">
        <div className="h-16 border-b border-white/[0.03] flex items-center px-5 gap-3 bg-white/[0.02] shrink-0">
          <div className="w-9 h-9 bg-chess-gold/10 rounded-xl flex items-center justify-center text-chess-gold border border-chess-gold/20 shadow-[0_0_20px_#dfb06220]">
            <Users size={18} />
          </div>
          <div className="flex-1">
            <h2 className="font-black text-premium-animate text-[0.75rem] lg:text-sm leading-tight uppercase italic">{t('chat.onlineUsers')}</h2>
            <div className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-widest mt-0.5 italic">{t('chat.worldPlayers')}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-1.5 bg-black/[0.05]">
          {[
            { name: 'BakuMaster', flag: '🇦🇿', rank: 'GM', color: 'text-chess-active' },
            { name: 'IstanbulKing', flag: '🇹🇷', rank: 'IM', color: 'text-chess-gold' },
            { name: 'SiberianTiger', flag: '🇷🇺', rank: 'GM', color: 'text-chess-active' },
            { name: 'Altay_007', flag: '🇹🇷', rank: 'CM', color: 'text-neutral-400' },
            { name: 'KasparovFan', flag: '🇦🇿', rank: 'FM', color: 'text-neutral-500' },
            { name: 'Cyrus_99', flag: '🇦🇿', rank: 'candidate', color: 'text-neutral-600' },
            { name: 'PolgarX', flag: '🇭🇺', rank: 'GM', color: 'text-chess-active' },
          ].map((u, i) => (
            <div key={i} onClick={() => alert('Viewing user profile not implemented yet')} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-transparent rounded-2xl hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group/user cursor-pointer shadow-xl active:scale-95 relative overflow-hidden ring-1 ring-transparent hover:ring-white/5">
              <div className="absolute top-0 right-0 w-12 h-12 bg-white/[0.02] blur-xl rounded-full translate-x-6 -translate-y-6" />
              <div className="w-9 h-9 rounded-xl bg-neutral-950 flex items-center justify-center shrink-0 text-xl border border-white/5 group-hover/user:scale-110 group-hover/user:rotate-3 transition-all duration-500 relative z-10">
                {u.flag}
              </div>
              <div className="flex flex-col relative z-10 flex-1 min-w-0">
                <span className="text-[0.75rem] font-black text-neutral-300 group-hover/user:text-white transition-colors truncate">{u.name}</span>
                <span className={cx("text-[0.55rem] font-black uppercase tracking-[0.2em] mt-0.5", u.color)}>{u.rank}</span>
              </div>
              <div className="relative z-10 flex flex-col items-end gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                <ChevronRight size={12} className="text-neutral-800 group-hover/user:text-chess-active group-hover/user:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-black/40 border-t border-white/[0.03] shrink-0">
          <button onClick={() => alert('Matchmaking queue not implemented yet')} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[0.6rem] font-black text-neutral-400 hover:text-white uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 group/all active:scale-95 leading-none">
            <Activity size={12} className="group-hover/all:rotate-12 transition-transform" />
            {t('chat.joinQueue')}
          </button>
        </div>
      </div>

      </div>
    </div>
  );
}
