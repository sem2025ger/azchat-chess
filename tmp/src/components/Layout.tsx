import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Play, Grid, MessageSquare, User, Settings, Globe, Circle, Search, Bell } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { type Language } from '../translations';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { background, specialThemesEnabled } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();
  const { user, profile } = useAuth();
  const location = useLocation();
  const isGameRoute = location.pathname.includes('/game');

  const bgClasses: Record<string, string> = {
    'Standard': 'bg-[#161512]',
    'Game Room': 'bg-gradient-to-br from-[#1a1c2c] via-[#0f0f1b] to-black',
    'Classic': 'bg-[#262421]',
    'Light': 'bg-[#f1f1f1] text-black',
    'Wood': 'bg-gradient-to-br from-[#2c1b0e] to-[#1a0f08]',
    'Glass': 'bg-gradient-to-tr from-[#0f172a] via-[#1e293b] to-[#0f172a]'
  };

  const currentBgClass = specialThemesEnabled ? (bgClasses[background] || bgClasses['Standard']) : bgClasses['Standard'];

  return (
    <div className={cx("min-h-screen flex selection:bg-chess-gold/30 selection:text-white", currentBgClass)}>

      {/* Premium Sidebar Navigation - Hidden on Mobile */}
      <aside className="hidden md:flex w-20 md:w-72 bg-black/40 backdrop-blur-3xl border-r border-white/[0.05] flex-col justify-between shrink-0 relative z-50">
        <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">

          <div className="h-24 flex items-center justify-center md:justify-start px-2 md:px-8 border-b border-white/[0.03] shrink-0">
            <div className="w-12 h-12 bg-gradient-to-tr from-chess-gold to-amber-200 rounded-[1rem] overflow-hidden flex items-center justify-center text-black font-black text-xl shadow-[0_0_20px_rgba(223,176,98,0.3)] flex-shrink-0 animate-pulse-slow">
              AZ
            </div>
            <div className="ml-4 md:flex flex-col hidden overflow-hidden">
              <span className="font-black text-2xl tracking-tighter text-white italic leading-none">HubbyChat</span>
              <span className="text-[0.75rem] font-black text-neutral-500 uppercase tracking-[0.4em] mt-1 italic">Chess Platform</span>
            </div>
          </div>

          <nav className="px-5 md:px-7 py-6 space-y-1 flex-1">
            <div className="hidden md:block mb-4 px-2 text-[0.55rem] font-black text-neutral-500 uppercase tracking-[0.3em] italic">{t('sidebar.nav')}</div>
            <NavItem to="/home" icon={<Home size={22} />} label={t('nav.home')} />
            <NavItem to="/play" icon={<Play size={22} />} label={t('nav.play')} />
            <NavItem to="/game" icon={<Grid size={22} />} label={t('nav.game')} />
            <NavItem to="/chat" icon={<MessageSquare size={22} />} label={t('nav.chat')} />
            <NavItem to="/profile" icon={<User size={22} />} label={t('nav.profile')} />
          </nav>
        </div>

        <div className="p-5 md:p-8 space-y-8 border-t border-white/[0.05] bg-black/40 shadow-inner">

          {/* Refined Language Selector - AZ / TR / RU ONLY */}
          <div className="flex flex-col gap-4">
            <div className="hidden md:block px-2 text-[0.55rem] font-black text-neutral-500 uppercase tracking-[0.3em] italic">{t('sidebar.system')}</div>
            <div className="hidden md:flex items-center gap-2 mb-1">
              <Globe size={12} className="text-neutral-600" />
              <span className="text-[0.55rem] font-black text-neutral-600 uppercase tracking-widest italic">{t('layout.localization')}</span>
            </div>

            <div className="hidden md:flex bg-neutral-900/60 p-1 rounded-2xl border border-white/5 shadow-inner">
              {(['az', 'tr', 'ru'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cx(
                    "flex-1 py-2 text-[0.65rem] font-black uppercase rounded-xl transition-all duration-300 active:scale-95",
                    language === lang ? "bg-chess-gold text-black shadow-xl scale-105" : "text-neutral-500 hover:text-neutral-300"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="md:hidden flex flex-col gap-2 items-center mb-2">
              {(['az', 'tr', 'ru'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cx(
                    "w-10 h-10 text-[0.7rem] font-black uppercase rounded-xl transition-all flex items-center justify-center",
                    language === lang ? "bg-chess-gold text-black shadow-lg" : "text-neutral-600 hover:text-neutral-400 bg-white/5"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <NavItem to="/settings" icon={<Settings size={22} />} label={t('nav.settings')} />

            <div className="hidden md:flex items-center gap-4 px-4 py-3 bg-white/[0.03] rounded-2xl border border-white/[0.05] shadow-inner mt-4 group">
              <div className="relative">
                <span className="text-2xl group-hover:scale-110 transition-transform block">🇦🇿</span>
                <Circle size={8} fill="#10b981" className="absolute -bottom-0.5 -right-0.5 text-emerald-500 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] font-black text-white italic leading-none">HubbyChat</span>
                <span className="text-[0.55rem] text-neutral-600 font-bold uppercase tracking-widest mt-1">{t('layout.regionInfo')}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Visible only on Small Screens */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-2xl border-t border-white/[0.05] flex items-center justify-around px-1 z-50">
        <MobileNavItem to="/home" icon={<Home size={20} />} label={t('nav.home')} />
        <MobileNavItem to="/play" icon={<Play size={20} />} label={t('nav.play')} />
        <MobileNavItem to="/game" icon={<Grid size={20} />} label={t('nav.game')} />
        <MobileNavItem to="/chat" icon={<MessageSquare size={20} />} label={t('nav.chat')} />
        <MobileNavItem to="/profile" icon={<User size={20} />} label={t('nav.profile')} />
        <MobileNavItem to="/settings" icon={<Settings size={20} />} label={t('nav.settings')} />
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0">
        {/* Dynamic decorative glows */}
        <div className="absolute top-[-25%] right-[-15%] w-[60%] h-[60%] bg-chess-active/5 blur-[120px] rounded-full pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-25%] left-[-15%] w-[60%] h-[60%] bg-chess-gold/5 blur-[120px] rounded-full pointer-events-none animate-pulse-slow active-animation-delay" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar overscroll-none flex flex-col">
          {/* Transparent Integrated Utility Layer */}
          <header className="shrink-0 pt-4 md:pt-6 pb-2 px-4 md:px-12 flex items-center justify-between relative z-20">
            <div className={cx("flex-1 max-w-[200px] md:max-w-sm flex items-center transition-all duration-700 ease-in-out", isGameRoute ? "opacity-20 hover:opacity-100 focus-within:opacity-100 grayscale hover:grayscale-0 focus-within:grayscale-0" : "opacity-100")}>
              <div className="w-full flex items-center gap-2 md:gap-3 bg-white/[0.03] border border-white/5 rounded-full px-3 md:px-5 py-2 md:py-3 focus-within:bg-white/[0.06] focus-within:border-white/10 transition-colors shadow-inner">
                <Search size={14} className="text-neutral-500" />
                <input type="text" placeholder={t('topbar.search')} className="bg-transparent border-none outline-none text-xs md:text-sm font-black text-white placeholder:text-neutral-600 italic tracking-wide w-full" />
              </div>
            </div>
            <div className="flex flex-1 md:flex-none justify-end items-center gap-3 md:gap-5">
              <button className="relative w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-white/[0.03] border border-white/5 rounded-full hover:bg-white/[0.08] transition-colors group group-active:scale-95 shadow-inner">
                <Bell size={16} className="text-neutral-400 group-hover:text-white transition-colors" />
                <div className="absolute top-2 right-2 w-1.5 h-1.5 md:w-2 md:h-2 bg-chess-active rounded-full shadow-[0_0_8px_#00ced1] animate-pulse" />
              </button>
              <div className="h-6 w-px bg-white/5 hidden md:block" />
              <button className="flex items-center gap-3 md:gap-4 group">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[0.65rem] md:text-[0.8rem] font-black text-white tracking-tight italic">{profile?.username || user?.user_metadata?.username || 'Guest'}</span>
                  <span className="text-[0.45rem] md:text-[0.55rem] font-black text-chess-gold uppercase tracking-[0.2em]">{profile?.role || 'PRO'}</span>
                </div>
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-neutral-800 to-black border border-white/10 flex items-center justify-center overflow-hidden shadow-xl ring-2 ring-transparent group-hover:ring-white/10 transition-all">
                  <User size={16} className="text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </button>
            </div>
          </header>

          <Outlet />
        </div>
      </main>

    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "flex items-center px-4 py-4 rounded-2xl transition-all duration-500 font-black text-[0.8rem] uppercase tracking-wider relative group active:scale-95",
          isActive
            ? "bg-chess-active/10 text-chess-active shadow-[inset_4px_0_0_0_#00ced1] ring-1 ring-chess-active/20"
            : "text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-200"
        )
      }
    >
      <div className="w-8 flex justify-center shrink-0 group-hover:scale-110 transition-transform duration-500">{icon}</div>
      <span className="ml-4 hidden md:block italic">{label}</span>

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
    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-chess-active shadow-[0_0_8px_#00ced1] opacity-0 transition-opacity group-[.active]:opacity-100 hidden md:block" />
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
