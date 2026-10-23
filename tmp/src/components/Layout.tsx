import { Suspense, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import nightEarthAnimation from '../assets/night-earth-rotation.mp4';
import nightEarthStill from '../assets/night-earth-still.webp';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Grid, MessageSquare, User, Settings, Circle } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { type Language } from '../translations';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import RouteLoadingFallback from './RouteLoadingFallback';
import { prefetchRoute, scheduleNavigationPreload } from '../routeLoaders';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const languageActiveClass: Record<Language, string> = {
  en: 'bg-slate-200/85 text-red-700 ring-1 ring-red-500/80 shadow-md shadow-red-500/20',
  de: 'bg-neutral-950/95 text-amber-300 ring-1 ring-red-600/80 shadow-md shadow-amber-500/20',
  az: 'bg-emerald-950/95 text-emerald-100 ring-1 ring-sky-500/80 shadow-md shadow-red-500/15',
  tr: 'bg-red-700/95 text-white ring-1 ring-red-300/80 shadow-md shadow-red-600/25',
  ua: 'bg-blue-700/95 text-yellow-200 ring-1 ring-yellow-400/80 shadow-md shadow-blue-500/25',
  ru: 'bg-blue-950/95 text-white ring-1 ring-red-500/75 shadow-md shadow-blue-500/20',
};

