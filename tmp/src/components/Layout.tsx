import { useDesktop } from './schachTreff/useDesktop';
import { Suspense, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import nightEarthAnimation from '../assets/night-earth-rotation.mp4';
import nightEarthStill from '../assets/night-earth-still.webp';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Grid, MessageSquare, User, Settings, Circle, MapPin } from 'lucide-react';
import { premiumInterfaceThemes } from '../lib/interfaceThemes';
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
  ru: 'bg-bl¶»§q«^