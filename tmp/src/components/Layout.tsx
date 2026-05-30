import { NavLink, Outlet } from 'react-router-dom';
import { Home, Play, Grid, MessageSquare, User, Settings, Globe, Circle } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { type Language } from '../translations';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { background, specialThemesEnabled } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();

  const bgClasses: Record<string, string> = {
    'Void Black': 'bg-[#161512]',
    'Deep Space': 'bg-gradient-to-br from-[#1a1c2c] via-[#0f0f1b] to-black',
    'Velvet Gold': 'bg-gradient-to-br from-[#2f2210] via-[#1c1408] to-[#0e0a04] shadow-[inset_0_0_150px_rgba(223,176,98,0.03)]',
    'Champagne Light': 'bg-gradient-to-br from-[#f2efe9] to-[#e4dfd4] text-black',
    'Coffee Brown': 'bg-gradient-to-br from-[#4e342e] via-[#3e2723] to-[#261612]',
    'Walnut Dark': 'bg-gradient-to-br from-[#432d20] via-[#2b1c14] to-[#170e0a]',
    'Emerald Night': 'bg-gradient-to-br from-[#064e3b] via-[#022c22] to-[#011a14]',
    'Royal Blue': 'bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-[#0a0f24]',
    'Royal Violet': 'bg-gradient-to-br from-[#4c1d95] via-[#2e1065] to-[#170833]',
    'Obsidian Gold': 'bg-gradient-to-br from-[#1f1a10] via-[#121212] to-[#0a0a0a]',
  };

  const currentBgClass = specialThemesEnabled ? (bgClasses[background] || bgClasses['Void Black']) : bgClasses['Void Black'];

  return (
    <div className={cx("min-h-screen flex selection:bg-chess-gold/30 selection:text-white", currentBgClass)}>

      {/* Premium Sidebar Navigation - Hidden on Mobile */}
      <aside className="hidden md:flex w-20 xl:w-72 bg-black/40 backdrop-blur-3xl border-r border-white/[0.05] flex-col justify-between shrink-0 relative z-50 transition-all duration-500 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">

          <div className="h-16 xl:h-20 flex items-center justify-center xl:justify-start px-2 xl:px-6 border-b border-white/[0.03] shrink-0 bg-white/[0.01]">
            <div className="flex flex-col overflow-hidden justify-center w-full items-center xl:items-start">
              <span className="font-black text-[0.55rem] md:text-[0.6rem] xl:text-[1.65rem] tracking-tighter italic leading-none text-glow-cycle w-full text-center xl:text-left transition-all duration-500">
                AZTRChess.De
              </span>
              <span className="text-[0.55rem] font-black text-neutral-500 uppercase tracking-[0.25em] mt-1.5 italic opacity-60 hidden xl:block truncate">
                PREMIUM CHESS PLATFORM
              </span>
            </div>
          </div>

          <nav className="px-3 xl:px-5 py-4 space-y-0.5 flex-1">
            <div className="hidden xl:block mb-3 px-2 text-[0.5rem] font-black text-neutral-600 uppercase tracking-[0.2em] italic leading-none">{t('sidebar.nav')}</div>
            <NavItem to="/home" icon={<Home size={20} />} label={t('nav.home')} themeColor="theme-premium" />
            <NavItem to="/play" icon={<Play size={20} />} label={t('nav.play')} themeColor="theme-cyan" />
            <NavItem to="/game" icon={<Grid size={20} />} label={t('nav.game')} themeColor="theme-emerald" />
            <NavItem to="/chat" icon={<MessageSquare size={20} />} label={t('nav.chat')} themeColor="theme-violet" />
            <NavItem to="/profile" icon={<User size={20} />} label={t('nav.profile')} themeColor="theme-blue" />
          </nav>
        </div>

        <div className="p-2 xl:p-5 space-y-3 border-t border-white/[0.05] bg-black/40 shadow-inner shrink-0">

          {/* Refined Language Selector - AZ / TR / RU ONLY */}
          <div className="flex flex-col gap-3">
            <div className="hidden xl:block px-2 text-[0.5rem] font-black text-neutral-600 uppercase tracking-[0.2em] italic">{t('sidebar.system')}</div>
            <div className="hidden xl:flex items-center gap-1.5 mb-0.5 opacity-30">
              <Globe size={10} className="text-neutral-400" />
              <span className="text-[0.5rem] font-black text-neutral-400 uppercase tracking-widest italic">{t('layout.localization')}</span>
            </div>

            <div className="hidden xl:flex bg-neutral-900/60 p-0.5 rounded-lg border border-white/5 shadow-inner premium-cycle-container transition-all">
              {(['en', 'de', 'az', 'tr', 'ua', 'ru'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cx(
                    "flex-1 py-1 text-[0.6rem] font-black uppercase rounded-md transition-all duration-150 active:scale-95 sidebar-item",
                    language === lang ? "premium-cycle-active" : "text-neutral-600 sidebar-item-hover"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="md:hidden grid grid-cols-3 gap-2 items-center mb-2 premium-cycle-container p-2 rounded-xl border border-white/5">
              {(['en', 'de', 'az', 'tr', 'ua', 'ru'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cx(
                    "w-10 h-10 text-[0.7rem] font-black uppercase rounded-xl transition-all flex items-center justify-center sidebar-item",
                    language === lang ? "premium-cycle-active" : "text-neutral-600 bg-white/5 sidebar-item-hover"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <NavItem to="/settings" icon={<Settings size={24} />} label={t('nav.settings')} themeColor="theme-gold" />
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Visible only on Small Screens */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-2xl border-t border-white/[0.05] flex items-center justify-around px-1 z-50 pb-safe pt-1.5 h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <MobileNavItem to="/home" icon={<Home size={20} />} label={t('nav.home')} />
        <MobileNavItem to="/play" icon={<Play size={20} />} label={t('nav.play')} />
        <MobileNavItem to="/game" icon={<Grid size={20} />} label={t('nav.game')} />
        <MobileNavItem to="/chat" icon={<MessageSquare size={20} />} label={t('nav.chat')} />
        <MobileNavItem to="/profile" icon={<User size={20} />} label={t('nav.profile')} />
        <MobileNavItem to="/settings" icon={<Settings size={20} />} label={t('nav.settings')} />
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {/* Dynamic decorative glows */}
        <div className="absolute top-[-25%] right-[-15%] w-[60%] h-[60%] bg-chess-active/5 blur-[120px] rounded-full pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-25%] left-[-15%] w-[60%] h-[60%] bg-chess-gold/5 blur-[120px] rounded-full pointer-events-none animate-pulse-slow active-animation-delay" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar overscroll-none flex flex-col">
          <Outlet />
        </div>
      </main>

    </div>
  );
}

function NavItem({ to, icon, label, themeColor = 'theme-cyan' }: { to: string, icon: React.ReactNode, label: string, themeColor?: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "flex items-center px-4 py-[1.125rem] rounded-2xl transition-all duration-200 font-black text-[0.85rem] uppercase tracking-wider relative group active:scale-95 sidebar-item",
          isActive
            ? `sidebar-item-active ${themeColor}`
            : "text-neutral-500 sidebar-item-hover"
        )
      }
    >
      <div className="w-8 flex justify-center shrink-0 group-hover:scale-110 transition-transform duration-500">{icon}</div>
      <span className="ml-4 hidden xl:block italic truncate">{label}</span>

      {/* Active Indicator Dot */}
      <NavItemActiveDot />

      {/* Tooltip for small screens (Mobile/Tablet narrow) */}
      <div className="absolute left-full ml-4 px-3 py-2 bg-neutral-900 text-white text-[0.6rem] font-black uppercase tracking-widest rounded-xl opacity-0 translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 md:hidden z-50 whitespace-nowrap border border-white/10 shadow-2xl transition-all duration-300">
        {label}
      </div>
    </NavLink>
  );
}

function NavItemActiveDot() {
  return (
    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-chess-active shadow-[0_0_8px_#00ced1] opacity-0 transition-opacity group-[.active]:opacity-100 hidden xl:block" />
  );
}

function MobileNavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300",
          isActive ? "text-chess-active scale-110" : "text-neutral-500 hover:text-neutral-300"
        )
      }
    >
      <div className="relative">
        {icon}
        <Circle size={4} className="absolute -top-1 -right-1 opacity-0 group-[.active]:opacity-100 text-chess-active fill-current" />
      </div>
      <span className="text-[0.5rem] font-black uppercase tracking-widest">{label}</span>
    </NavLink>
  );
}
