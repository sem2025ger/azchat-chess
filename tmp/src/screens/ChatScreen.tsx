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
    <div className="flex-1 w-full max-w-[85rem] mx-auto px-4 pb-4 md:px-6 md:pb-6 flex gap-4 animate-fade-in bg-[#161512] overflow-hidden items-stretch lg:-mt-4 lg:py-2 lg:max-h-[calc(100vh-90px)]">

      {/* Main Chat Area - Premium Container */}
      <div className="flex-1 flex flex-col bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-[0_60px_120px_-30px_rgba(0,0,0,1)] overflow-hidden relative border-b-[8px] border-black/60 ring-1 ring-white/5">

        {/* Professional Global Header */}
        <div className="h-16 shrink-0 border-b border-white/[0.03] flex items-center px-6 gap-4 bg-white/[0.02]">
          <div className="w-10 h-10 rounded-xl bg-chess-active/10 flex items-center justify-center text-chess-active border border-chess-active/20 shadow-[0_0_20px_#00ced120]">
            <Globe size={20} />
          </div>
          <div className="flex-1">
            <h2 className="font-black text-white text-base leading-tight tracking-tighter uppercase italic">{t('chat.globalTitle')}</h2>
            <div className="flex items-center gap-2 text-[0.6rem] text-neutral-500 font-black uppercase tracking-[0.25em] mt-0.5 italic">
              <span>{t('chat.subtitle')}</span>
              <div className="w-1 h-1 rounded-full bg-white/10" />
              <span className="text-chess-gold">{t('chat.communityHub')}</span>
            </div>
          </div>
          <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2 shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
            <span className="text-[0.6rem] font-black text-emerald-400 uppercase tracking-widest leading-none">34,102 {t('chat.liveCount')}</span>
          </div>
        </div>

        {/* Dynamic Message Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4 bg-black/[0.1]">
          {msgs.map((m, i) => (
            <div key={i} className={cx("flex gap-3 max-w-[90%] animate-fade-in-up", m.type === 'self' ? "ml-auto flex-row-reverse" : "")}>

              {m.type !== 'system' && (
                <div className="w-9 h-9 rounded-[0.875rem] bg-neutral-950 flex items-center justify-center shrink-0 border border-white/5 text-xl shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-default relative">
                  <div className="absolute inset-0 bg-white/[0.02] rounded-[0.875rem] opacity-0 group-hover:opacity-100" />
                  {m.region}
                </div>
              )}

              <div className={cx(
                "flex flex-col group relative",
                m.type === 'self' ? "items-end" : "items-start"
              )}>
                {m.type !== 'system' && (
                  <div className="flex items-baseline gap-2 mb-1 px-2">
                    <span className={cx("text-[0.65rem] font-black uppercase tracking-[0.25em] italic", m.type === 'self' ? "text-chess-gold" : "text-neutral-500")}>
                      {m.user}
                      {m.type === 'self' && <span className="ml-1.5 px-1.5 py-0.5 bg-chess-gold/10 text-[0.5rem] rounded-md tracking-normal italic opacity-60 font-bold border border-chess-gold/20">{t('chat.youBadge')}</span>}
                    </span>
                    <span className="text-[0.55rem] text-neutral-700 font-black tabular-nums">{m.time}</span>
                  </div>
                )}

                <div className="relative group/bubble">
                  <div className={cx(
                    "px-5 py-2.5 rounded-[1.75rem] text-[0.82rem] font-black shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-300 relative border leading-relaxed",
                    m.type === 'system'
                      ? "bg-amber-500/10 text-amber-200 border-amber-500/20 mx-auto rounded-2xl italic text-center px-8 shadow-inner tracking-tight"
                      : m.type === 'self'
                        ? "bg-chess-gold/10 text-white border-chess-gold/20 rounded-tr-none hover:border-chess-gold/40 hover:bg-chess-gold/[0.15] ring-1 ring-chess-gold/5"
                        : "bg-white/[0.03] text-neutral-100 rounded-tl-none border-white/[0.05] hover:border-white/20 hover:bg-white/[0.06] backdrop-blur-md ring-1 ring-white/5"
                  )}>
                    {translatedIndices[i] || m.msg}
                  </div>

                  {/* Floating Action Button for Translation */}
                  {m.type === 'user' && (
                    <button
                      onClick={() => handleTranslateMessage(i, m.msg)}
                      className="absolute -right-10 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover/bubble:opacity-100 transition-all text-neutral-600 hover:text-chess-active bg-neutral-950/80 rounded-xl border border-white/10 shadow-2xl backdrop-blur-3xl ring-1 ring-white/10 active:scale-90"
                      title={t('chat.assistant.translateBubble')}
                    >
                      <Languages size={14} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Integrated User Input Control */}
        <div className="px-5 py-3 border-t border-white/[0.05] bg-black/60 relative z-30 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">

          {showAssistant && (
            <div className="animate-fade-in-up mb-2">
              <AIChatAssistant
                currentInput={inputValue}
                onSelect={handleAssistantSelect}
                onClose={() => setShowAssistant(false)}
              />
            </div>
          )}

          <div className="relative flex items-center gap-3 group/input">
            <div className="absolute -inset-1 bg-gradient-to-r from-chess-gold/20 to-chess-active/20 blur opacity-0 group-hover/input:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={t('chat.sendPlaceholder')}
                className="w-full bg-neutral-950 border border-white/10 rounded-[2rem] py-3.5 pl-6 pr-14 text-sm text-white placeholder-neutral-800 font-black shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)] focus:outline-none focus:border-chess-active focus:ring-1 focus:ring-chess-active/30 transition-all tracking-tight leading-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  onClick={() => setShowAssistant(!showAssistant)}
                  className={cx(
                    "p-2 rounded-xl transition-all shadow-2xl active:scale-95 group/spark",
                    showAssistant ? "bg-chess-active text-white scale-110" : "text-neutral-700 hover:text-chess-active hover:bg-chess-active/10"
                  )}
                >
                  <Sparkles size={18} className="group-hover/spark:rotate-12 transition-transform duration-500" />
                </button>
              </div>
            </div>

            <button
              onClick={handleSendMessage}
              className="w-12 h-12 bg-white/[0.02] hover:bg-white/[0.06] text-neutral-600 hover:text-white rounded-[1.25rem] flex items-center justify-center border border-white/[0.04] transition-all shadow-2xl active:scale-95 group/send ring-1 ring-white/5 active:translate-y-px"
            >
              <Send size={20} strokeWidth={2.5} className="group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Online List - Product Style */}
      <div className="hidden lg:flex w-[280px] xl:w-[320px] flex-col bg-neutral-900/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_80px_160px_-40px_rgba(0,0,0,1)] overflow-hidden animate-fade-in-right border-b-[8px] border-black/60 ring-1 ring-white/5 lg:h-full min-h-0">
        <div className="h-16 border-b border-white/[0.03] flex items-center px-5 gap-3 bg-white/[0.02] shrink-0">
          <div className="w-9 h-9 bg-chess-gold/10 rounded-xl flex items-center justify-center text-chess-gold border border-chess-gold/20 shadow-[0_0_20px_#dfb06220]">
            <Users size={18} />
          </div>
          <div className="flex-1">
            <h2 className="font-black text-white text-sm leading-tight uppercase italic">{t('chat.onlineUsers')}</h2>
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
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-transparent rounded-2xl hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group/user cursor-pointer shadow-xl active:scale-95 relative overflow-hidden ring-1 ring-transparent hover:ring-white/5">
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
          <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[0.6rem] font-black text-neutral-400 hover:text-white uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 group/all active:scale-95 leading-none">
            <Activity size={12} className="group-hover/all:rotate-12 transition-transform" />
            {t('chat.joinQueue')}
          </button>
        </div>
      </div>

    </div>
  );
}
