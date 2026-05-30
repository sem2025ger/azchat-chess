import { useState } from 'react';
import { useThemeContext, type BackgroundTheme } from '../context/ThemeContext';
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
            <SubViewHeader title={t('settings.activeTheme')} onBack={() => setActiveSubView('main')} />
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
                  onClick={() => setSoundTheme(s as any)}
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
                <div className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-1.5 border border-white/10 shadow-2xl space-y-1">
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
                    title={t('settings.activeTheme')} 
                    value={background} 
                    onClick={() => setActiveSubView('background')} 
                    preview={<div className={cx("w-6 h-6 rounded-md border border-white/10", bgThemes.find(t => t.id === background)?.class)} />}
                  />
                  <HubLink icon={<Sparkles size={18} />} title="Studio Presets" onClick={() => setActiveSubView('presets')} />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-[0.65rem] font-black text-neutral-500 uppercase tracking-[0.4em] italic px-2">Sound & Game</h2>
                <div className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-1.5 border border-white/10 shadow-2xl space-y-1">
                  <HubLink icon={<Volume2 size={18} />} title={t('settings.soundThemes')} value={soundTheme.toUpperCase()} onClick={() => setActiveSubView('sound')} />
                  <HubLink icon={<Clock size={18} />} title={t('play.timeControl')} value="Config in Play" onClick={() => navigate('/play')} />
                  <HubLink icon={<Globe size={18} />} title={t('settings.changeLanguage')} value={language.toUpperCase()} onClick={() => setActiveSubView('language')} />
                </div>
              </div>

            <button 
              onClick={() => { setBoardTheme('Premium Gold'); setPieceTheme('classic'); setLanguage('az'); setSoundTheme('Default'); setBackground('Deep Space'); }}
              className="w-full py-5 rounded-3xl bg-white/5 text-neutral-500 font-black text-xs uppercase tracking-[0.3em] italic hover:text-white transition-all shadow-xl active:scale-95"
            >
              {t('settings.reset')} Studio
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-full w-full bg-transparent flex flex-col items-center relative transition-all overflow-x-hidden pt-0 px-2 pb-6 md:px-8 md:pb-8 md:pt-3">
      {/* Background Decor */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-chess-gold/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-chess-active/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[85rem] z-10">
        {/* Desktop View: Unified Grid */}
        <div className="hidden lg:grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4 pr-4">
            {/* Board Appearance */}
            <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-xl relative">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-4 italic uppercase tracking-tighter">
                <Palette size={20} className="text-chess-gold" /> {t('settings.boardAppearance')}
              </h2>
              <div className="flex flex-wrap gap-3">
                {boardThemes.map((theme) => {
                  const colors = BOARD_THEMES[theme.id as keyof typeof BOARD_THEMES];
                  return (
                    <button key={theme.id} onClick={() => setBoardTheme(theme.id as any)} className={cx("flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-95", boardTheme === theme.id ? "bg-chess-gold/15 border-chess-gold/50 shadow-[0_0_18px_rgba(223,176,98,0.12)]" : "bg-black/20 border-white/5 hover:border-white/15")}>
                      <div className="w-8 h-8 grid grid-cols-2 grid-rows-2 rounded border border-white/10 overflow-hidden shrink-0">
                        <div className={colors?.light || 'bg-white'} />
                        <div className={colors?.dark || 'bg-black'} />
                        <div className={colors?.dark || 'bg-black'} />
                        <div className={colors?.light || 'bg-white'} />
                      </div>
                      <span className={cx("text-[0.65rem] font-black uppercase tracking-[0.15em]", boardTheme === theme.id ? "text-chess-gold" : "text-neutral-500 hover:text-neutral-300")}>{theme.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Piece Styles */}
            <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-xl relative">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-4 italic uppercase tracking-tighter">
                <Monitor size={20} className="text-chess-active" /> {t('settings.pieceStyles')}
              </h2>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                {pieceStyles.map((style) => (
                  <button key={style.id} onClick={() => setPieceTheme(style.id as any)} className={cx("flex flex-col items-center gap-2 p-2 rounded-2xl border transition-all active:scale-95", pieceTheme === style.id ? "bg-chess-active/10 border-chess-active/40" : "bg-black/20 border-white/5 hover:border-white/20")}>
                    <div className="flex gap-0.5 justify-center">
                      <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wK.svg` : `/pieces/${style.id}/wK.svg`} alt={style.name} className="w-8 h-8 object-contain" />
                      <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wQ.svg` : `/pieces/${style.id}/wQ.svg`} alt={style.name} className="w-8 h-8 object-contain" />
                      <img src={style.id === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/wN.svg` : `/pieces/${style.id}/wN.svg`} alt={style.name} className="w-8 h-8 object-contain" />
                    </div>
                    <span className="text-[0.5rem] font-black uppercase text-neutral-500">{style.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Background Theme */}
            <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-5 border border-white/10 shadow-xl relative">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-4 italic uppercase tracking-tighter">
                <LayoutIcon size={20} className="text-purple-400" /> {t('settings.activeTheme')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                {bgThemes.map((bg) => (
                  <button key={bg.id} onClick={() => setBackground(bg.id)} className={cx("px-2 py-2 rounded-xl border text-[0.6rem] font-black uppercase tracking-[0.1em] active:scale-95", background === bg.id ? "bg-purple-500/15 border-purple-500/50 text-purple-300" : "bg-black/20 border-white/5 text-neutral-500 hover:bg-black/40 hover:text-neutral-300")}>
                    {bg.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Sound Themes */}
            <section className="bg-neutral-900/40 backdrop-blur-3xl rounded-[2.5rem] p-4 border border-white/10 shadow-2xl">
              <h3 className="text-sm font-black text-neutral-400 mb-3 uppercase tracking-widest">{t('settings.soundThemes')}</h3>
              <div className="flex flex-wrap gap-2">
                {['Default', 'Soft', 'Classic', 'Muted / Off'].map(s => (
                  <button key={s} onClick={() => setSoundTheme(s as any)} className={cx("px-4 py-2 rounded-xl border text-[0.65rem] font-black uppercase tracking-[0.15em] transition-all active:scale-95", soundTheme === s ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/5 text-neutral-600 hover:border-white/15 hover:text-neutral-400")}>{s}</button>
                ))}
              </div>
            </section>
          </div>

          <div className="col-span-5 relative">
            <div className="sticky top-0 bg-neutral-900/60 backdrop-blur-3xl rounded-[3rem] p-8 border border-white/10 shadow-2xl flex flex-col items-center gap-8">
              <div className="flex items-center justify-between w-full">
                <span className="text-[0.7rem] font-black text-neutral-400 uppercase tracking-[0.4em] italic">{t('settings.livePreview')}</span>
                <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[0.5rem] font-black text-emerald-500 uppercase tracking-widest">Active Render</div>
              </div>
              <div className="w-full aspect-square max-w-[360px] rounded-2xl overflow-hidden shadow-2xl border-b-4 border-black/40">
                <ChessBoard className="!p-0 !border-none !bg-transparent !shadow-none ring-0" />
              </div>
              <div className="w-full space-y-3">
                <PreviewStat label={t('settings.boardEngine')} value={boardTheme} icon={<Palette size={16} />} />
                <PreviewStat label={t('settings.pieceSet')} value={pieceTheme.toUpperCase()} icon={<Monitor size={16} />} />
                <PreviewStat label="BG THEME" value={background} icon={<LayoutIcon size={16} />} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View: Hub and Spoke */}
        <div className="lg:hidden w-full h-full min-h-0 flex flex-col">
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
    <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
      <div className="flex flex-col">
        <span className="text-[0.5rem] font-black text-neutral-600 uppercase tracking-widest italic leading-none mb-1">{label}</span>
        <span className="text-[0.8rem] font-black text-white truncate max-w-[150px]">{value}</span>
      </div>
      <div className="text-neutral-700">{icon}</div>
    </div>
  );
}
