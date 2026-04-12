import { useThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ChessBoard from '../components/ChessBoard';
import { Palette, Globe, Sparkles, Check, Monitor, Volume2, Layers } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function SettingsScreen() {
  const {
    board: boardTheme, setBoard: setBoardTheme,
    pieces: pieceStyle, setPieces: setPieceStyle,
    specialThemesEnabled: specialThemes, setSpecialThemesEnabled: setSpecialThemes,
    sound: soundTheme, setSound: setSoundTheme
  } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();

  const boardThemes = [
    { id: 'Wood', name: 'Classic Wood', color: 'bg-[#8B4513]' },
    { id: 'Ice Sea', name: 'Deep Ocean', color: 'bg-blue-900' },
    { id: 'Green', name: 'Emerald City', color: 'bg-emerald-900' },
    { id: 'Obsidian Gold', name: 'Obsidian Gold', color: 'bg-neutral-900' },
  ] as const;

  const pieceStyles = [
    { id: 'neo', name: 'Neo' },
    { id: 'classic', name: 'Classic' },
    { id: 'pieces-wood', name: 'Wood' },
    { id: 'glass', name: 'Glass' },
  ] as const;

  const languages = [
    { id: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
    { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { id: 'ru', name: 'Русский', flag: '🇷🇺' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-1.5 md:px-8 md:py-2 overflow-hidden bg-[#161512] animate-fade-in relative transition-all h-full">

      {/* Background Decoration */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-chess-active/5 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-2 relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-1.5 px-2">
        <div className="space-y-0.5">
          <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter leading-none transform-gpu skew-x-[-2deg] drop-shadow-2xl">
            {t('settings.title')}
          </h1>
          <p className="text-[0.6rem] text-neutral-500 font-black uppercase tracking-[0.4em] italic pl-1 opacity-60">{t('settings.subtitle')}</p>
        </div>
        <div className="px-4 py-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3 group hover:border-chess-gold/30 transition-all cursor-default">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
          <span className="text-[0.6rem] font-black text-neutral-400 uppercase tracking-widest">{t('play.playersOnline')}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 relative z-10">

        {/* Preferences Group */}
        <div className="space-y-2 animate-fade-in-up">
          <div className="flex items-end justify-between px-3 -mb-2">
            <h2 className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-[0.4em] italic">{t('settings.preferences')}</h2>
            <button
              onClick={() => { setBoardTheme('Wood'); setPieceStyle('classic'); setLanguage('az'); setSoundTheme('Default'); }}
              className="text-[0.55rem] font-black text-neutral-600 hover:text-white uppercase tracking-widest transition-colors shrink-0"
            >
               {t('settings.reset')}
            </button>
          </div>

          {/* Language Card */}
          <section className="bg-neutral-900/60 backdrop-blur-3xl rounded-[2rem] p-3 border border-white/10 shadow-2xl border-b-[6px] border-black/60 ring-1 ring-white/5 relative overflow-hidden group/card">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.02] blur-2xl rounded-full translate-x-6 -translate-y-6" />
            <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2.5 italic uppercase tracking-tight">
              <div className="w-7 h-7 bg-white/5 rounded-xl flex items-center justify-center text-neutral-400 border border-white/5 shadow-2xl group-hover/card:scale-110 transition-transform">
                <Globe size={14} />
              </div>
              {t('settings.changeLanguage')}
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id as any)}
                  className={cx(
                    "relative flex flex-col items-center justify-center py-2 px-2 rounded-2xl border transition-all duration-500 group/btn shadow-xl active:scale-95 ring-1 ring-transparent",
                    language === lang.id
                      ? "bg-white/10 border-white/20 text-white ring-white/10 shadow-inner"
                      : "bg-black/40 border-white/5 text-neutral-600 hover:border-white/10 hover:text-neutral-400"
                  )}
                >
                  <span className="text-xl mb-0.5 group-hover/btn:scale-110 transition-transform">{lang.flag}</span>
                  <span className="text-[0.55rem] font-black uppercase tracking-[0.2em] italic">{lang.name}</span>
                  {language === lang.id && (
                    <div className="absolute top-2 right-2 text-chess-active">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Board Themes Card */}
          <section className="bg-neutral-900/60 backdrop-blur-3xl rounded-[2rem] p-3 border border-white/10 shadow-2xl border-b-[6px] border-black/60 ring-1 ring-white/5 relative overflow-hidden group/card">
            <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2.5 italic uppercase tracking-tight">
              <div className="w-7 h-7 bg-white/5 rounded-xl flex items-center justify-center text-neutral-400 border border-white/5 shadow-2xl group-hover/card:scale-110 transition-transform">
                <Palette size={14} />
              </div>
              {t('settings.boardAppearance')}
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {boardThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBoardTheme(theme.id)}
                  className={cx(
                    "flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all duration-500 group/theme relative overflow-hidden shadow-2xl active:scale-95 ring-1 ring-transparent",
                    boardTheme === theme.id
                      ? "bg-chess-gold/10 border-chess-gold/40 ring-chess-gold/20"
                      : "bg-black/40 border-white/5 hover:border-white/20"
                  )}
                >
                  <div className={cx("w-8 h-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 group-hover/theme:scale-110 transition-transform", theme.color)} />
                  <span className={cx("text-[0.5rem] font-black uppercase tracking-widest text-center italic", boardTheme === theme.id ? "text-chess-gold" : "text-neutral-600 group-hover/theme:text-neutral-400")}>
                    {theme.name.split(' ')[0]}
                  </span>
                  {boardTheme === theme.id && <div className="absolute top-1.5 right-2 text-chess-gold"><Check size={10} strokeWidth={3} /></div>}
                </button>
              ))}
            </div>
          </section>

          {/* Piece Styles & Audio Card */}
          <section className="bg-neutral-900/60 backdrop-blur-3xl rounded-[2rem] p-3 border border-white/10 shadow-2xl border-b-[6px] border-black/60 ring-1 ring-white/5 relative overflow-hidden group/card">
            <div className="space-y-2">
              {/* Piece Selection */}
              <div>
                <h3 className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-[0.4em] italic mb-1.5">{t('settings.pieceStyles')}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {pieceStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setPieceStyle(style.id)}
                      className={cx(
                        "py-1.5 px-1 rounded-xl border text-[0.55rem] font-black uppercase tracking-widest transition-all shadow-xl group/piece active:scale-95",
                        pieceStyle === style.id
                          ? "bg-chess-active/10 border-chess-active text-chess-active shadow-[0_0_20px_rgba(0,206,209,0.2)]"
                          : "bg-black/40 border-white/5 text-neutral-500 hover:text-neutral-300 hover:border-white/20"
                      )}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Controls */}
              <div className="pt-2 border-t border-white/[0.03]">
                <h3 className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-[0.4em] italic flex items-center gap-2 mb-1.5">
                  <Volume2 size={12} /> {t('settings.soundThemes')}
                </h3>
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5 ring-1 ring-white/5">
                  {['Nature', 'Digital', 'Arcade', 'Off'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSoundTheme(s === 'Off' ? 'off' as any : s as any)}
                      className={cx(
                        "flex-1 py-1.5 rounded-xl text-[0.55rem] font-black tracking-[0.15em] uppercase italic transition-all",
                        soundTheme === s.toLowerCase() ? "bg-white/10 text-white shadow-xl border border-white/10" : "text-neutral-600 hover:text-neutral-400"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Live Preview Column */}
        <div className="space-y-2 animate-fade-in-right">
          <div className="flex items-end justify-between px-3 -mb-2">
            <h2 className="text-[0.6rem] font-black text-neutral-500 uppercase tracking-[0.4em] italic">{t('settings.appearance')}</h2>
            <span className="text-[0.55rem] font-black text-chess-active uppercase tracking-widest flex items-center gap-2 shrink-0">
               <div className="w-1.5 h-1.5 rounded-full bg-chess-active shadow-[0_0_8px_#00ced1] animate-pulse" />
               {t('settings.activeTheme')}
            </span>
          </div>

          <div className="sticky top-2 space-y-2">
            {/* Main Interactive Preview */}
            <div className="bg-neutral-900/60 backdrop-blur-3xl rounded-[2.5rem] p-4 md:p-5 border border-white/10 shadow-[0_60px_120px_-30px_rgba(0,0,0,1)] flex flex-col items-center relative overflow-hidden group/preview border-b-[8px] border-black/80 ring-1 ring-white/5">

              <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

              <div className="w-full flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <Monitor size={15} className="text-chess-active" />
                  <span className="text-[0.65rem] font-black text-white uppercase tracking-[0.3em] font-mono italic">{t('settings.livePreview')}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-chess-active/10 rounded-full border border-chess-active/20">
                  <Sparkles size={10} className="text-chess-active" />
                  <span className="text-[0.5rem] font-black text-chess-active tracking-widest uppercase">{t('settings.rendering')}</span>
                </div>
              </div>

              <div className="relative w-full max-w-[320px] aspect-square rounded-[1.25rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border-b-4 border-black/40 ring-1 ring-white/10 group-hover/preview:scale-[1.02] transition-transform duration-1000 transform-gpu">
                <ChessBoard />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 w-full max-w-[320px]">
                <div className="flex flex-col items-center p-2 bg-white/5 rounded-2xl border border-white/5 shadow-inner group/data">
                  <span className="text-[0.5rem] font-black text-neutral-600 uppercase tracking-widest mb-0.5 italic">{t('settings.boardEngine')}</span>
                  <span className="text-[0.65rem] font-black text-neutral-400 group-hover/data:text-white transition-colors">{boardTheme.toUpperCase()}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/5 rounded-2xl border border-white/5 shadow-inner group/data">
                  <span className="text-[0.5rem] font-black text-neutral-600 uppercase tracking-widest mb-0.5 italic">{t('settings.pieceSet')}</span>
                  <span className="text-[0.65rem] font-black text-neutral-400 group-hover/data:text-white transition-colors">{pieceStyle.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Special Themes Quick Access */}
            <div className="bg-gradient-to-br from-chess-gold/10 to-transparent backdrop-blur-3xl rounded-[2rem] p-3.5 border border-chess-gold/20 shadow-2xl relative overflow-hidden ring-1 ring-chess-gold/5 group/special cursor-pointer animate-pulse-slow" onClick={() => setSpecialThemes(!specialThemes)}>
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-chess-gold/5 blur-[100px] rounded-full pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className={cx(
                    "w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-700 shadow-2xl",
                    specialThemes ? "bg-chess-gold text-black border-white/20" : "bg-black/40 text-chess-gold border-chess-gold/40"
                  )}>
                    <Layers size={20} strokeWidth={2.5} className={cx(specialThemes ? "animate-spin-slow" : "")} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white italic tracking-tighter uppercase">{t('settings.specialThemes')}</h3>
                    <p className="text-[0.58rem] font-black text-neutral-500 uppercase tracking-widest mt-0.5">{t('settings.experimentalVFX')}</p>
                  </div>
                </div>
                <div className={cx(
                  "w-12 h-7 rounded-full border-2 transition-all duration-500 flex items-center px-1",
                  specialThemes ? "bg-chess-gold border-white/20" : "bg-black/40 border-white/10"
                )}>
                  <div className={cx(
                    "w-4 h-4 rounded-full transition-all duration-500 shadow-xl",
                    specialThemes ? "bg-white translate-x-5" : "bg-neutral-700 translate-x-0"
                  )} />
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