export default function Layout() {
  const location = useLocation();
  const routeScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => scheduleNavigationPreload(location.pathname), [location.pathname]);
  // The scroll container stays mounted across routes. Do not preserve the Analysis
  // scroll offset when the user returns to the mobile Home screen.
  useLayoutEffect(() => {
    // The route scroll owner is persistent; reset before paint, for every mobile tab.
    // The viewport/body may also have retained an old offset on shorter screens.
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    if (routeScrollRef.current) routeScrollRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const isDesktopAnalysisRoute = location.pathname === '/game';
  const needsConstrainedScroll =
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/settings');
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
    <div className={cx(
      needsConstrainedScroll ? "h-[100dvh] overflow-hidden" : "min-h-screen max-md:h-[100dvh] max-md:min-h-0 max-md:overflow-hidden",
      isDesktopAnalysisRoute && "lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden",
      "w-full flex selection:bg-chess-gold/30 selection:text-white",
      currentBgClass
    )} data-analysis-route={isDesktopAnalysisRoute || undefined}>

      {/* Premium Sidebar Navigation - Hidden on Mobile */}
      <aside className="hidden md:flex w-20 xl:w-72 bg-[#11110f]/95 border-r border-white/[0.05] flex-col justify-between shrink-0 relative z-50 transition-all duration-500 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">

          <div className="h-16 xl:h-auto xl:py-3 flex items-center justify-center xl:justify-start px-2 xl:px-6 border-b border-white/[0.03] shrink-0 bg-white/[0.01]">
            <div className="flex flex-col overflow-hidden xl:overflow-visible justify-center w-full items-center xl:items-start">
              <span className="font-black text-[0.55rem] md:text-[0.6rem] xl:text-[1.875rem] xl:leading-[1.8rem] tracking-tighter italic leading-none text-glow-cycle w-full text-center xl:text-left transition-all duration-500 xl:motion-reduce:transition-none">
                Chessaz.De
              </span>
              <div
                role="img"
                aria-label="Germany • Azerbaijan"
                title="Germany • Azerbaijan"
                className="mt-6 hidden xl:flex items-center justify-center gap-2 w-fit xl:ml-[4px] min-h-[52px] xl:-translate-x-[2px] px-2 py-[6px] rounded-full border border-transparent bg-[linear-gradient(120deg,#20242D_0%,#0B0F14_42%,#111827_76%,#161C27_100%),linear-gradient(135deg,rgba(220,196,151,0.56)_0%,rgba(231,232,234,0.38)_46%,rgba(126,133,147,0.4)_100%)] [background-origin:border-box] [background-clip:padding-box,border-box] shadow-[0_8px_18px_-10px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(245,238,222,0.07),inset_0_-1px_0_rgba(120,141,173,0.06)] select-none pointer-events-none shrink-0"
              >
                <SidebarGermanyFlag />
                <NightEarthGlobe />
                <SidebarAzerbaijanFlag />
              </div>
            </div>
          </div>

          <nav className="px-3 xl:px-5 pt-10 xl:pt-9 pb-4 space-y-1 flex-1">
            <NavItem to="/home" icon={<Home size={20} />} label={t('nav.home')} themeColor="theme-premium" alwaysGlow />
            <NavItem to="/game" icon={<Grid size={20} />} label={t('nav.game')} themeColor="theme-emerald" />
            <NavItem to="/chat" icon={<MessageSquare size={20} />} label={t('nav.chat')} themeColor="theme-violet" />
            <NavItem to="/profile" icon={<User size={20} />} label={t('nav.profile')} themeColor="theme-blue" />
          </nav>
        </div>

        <div className="p-2 xl:p-5 space-y-3 border-t border-white/[0.05] bg-black/40 shadow-inner shrink-0">

          {/* Refined Language Selector - AZ / TR / RU ONLY */}
          <div className="flex flex-col gap-3">
            <div className="hidden xl:flex bg-neutral-900/70 p-0.5 rounded-lg border border-white/10 shadow-[0_0_18px_rgba(34,211,238,0.14)] premium-cycle-container transition-all">
              {(['en', 'de', 'az', 'tr', 'ua', 'ru'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cx(
                    "flex-1 py-1 text-[0.6rem] font-black uppercase rounded-md transition-colors transition-shadow duration-300 active:scale-95 sidebar-item",
                    language === lang ? languageActiveClass[lang] : "text-neutral-600 sidebar-item-hover"
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
            <NavItem to="/settings" icon={<Settings size={24} />} label={t('nav.settings')} themeColor="theme-gold" alwaysGlow />
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - Visible only on Small Screens */}
      <nav data-mobile-app-nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#11110f]/97 border-t border-white/[0.05] flex items-center justify-around px-1 z-50 pb-safe pt-1.5 h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <MobileNavItem to="/home" icon={<Home size={20} />} label={t('nav.home')} premiumHome />
        <MobileNavItem to="/game" icon={<Grid size={20} />} label={t('nav.game')} accent="analysis" />
        <MobileNavItem to="/chat" icon={<MessageSquare size={20} />} label={t('nav.chat')} accent="chat" />
        <MobileNavItem to="/profile" icon={<User size={20} />} label={t('nav.profile')} accent="profile" />
        <MobileNavItem to="/settings" icon={<Settings size={20} />} label={t('nav.settings')} accent="settings" />
      </nav>

      {/* Main Content Area */}
      <main className={cx(
        "flex-1 flex flex-col relative overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 max-md:min-h-0",
        needsConstrainedScroll && "min-h-0",
        isDesktopAnalysisRoute && "lg:min-h-0"
      )}>
        <div ref={routeScrollRef} className={cx(
          "flex-1 min-h-0 overflow-y-auto relative z-10 custom-scrollbar flex flex-col max-md:overflow-anchor-none",
          needsConstrainedScroll ? "overscroll-y-contain touch-pan-y min-h-0" : "overscroll-none",
          isDesktopAnalysisRoute && "lg:overflow-hidden lg:min-h-0"
        )}>
          <Suspense key={location.pathname} fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

    </div>
  );
}

function NavItem({ to, icon, label, themeColor = 'theme-cyan', alwaysGlow = false }: { to: string, icon: React.ReactNode, label: string, themeColor?: string, alwaysGlow?: boolean }) {
  const { pathname } = useLocation();
  const destination = to === '/home' && pathname === '/' ? '/' : to;
  return (
    <NavLink
      to={destination}
      onPointerEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      onPointerDown={() => prefetchRoute(to)}
      className={({ isActive }) =>
        cx(
          "site-nav-link flex items-center px-4 py-[1.125rem] border border-transparent rounded-2xl font-black text-[0.85rem] uppercase tracking-wider relative group active:scale-95 sidebar-item",
          isActive
            ? `sidebar-item-active ${themeColor}`
            : cx("text-neutral-500 sidebar-item-hover", alwaysGlow && themeColor)
        )
      }
    >
      <div className="w-8 flex justify-center shrink-0 group-hover:scale-110 transition-transform duration-150 motion-reduce:transition-none">{icon}</div>
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

const mobileActiveAccent = {
  analysis: 'text-[#A8DED0] bg-[linear-gradient(150deg,rgba(61,130,116,.24),rgba(16,27,28,.88))] ring-1 ring-[#6CB7A4]/40 shadow-[inset_0_1px_0_rgba(195,245,230,.12)]',
  chat: 'text-[#D7C1F0] bg-[linear-gradient(150deg,rgba(116,89,150,.24),rgba(24,21,33,.88))] ring-1 ring-[#AC91CF]/40 shadow-[inset_0_1px_0_rgba(240,215,255,.10)]',
  profile: 'text-[#B6CCEF] bg-[linear-gradient(150deg,rgba(74,109,165,.23),rgba(16,24,35,.9))] ring-1 ring-[#8BA8D5]/40 shadow-[inset_0_1px_0_rgba(215,230,255,.10)]',
  settings: 'text-[#EACB9F] bg-[linear-gradient(150deg,rgba(145,107,69,.22),rgba(30,23,19,.9))] ring-1 ring-[#C6A174]/40 shadow-[inset_0_1px_0_rgba(255,227,191,.11)]',
} as const;

function MobileNavItem({ to, icon, label, premiumHome = false, accent }: { to: string, icon: React.ReactNode, label: string, premiumHome?: boolean, accent?: keyof typeof mobileActiveAccent }) {
  const { pathname } = useLocation();
  const destination = to === '/home' && pathname === '/' ? '/' : to;

  return (
    <NavLink
      to={destination}
      onPointerEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      onPointerDown={() => prefetchRoute(to)}
      className={({ isActive }) =>
        cx(
          "site-nav-link flex flex-col items-center justify-center flex-1 min-w-0 h-full gap-1 rounded-xl transition-[color,background-color,border-color,box-shadow,opacity] duration-150 active:opacity-80 motion-reduce:transition-none",
          premiumHome
            ? (isActive
                ? "text-[#F6DCAC] scale-110 rounded-xl bg-[linear-gradient(145deg,rgba(223,176,98,0.15),rgba(25,22,24,0.88)_60%,rgba(167,139,250,0.09))] ring-1 ring-[#CDA35A]/40 shadow-[inset_0_1px_0_rgba(255,235,183,0.1),0_0_12px_rgba(223,176,98,0.12)]"
                : "text-neutral-500 hover:text-neutral-300")
            : (isActive ? (accent ? mobileActiveAccent[accent] : "text-chess-active") : "text-neutral-500 hover:text-neutral-300")
        )
      }
    >
      <div className="relative">
        {icon}
        <Circle size={4} className="absolute -top-1 -right-1 opacity-0 group-[.active]:opacity-100 text-current fill-current" />
      </div>
      <span className="text-[0.5rem] font-black uppercase tracking-widest">{label}</span>
    </NavLink>
  );
}

function SidebarGermanyFlag() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="42"
      height="28"
      viewBox="0 0 5 3"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="w-[42px] h-7 rounded-[6px] shrink-0 ring-1 ring-[#F4DC9C]/[0.26] shadow-[0_4px_10px_rgba(0,0,0,0.75)]"
    >
      <rect width="5" height="3" y="0" x="0" fill="#0B0C10" />
      <rect width="5" height="2" y="1" x="0" fill="#D00" />
      <rect width="5" height="1" y="2" x="0" fill="#FFCE00" />
    </svg>
  );
}

function SidebarAzerbaijanFlag() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="42"
      height="28"
      viewBox="150 0 900 600"
      aria-hidden="true"
      className="w-[42px] h-7 rounded-[6px] shrink-0 ring-1 ring-[#F4DC9C]/[0.26] shadow-[0_4px_10px_rgba(0,0,0,0.75)]"
    >
      <rect width="1200" height="200" fill="#00b5e2" />
      <rect width="1200" height="200" y="200" fill="#ef3340" />
      <rect width="1200" height="200" y="400" fill="#509e2f" />
      <circle cx="560" cy="300" r="75" fill="#fff" />
      <circle cx="585" cy="300" r="60" fill="#ef3340" />
      <path
        fill="#fff"
        d="M660,260 L665,285 L690,280 L675,300 L690,320 L665,315 L660,340 L650,315 L625,320 L640,300 L625,280 L650,285 Z"
      />
    </svg>
  );
}

const globeMotionQuery = '(min-width: 1280px) and (prefers-reduced-motion: no-preference)';

function subscribeToGlobeVisibility(update: () => void) {
  const media = window.matchMedia(globeMotionQuery);
  media.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  return () => {
    media.removeEventListener('change', update);
    document.removeEventListener('visibilitychange', update);
  };
}

function NightEarthGlobe() {
  const animate = useSyncExternalStore(
    subscribeToGlobeVisibility,
    () => window.matchMedia(globeMotionQuery).matches && !document.hidden,
    () => false
  );
  // NASA/NOAA Black Marble night-time imagery; the existing rotating video remains unchanged.
  // Tiny, staggered amber glints suggest city lights without obscuring the globe.
  const cityLights = [
    { left: '29%', top: '39%', size: 2.3, delay: '-0.4s', duration: '4.4s' },
    { left: '39%', top: '34%', size: 1.6, delay: '-2.2s', duration: '5.1s' },
    { left: '52%', top: '44%', size: 2.1, delay: '-1.5s', duration: '4.7s' },
    { left: '66%', top: '39%', size: 1.6, delay: '-3.1s', duration: '5.6s' },
    { left: '36%', top: '58%', size: 1.7, delay: '-2.7s', duration: '5.3s' },
    { left: '58%', top: '61%', size: 2.2, delay: '-0.9s', duration: '4.9s' },
    { left: '47%', top: '70%', size: 1.6, delay: '-3.4s', duration: '5.8s' },
  ] as const;

  return (
    <span aria-hidden="true" className="relative flex h-[50px] w-[50px] shrink-0 translate-y-[2px] items-center justify-center">
      <span className="pointer-events-none absolute -inset-[5px] rounded-full bg-[radial-gradient(circle,rgba(158,141,108,0.10)_12%,rgba(71,100,118,0.035)_60%,transparent_76%)] blur-[3px]" />
      <span className="relative block h-[50px] w-[50px] overflow-hidden rounded-full ring-1 ring-[#B9A98C]/20 shadow-[0_0_11px_rgba(124,116,108,0.18)]">
        {animate ? (
          <video
            src={nightEarthAnimation}
            poster={nightEarthStill}
            autoPlay muted loop playsInline
            width="50" height="50"
            className="h-full w-full object-cover [filter:brightness(1.27)_contrast(1.15)_saturate(1.05)]"
          />
        ) : (
          <img
            src={nightEarthStill}
            alt=""
            width="50" height="50"
            className="h-full w-full object-cover [filter:brightness(1.27)_contrast(1.15)_saturate(1.05)]"
          />
        )}
        <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_34%,rgba(191,174,141,0.045),transparent_65%)]" />
        {animate && cityLights.map((light, index) => (
          <span
            key={index}
            className="pointer-events-none absolute z-10 rounded-full bg-[#DCA959]/50 shadow-[0_0_4px_1px_rgba(245,183,86,0.5)]"
            style={{ left: light.left, top: light.top, width: light.size, height: light.size }}
          >
            <span
              className="absolute inset-0 rounded-full bg-[#FFE5AD] shadow-[0_0_5px_1px_rgba(255,202,116,0.7)] animate-ping"
              style={{ animationDelay: light.delay, animationDuration: light.duration }}
            />
          </span>
        ))}
      </span>
    </span>
  );
}
