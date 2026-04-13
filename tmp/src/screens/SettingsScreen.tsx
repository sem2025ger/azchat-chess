import { useThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ChessBoard from '../components/ChessBoard';
import { Palette, Globe, Sparkles, Check, Monitor, Volume2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function SettingsScreen() {
  const {
    boardTheme, setBoardTheme,
    pieceTheme, setPieceTheme,
    sound: soundTheme, setSound: setSoundTheme
  } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();

  const boardThemes = [
    { id: 'Tournament', name: 'Tournament', color: 'bg-[#739552]' },
    { id: 'Wood', name: 'Classic Wood', color: 'bg-[#8b4a1c]' },
    { id: 'Ivory', name: 'Elegant Ivory', color: 'bg-[#b8a184]' },
    { id: 'Obsidian Gold', name: 'Obsidian Night', color: 'bg-[#1a1a1a]' },
    { id: 'Walnut', name: 'Walnut Blend', color: 'bg-[#b88b4a]' },
    { id: 'Blue Steel', name: 'Blue Steel', color: 'bg-[#4b5563]' },
    { id: 'Marble Sand', name: 'Marble Sand', color: 'bg-[#a3a3a3]' },
    { id: 'Green', name: 'Chess.com Green', color: 'bg-[#779556]' },
  ] as const;

  const pieceStyles = [
    { id: 'classic', name: 'Classic', preview: 'wK' },
    { id: 'neo', name: 'Neo', preview: 'wK' },
    { id: 'tournament', name: 'Tournament', preview: 'wK' },
    { id: 'wood', name: 'Wood Set', preview: 'wK' },
    { id: 'glass', name: 'Modern Glass', preview: 'wK' },
    { id: 'marble', name: 'Marble Stone', preview: 'wK' },
  ] as const;

  const presets = [
    { name: 'Classical Pro', board: 'Tournament', pieces: 'classic' },
    { name: 'Modern Dark', board: 'Obsidian Gold', pieces: 'neo' },
    { name: 'Nature Wood', board: 'Wood', pieces: 'wood' },
  ];

  const languages = [
    { id: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
    { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { id: 'ru', name: 'Русский', flag: '🇷🇺' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-1.5 md:px-8 md:py-4 overflow-hidden bg-[#161512] animate-fade-in relative transition-all h-full">

      {/* Background Decoration */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-chess-active/5 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-4 relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-1.5 px-2">
        <div className="space-y-0.5">
          <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter leading-none transform-gpu skew-x-[-2deg] drop-shadow-2xl">
            {t('settings.title')}
          </h1>
          <p className="text-[0.65rem] text-neutral-500 font-black uppercase tracking-[0.5em] italic pl-1 opacity-60">Customization Studio</p>
        </div>
        <div className="px-6 py-2.5 bg-white/5 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl flex items-center gap-4 group hover:border-chess-gold/30 transition-all cursor-default">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_#10b981]" />
          <span className="text-[0.7rem] font-black text-neutral-300 uppercase tracking-widest">{t('play.playersOnline')}: 34,102</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 h-[calc(100vh-180px)]">

        {/* Preferences Group */}
        <div className="lg:col-span-7 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Quick Presets */}
          <div className="flex items-center gap-3 mb-2 px-1">
             <Sparkles size={16} className="text-chess-gold animate-pulse" />
             <h2 className="text-[0.65rem] font-black text-white/40 uppercase tracking-[0.4em] italic leading-none">Studio Presets</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {presets.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  const b = boardThemes.find(bt => bt.name === p.board)?.id;
                  if (b) setBoardTheme(b as any);
                  setPieceTheme(p.pieces as any);
                }}
                className={cx(
                  "px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-chess-gold/40 hover:bg-white/10 transition-all text-left group shadow-xl",
                  boardTheme === p.board && pieceTheme === p.pieces ? "border-chess-gold bg-chess-gold/5" : ""
                )}
              >
                <div className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-widest group-hover:text-chess-gold transition-colors">{p.name}</div>
                <div className="text-[0.5rem] text-neutral-600 font-bold uppercase mt-1">{p.board} + {p.pieces}</div>
              </button>
            ))}
          </div>

          {/* Board Themes Card */}
          <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-2xl relative overflow-hidden group/card ring-1 ring-white/5">
            <h2 className="text-lg font-black text-white mb-4 flex items-center gap-3 italic uppercase tracking-tighter">
              <div className="w-9 h-9 bg-chess-gold/10 rounded-2xl flex items-center justify-center text-chess-gold border border-chess-gold/20 shadow-xl group-hover/card:scale-110 transition-transform">
                <Palette size={18} />
              </div>
              {t('settings.boardAppearance')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {boardThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBoardTheme(theme.id as any)}
                  className={cx(
                    "flex flex-col items-center gap-2 p-2 rounded-[1.5rem] border transition-all duration-500 group/theme relative overflow-hidden shadow-xl active:scale-95",
                    boardTheme === theme.id
                      ? "bg-chess-gold/10 border-chess-gold/40 ring-2 ring-chess-gold/20"
                      : "bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/40"
                  )}
                >
                  <div className={cx("w-full aspect-video rounded-xl shadow-2xl border border-white/10 group-hover/theme:scale-105 transition-transform", theme.color)} />
                  <span className={cx("text-[0.6rem] font-black uppercase tracking-widest text-center italic mt-1", boardTheme === theme.id ? "text-chess-gold" : "text-neutral-500 group-hover/theme:text-neutral-300")}>
                    {theme.name}
                  </span>
                  {boardTheme === theme.id && <div className="absolute top-2 right-3 text-chess-gold drop-shadow-lg"><Check size={14} strokeWidth={4} /></div>}
                </button>
              ))}
            </div>
          </section>

          {/* Piece Styles Card */}
          <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-2xl relative overflow-hidden group/card ring-1 ring-white/5">
            <h2 className="text-lg font-black text-white mb-4 flex items-center gap-3 italic uppercase tracking-tighter">
              <div className="w-9 h-9 bg-chess-active/10 rounded-2xl flex items-center justify-center text-chess-active border border-chess-active/20 shadow-xl group-hover/card:scale-110 transition-transform">
                <Monitor size={18} />
              </div>
              {t('settings.pieceStyles')}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {pieceStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setPieceTheme(style.id as any)}
                  className={cx(
                    "flex flex-col items-center gap-2 p-2 rounded-[1.5rem] border transition-all duration-500 group/piece relative overflow-hidden shadow-xl active:scale-95",
                    pieceTheme === style.id
                      ? "bg-chess-active/10 border-chess-active/40 ring-2 ring-chess-active/20"
                      : "bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/40"
                  )}
                >
                  <div className="w-12 h-12 flex items-center justify-center p-1 bg-white/5 rounded-xl border border-white/5 shadow-inner group-hover/piece:scale-110 transition-transform">
                     <img src={`/pieces/${style.id}/wK.svg`} alt={style.name} className="w-full h-full object-contain" />
                  </div>
                  <span className={cx("text-[0.5rem] font-black uppercase tracking-widest text-center italic", pieceTheme === style.id ? "text-chess-active" : "text-neutral-500 group-hover/piece:text-neutral-400")}>
                    {style.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Language / Sound Group */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Language Card */}
              <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                <h2 className="text-sm font-black text-white/60 mb-3 flex items-center gap-2 italic uppercase">
                  <Globe size={14} /> {t('settings.changeLanguage')}
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setLanguage(lang.id as any)}
                      className={cx(
                        "flex flex-col items-center justify-center py-2.5 rounded-2xl border transition-all shadow-xl active:scale-95",
                        language === lang.id ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/5 text-neutral-600 hover:text-neutral-400"
                      )}
                    >
                      <span className="text-xl mb-1">{lang.flag}</span>
                      <span className="text-[0.5rem] font-black italic tracking-tighter font-mono">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Sound Card */}
              <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                <h2 className="text-sm font-black text-white/60 mb-3 flex items-center gap-2 italic uppercase">
                  <Volume2 size={14} /> {t('settings.soundThemes')}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {['Nature', 'Digital', 'Arcade', 'Off'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSoundTheme(s === 'Off' ? 'off' as any : s as any)}
                      className={cx(
                        "py-2.5 rounded-2xl border transition-all text-[0.6rem] font-black uppercase tracking-widest italic shadow-xl",
                        soundTheme === s.toLowerCase() ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/5 text-neutral-600 hover:text-neutral-400"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 relative flex flex-col items-center justify-center lg:pl-4">
           <div className="w-full max-w-[420px] sticky top-0">
              <div className="bg-neutral-900/60 backdrop-blur-[100px] rounded-[3rem] p-6 border-2 border-white/10 shadow-[0_80px_160px_-40px_rgba(0,0,0,1)] ring-1 ring-white/5 relative group/board-wrap">
                 <div className="absolute -top-10 -right-10 w-40 h-40 bg-chess-gold/10 blur-[80px] rounded-full pointer-events-none group-hover/board-wrap:bg-chess-gold/20 transition-all duration-1000" />
                 
                 <div className="flex items-center justify-between mb-6 px-3">
                    <div className="flex items-center gap-3">
                       <Monitor size={18} className="text-chess-active animate-pulse" />
                       <span className="text-[0.75rem] font-black text-white uppercase tracking-[0.4em] italic leading-none">{t('settings.livePreview')}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 shadow-inner">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                       <span className="text-[0.55rem] font-black text-neutral-400 tracking-[0.2em] uppercase">High Performance Mode</span>
                    </div>
                 </div>

                 <div className="relative aspect-square rounded-2xl overflow-hidden shadow-[0_50px_100px_-25px_rgba(0,0,0,0.8)] border-b-[6px] border-black/50 group-hover/board-wrap:scale-[1.03] transition-transform duration-700 transform-gpu cursor-default">
                    <ChessBoard className="!p-0 !border-none !bg-transparent !shadow-none ring-0" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] to-transparent pointer-events-none" />
                 </div>

                 <div className="mt-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center p-4 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
                       <div className="flex flex-col">
                          <span className="text-[0.5rem] font-black text-neutral-600 uppercase tracking-widest italic">{t('settings.boardEngine')}</span>
                          <span className="text-[0.85rem] font-black text-white mt-0.5">{boardTheme}</span>
                       </div>
                       <Palette size={18} className="text-neutral-700" />
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
                       <div className="flex flex-col">
                          <span className="text-[0.5rem] font-black text-neutral-600 uppercase tracking-widest italic">{t('settings.pieceSet')}</span>
                          <span className="text-[0.85rem] font-black text-white mt-0.5 font-mono">{pieceTheme.toUpperCase()} SET</span>
                       </div>
                       <Monitor size={18} className="text-neutral-700" />
                    </div>
                 </div>
              </div>

              {/* Reset Control */}
              <button 
                onClick={() => { setBoardTheme('Obsidian Gold'); setPieceTheme('classic'); setLanguage('az'); setSoundTheme('Default'); }}
                className="mt-6 w-full py-4 rounded-2xl border-2 border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10 text-neutral-500 hover:text-white transition-all text-xs font-black uppercase tracking-[0.4em] italic shadow-2xl active:scale-95"
              >
                {t('settings.reset')} Studio
              </button>
           </div>
        </div>

      </div>

    </div>
  );
}
