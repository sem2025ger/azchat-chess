import { useState, useEffect, useRef } from 'react';
import { useThemeContext, type BackgroundTheme, type SoundTheme } from '../context/ThemeContext';
import { playChessSound, preloadChessSounds, setChessSoundMuted } from '../utils/chessSounds';
import { BOARD_THEMES, BOARD_THEME_DETAILS, PIECE_STYLES } from '../lib/chessThemes';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard';
import { 
  Palette, Globe, Sparkles, Check, Monitor, Volume2, 
  ChevronRight, ArrowLeft, Clock, Layout as LayoutIcon
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type SubView = 'main' | 'board' | 'pieces' | 'background' | 'sound' | 'language' | 'presets';

export default function SettingsScreen() {
  const {
    boardTheme, setBoardTheme,
    pieceTheme, setPieceTheme,
    sound: soundTheme, setSound: setSoundTheme,
    background, setBackground
  } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [activeSubView, setActiveSubView] = useState<SubView>('main');

  const [showSaved, setShowSaved] = useState(false);
  const isFirstRender = useRef(true);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSaved = () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }

    setShowSaved(true);

    savedTimerRef.current = setTimeout(() => {
      setShowSaved(false);
      savedTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    triggerSaved();
  }, [boardTheme, pieceTheme, background, soundTheme]);

  useEffect(() => {
    preloadChessSounds();
  }, []);

  useEffect(() => {
    setChessSoundMuted(soundTheme === 'Muted / Off');
  }, [soundTheme]);

  const handleRestoreDefaults = () => {
    setBoardTheme('Classic Wood');
    setPieceTheme('neo');
    setSoundTheme('Default');
    setBackground('Void Black');
    triggerSaved();
  };

  const handleSoundThemeSelect = (theme: SoundTheme) => {
    const muted = theme === 'Muted / Off';

    setChessSoundMuted(muted);
    setSoundTheme(theme);

    if (!muted) {
      void playChessSound('move', theme);
    }
  };

  const boardThemes = BOARD_THEME_DETAILS;
  const pieceStyles = PIECE_STYLES;

  const bgThemes: { id: BackgroundTheme; name: string; class: string }[] = [
    { id: 'Void Black', name: 'Void Black', class: 'bg-[#161512]' },
    { id: 'Deep Space', name: 'Deep Space', class: 'bg-gradient-to-br from-[#1a1c2c] to-black' },
    { id: 'Velvet Gold', name: 'Velvet Gold', class: 'bg-gradient-to-br from-[#2f2210] to-[#0e0a04]' },
    { id: 'Champagne Light', name: 'Champagne Light', class: 'bg-gradient-to-br from-[#f2efe9] to-[#e4dfd4]' },
    { id: 'Coffee Brown', name: 'Coffee Brown', class: 'bg-gradient-to-br from-[#4e342e] to-[#261612]' },
    { id: 'Walnut Dark', name: 'Walnut Dark', class: 'bg-gradient-to-br from-[#432d20] to-[#170e0a]' },
    { id: 'Emerald Night', name: 'Emerald Night', class: 'bg-gradient-to-br from-[#064e3b] to-[#011a14]' },
    { id: 'Royal Blue', name: 'Royal Blue', class: 'bg-gradient-to-br from-[#1e3a8a] to-[#0a0f24]' },
    { id: 'Royal Violet', name: 'Royal Violet', class: 'bg-gradient-to-br from-[#4c1d95] to-[#170833]' },
    { id: 'Obsidian Gold', name: 'Obsidian Gold', class: 'bg-gradient-to-br from-[#1f1a10] to-[#0a0a0a]' },
  ];

  const presets = [
    { name: 'Classical Pro', board: 'Classic Green', pieces: 'classic' },
    { name: 'Modern Dark', board: 'Premium Gold', pieces: 'cburnett-classic' },
    { name: 'Nature Wood', board: 'Classic Wood', pieces: 'classic' },
  ];

  const languages = [
    { id: 'en', name: 'English', flag: '🇬🇧' },
    { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { id: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
    { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { id: 'ua', name: 'Українська', flag: '🇺🇦' },
    { id: 'ru', name: 'Русский', flag: '🇷🇺' },
  ];

  const renderMobileView = () => {
    switch (activeSubView) {
      case 'board':
        return (
          <div className="space-y-6 animate-fade-in">
            <SubViewHeader title={t('settings.boardAppearance')} onBack={() => setActiveSubView('main')} />
            <div className="flex flex-col gap-2 px-2">
              {boardThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBoardTheme(theme.id as any)}
                  className={cx(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    boardTheme === theme.id ? "bg-chess-gold/10 border-chess-gold/40 text-chess-gold" : "bg-white/[0.03] border-white/5 text-neutral-400"
                  )}
                >
                  <span className="font-black uppercase tracking-widest text-sm">{theme.name}</span>
                  {boardTheme === theme.id && <Check size={18} className="text-chess-gold" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 'pieces':
        return (
          <div className="space-y-6 animate-fade-in">
            <SubViewHeader title={t('settings.pieceStyles')} onBack={() => setActiveSubView('main')} />
            <div className="grid grid-cols-2 gap-3 px-2">
              {pieceStyles.map((style) => (
                <SelectionCard 
                  key={style.id}
                  active={pieceTheme === style.id}
                  onClick={() => setPieceTheme(style.id as any)}
                  title={style.name}
                  preview={
                    <div className="flex justify-center gap-1">
                      <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wK.svg` : `/pieces/${style.id}/wK.svg`} alt={style.name} className="w-8 h-8 object-contain" />
                      <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wQ.svg` : `/pieces/${style.id}/wQ.svg`} alt={style.name} className="w-8 h-8 object-contain" />
                      <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wN.svg` : `/pieces/${style.id}/wN.svg`} alt={style.name} className="w-8 h-8 object-contain" />
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        );
      case 'background':
        return (
          <div className="space-y-6 animate-fade-in">
            <SubViewHeader title={t('settings.interfaceTheme')} onBack={() => setActiveSubView('main')} />
            <div className="flex flex-col gap-2 px-2">
              {bgThemes.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setBackground(bg.id)}
                  className={cx(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    background === bg.id ? "bg-purple-500/10 border-purple-500/40 text-purple-300" : "bg-white/[0.03] border-white/5 text-neutral-400"
                  )}
                >
                  <span className="font-black uppercase tracking-widest text-sm">{bg.name}</span>
                  {background === bg.id && <Check size={18} className="text-purple-400" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 'sound':
        return (
          <div className="space-y-6 animate-fade-in">
            <SubViewHeader title={t('settings.soundThemes')} onBack={() => setActiveSubView('main')} />
            <div className="flex flex-col gap-2 px-2">
              {['Default', 'Soft', 'Classic', 'Muted / Off'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSoundThemeSelect(s as any)}
                  className={cx(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all",
                    soundTheme === s ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/5 text-neutral-400"
                  )}
                >
                  <span className="font-black uppercase tracking-widest text-sm">{s}</span>
                  {soundTheme === s && <Check size={18} className="text-chess-gold" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 'language':
        return (
          <div className="space-y-6 animate-fade-in">
            <SubViewHeader title={t('settings.changeLanguage')} onBack={() => setActiveSubView('main')} />
            <div className="flex flex-col gap-2 px-2">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id as any)}
                  className={cx(
                    "flex items-center gap-4 p-5 rounded-2xl border transition-all",
                    language === lang.id ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.03] border-white/5 text-neutral-400"
                  )}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="font-black uppercase tracking-widest text-sm flex-1 text-left">{lang.name}</span>
                  {language === lang.id && <Check size={18} className="text-chess-gold" />}
                </button>
              ))}
            </div>
          </div>
        );
      case 'presets':
        return (
          <div className="space-y-6 animate-fade-in">
            <SubViewHeader title="Studio Presets" onBack={() => setActiveSubView('main')} />
            <div className="flex flex-col gap-3 px-2">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    const b = boardThemes.find(bt => bt.name === p.board)?.id;
                    if (b) setBoardTheme(b as any);
                    setPieceTheme(p.pieces as any);
                  }}
                  className={cx(
                    "p-5 rounded-3xl bg-white/[0.03] border border-white/10 text-left flex items-center justify-between group",
                    boardTheme === p.board && pieceTheme === p.pieces ? "border-chess-gold bg-chess-gold/5" : ""
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black text-white uppercase tracking-widest">{p.name}</span>
                    <span className="text-[0.6rem] text-neutral-500 font-bold uppercase">{p.board} + {p.pieces}</span>
                  </div>
                  <Sparkles size={18} className="text-neutral-700 group-hover:text-chess-gold transition-colors" />
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return (
            <div className="space-y-4 animate-fade-in px-2 pt-4">
              <div className="space-y-3">
                <div className="p-[1px] rounded-[2.5rem] settings-animated-border shadow-2xl">
                  <div className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2.5rem-1px)] p-1.5 space-y-1 h-full">
                  <HubLink 
                    icon={<Palette size={18} />} 
                    title={t('settings.boardAppearance')} 
                    value={boardTheme} 
                    onClick={() => setActiveSubView('board')} 
                    preview={<div className={cx("w-6 h-6 rounded-md", boardThemes.find(t => t.id === boardTheme)?.color)} />}
                  />
                  <HubLink 
                    icon={<Monitor size={18} />} 
                    title={t('settings.pieceStyles')} 
                    value={pieceTheme.toUpperCase()} 
                    onClick={() => setActiveSubView('pieces')} 
                    preview={<img src={pieceTheme === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wK.svg` : `/pieces/${pieceTheme}/wK.svg`} alt="Piece" className="w-6 h-6 object-contain" />}
                  />
                  <HubLink 
                    icon={<LayoutIcon size={18} />} 
                    title={t('settings.interfaceTheme')} 
                    value={background} 
                    onClick={() => setActiveSubView('background')} 
                    preview={<div className={cx("w-6 h-6 rounded-md border border-white/10", bgThemes.find(t => t.id === background)?.class)} />}
                  />
                  <HubLink icon={<Sparkles size={18} />} title="Studio Presets" onClick={() => setActiveSubView('presets')} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-[0.4em] italic px-2">Sound & Game</h2>
                <div className="p-[1px] rounded-[2.5rem] settings-animated-border shadow-2xl">
                  <div className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2.5rem-1px)] p-1.5 space-y-1 h-full">
                  <HubLink icon={<Volume2 size={18} />} title={t('settings.soundThemes')} value={soundTheme.toUpperCase()} onClick={() => setActiveSubView('sound')} />
                  <HubLink icon={<Clock size={18} />} title={t('play.timeControl')} value="Config in Play" onClick={() => navigate('/play')} />
                  <HubLink icon={<Globe size={18} />} title={t('settings.changeLanguage')} value={language.toUpperCase()} onClick={() => setActiveSubView('language')} />
                  </div>
                </div>
              </div>

            <button 
              onClick={handleRestoreDefaults}
              className="w-full py-5 rounded-3xl bg-white/5 text-neutral-500 font-black text-xs uppercase tracking-[0.3em] italic hover:text-white transition-all shadow-xl active:scale-95"
            >
              {t('settings.restoreDefaults')}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-full xl:h-[calc(100dvh-4rem)] w-full bg-transparent flex flex-col items-center relative transition-all overflow-x-hidden xl:overflow-hidden pt-0 px-2 pb-6 md:px-8 md:pb-8 md:pt-3">
      {/* Background Decor */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-chess-active/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[85rem] z-10 h-full flex flex-col xl:justify-center">
        {/* Desktop View: Unified Grid */}
        <div className="hidden lg:grid grid-cols-12 gap-4 xl:gap-8 items-stretch">
          <div className="col-span-7 flex flex-col justify-between gap-3 xl:gap-4 pr-0 xl:pr-2 h-full">
            {/* Row 1: Board Appearance */}
            <div className="p-[1px] rounded-[2rem] settings-animated-border shadow-xl">
              <section className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2rem-1px)] p-4 relative h-full">
                <h2 className="text-sm xl:text-base font-black text-white mb-3 flex items-center gap-3 italic uppercase tracking-tighter">
                  <Palette size={16} className="text-chess-gold" /> {t('settings.boardAppearance')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                  {boardThemes.map((theme) => {
                    const colors = BOARD_THEMES[theme.id as keyof typeof BOARD_THEMES];
                    return (
                      <button key={theme.id} onClick={() => setBoardTheme(theme.id as any)} className={cx("flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl border transition-all active:scale-95", boardTheme === theme.id ? "bg-chess-gold/15 border-chess-gold/50 shadow-[0_0_18px_rgba(223,176,98,0.12)]" : "bg-black/20 border-white/5 hover:border-white/15")}>
                        <div className="w-6 h-6 grid grid-cols-2 grid-rows-2 rounded border border-white/10 overflow-hidden shrink-0">
                          <div className={colors?.light || 'bg-white'} />
                          <div className={colors?.dark || 'bg-black'} />
                          <div className={colors?.dark || 'bg-black'} />
                          <div className={colors?.light || 'bg-white'} />
                        </div>
                        <span className={cx("text-[0.55rem] font-black uppercase tracking-[0.1em] text-center", boardTheme === theme.id ? "text-chess-gold" : "text-neutral-500 hover:text-neutral-300")}>{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Row 2: Piece Styles and Sound Themes */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-4">
              {/* Piece Styles */}
              <div className="p-[1px] rounded-[2rem] settings-animated-border shadow-xl">
                <section className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2rem-1px)] p-4 relative h-full">
                  <h2 className="text-sm xl:text-base font-black text-white mb-3 flex items-center gap-3 italic uppercase tracking-tighter">
                    <Monitor size={16} className="text-chess-active" /> {t('settings.pieceStyles')}
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    {pieceStyles.map((style) => (
                      <button key={style.id} onClick={() => setPieceTheme(style.id as any)} className={cx("flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all active:scale-95", pieceTheme === style.id ? "bg-chess-active/10 border-chess-active/40" : "bg-black/20 border-white/5 hover:border-white/20")}>
                        <div className="flex gap-0.5 justify-center">
                          <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wK.svg` : `/pieces/${style.id}/wK.svg`} alt={style.name} className="w-5 h-5 object-contain" />
                          <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wN.svg` : `/pieces/${style.id}/wN.svg`} alt={style.name} className="w-5 h-5 object-contain" />
                        </div>
                        <span className="text-[0.45rem] font-black uppercase text-neutral-500 text-center leading-none">{style.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Sound Themes */}
              <div className="p-[1px] rounded-[2rem] settings-animated-border shadow-xl">
                <section className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2rem-1px)] p-4 relative h-full flex flex-col">
                  <h2 className="text-sm xl:text-base font-black text-white mb-3 flex items-center gap-3 italic uppercase tracking-tighter">
                    <Volume2 size={16} className="text-neutral-400" /> {t('settings.soundThemes')}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 flex-1 content-start">
                    {['Default', 'Soft', 'Classic', 'Muted / Off'].map(s => (
                      <button key={s} onClick={() => handleSoundThemeSelect(s as any)} className={cx("px-2 py-2 rounded-xl border text-[0.55rem] font-black uppercase tracking-[0.1em] transition-all active:scale-95", soundTheme === s ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/5 text-neutral-600 hover:border-white/15 hover:text-neutral-400")}>{s}</button>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* Row 3: Background Theme */}
            <div className="p-[1px] rounded-[2rem] settings-animated-border shadow-xl">
              <section className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2rem-1px)] p-4 relative h-full">
                <h2 className="text-sm xl:text-base font-black text-white mb-3 flex items-center gap-3 italic uppercase tracking-tighter">
                  <LayoutIcon size={16} className="text-purple-400" /> {t('settings.interfaceTheme')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                  {bgThemes.map((bg) => (
                    <button key={bg.id} onClick={() => setBackground(bg.id)} className={cx("px-2 py-1.5 rounded-xl border text-[0.5rem] font-black uppercase tracking-[0.1em] active:scale-95 leading-tight", background === bg.id ? "bg-purple-500/15 border-purple-500/50 text-purple-300" : "bg-black/20 border-white/5 text-neutral-500 hover:bg-black/40 hover:text-neutral-300")}>
                      {bg.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div className="col-span-5 relative h-full">
            <div className="p-[1px] rounded-[2.5rem] settings-animated-border shadow-2xl h-full">
              <div className="bg-neutral-900/90 backdrop-blur-3xl rounded-[calc(2.5rem-1px)] p-4 xl:p-5 flex flex-col items-center gap-3 xl:gap-4 h-full">
                <div className="flex items-center justify-between w-full">
                  <span className="text-[0.6rem] xl:text-[0.7rem] font-black uppercase tracking-[0.4em] italic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-purple-300 to-cyan-300">{t('settings.livePreview')}</span>
                  <div className="flex items-center gap-2">
                    <span className={cx("text-[0.55rem] xl:text-[0.6rem] font-black text-emerald-400 uppercase tracking-widest transition-opacity duration-300", showSaved ? "opacity-100" : "opacity-0")}>
                      {t('settings.saved')} ✓
                    </span>
                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[0.45rem] xl:text-[0.5rem] font-black text-emerald-500 uppercase tracking-widest">Active Render</div>
                  </div>
                </div>
                <div className="w-full aspect-square max-w-[260px] xl:max-w-[280px] rounded-2xl overflow-hidden shadow-2xl border-b-4 border-black/40">
                  <ChessBoard className="!p-0 !border-none !bg-transparent !shadow-none ring-0" />
                </div>
                <div className="w-full space-y-1.5">
                  <PreviewStat label={t('settings.boardTheme')} value={boardTheme} icon={<Palette size={14} className="xl:w-4 xl:h-4" />} />
                  <PreviewStat label={t('settings.pieceSet')} value={pieceTheme.toUpperCase()} icon={<Monitor size={14} className="xl:w-4 xl:h-4" />} />
                  <PreviewStat label={t('settings.appTheme')} value={background} icon={<LayoutIcon size={14} className="xl:w-4 xl:h-4" />} />
                </div>
                <button 
                  onClick={handleRestoreDefaults}
                  className="w-full py-2 xl:py-2.5 rounded-2xl bg-white/5 text-neutral-500 font-black text-[0.6rem] xl:text-[0.65rem] uppercase tracking-[0.3em] italic hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-white/10"
                >
                  {t('settings.restoreDefaults')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View: Hub and Spoke */}
        <div className="lg:hidden w-full h-full min-h-0 flex flex-col mt-2">
          {renderMobileView()}
        </div>
      </div>
    </div>
  );
}

function HubLink({ icon, title, value, onClick, preview }: { icon: any; title: string; value?: string; onClick: () => void; preview?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.04] transition-all group rounded-2xl active:scale-[0.98]">
      <div className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors border border-white/5 shadow-inner">
        {icon}
      </div>
      <div className="flex-1 flex flex-col items-start overflow-hidden text-left">
        <span className="text-sm font-black text-white italic tracking-tight">{title}</span>
        {value && <span className="text-[0.6rem] font-black text-chess-gold uppercase tracking-widest mt-0.5 opacity-60 truncate w-full">{value}</span>}
      </div>
      {preview && <div className="shrink-0">{preview}</div>}
      <ChevronRight size={16} className="text-neutral-700 group-hover:text-white transition-all transform group-hover:translate-x-1" />
    </button>
  );
}

function SubViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 px-2 mb-2">
      <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all">
        <ArrowLeft size={20} />
      </button>
      <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">{title}</h2>
    </div>
  );
}

function SelectionCard({ active, onClick, title, preview }: { active: boolean; onClick: () => void; title: string; preview: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cx("flex flex-col items-center gap-3 p-3 rounded-[2rem] border transition-all duration-500 relative overflow-hidden shadow-xl active:scale-95 group", active ? "bg-white/10 border-white/20 ring-2 ring-white/10" : "bg-black/20 border-white/5")}>
      <div className="w-full aspect-video flex items-center justify-center bg-black/40 rounded-2xl p-2 relative overflow-hidden group-hover:scale-105 transition-transform">
        {preview}
      </div>
      <span className={cx("text-[0.6rem] font-black uppercase tracking-widest italic text-center", active ? "text-white" : "text-neutral-500")}>{title}</span>
      {active && <div className="absolute top-4 right-4 text-chess-active"><Check size={16} strokeWidth={4} /></div>}
    </button>
  );
}

function PreviewStat({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center justify-between p-2.5 xl:p-3 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
      <div className="flex flex-col">
        <span className="text-[0.5rem] font-black text-neutral-600 uppercase tracking-widest italic leading-none mb-1">{label}</span>
        <span className="text-[0.8rem] font-black text-white truncate max-w-[150px]">{value}</span>
      </div>
      <div className="text-neutral-700">{icon}</div>
    </div>
  );
}
