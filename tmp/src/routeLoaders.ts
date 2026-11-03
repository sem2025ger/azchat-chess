import { primeAnalysisEngine } from './utils/analysisEngineSession';

function cacheImport<T>(load: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= load().catch(error => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}

// React.lazy and navigation prefetch share the same in-flight import.
export const routeLoaders = {
  home: cacheImport(() => import('./screens/HomeScreen')),
  play: cacheImport(() => import('./screens/PlayRoute')),
  game: cacheImport(() => import('./screens/GameRoute')),
  chat: cacheImport(() => import('./screens/ChatScreen')),
  profile: cacheImport(() => import('./screens/ProfileScreen')),
  settings: cacheImport(() => import('./screens/SettingsScreen')),
  updatePassword: cacheImport(() => import('./screens/UpdatePasswordScreen')),
  regionNw: cacheImport(() => import('./screens/RegionOverview')),
  clubsNrw: cacheImport(() => import('./screens/ClubsNRWScreen')),
  spieltag: cacheImport(() => import('./screens/SpieltagScreen')),
  spieler: cacheImport(() => import('./screens/SpielerScreen')),
  vorbereitung: cacheImport(() => import('./screens/VorbereitungScreen')),
};

const destinations: Record<string, () => Promise<unknown>> = {
  '/': routeLoaders.home,
  '/home': routeLoaders.home,
  '/play': routeLoaders.play,
  '/game': routeLoaders.game,
  '/chat': routeLoaders.chat,
  '/profile': routeLoaders.profile,
  '/settings': routeLoaders.settings,
  '/clubs-nrw': routeLoaders.clubsNrw,
  '/region/nrw': routeLoaders.regionNw,
  '/spieltag': routeLoaders.spieltag,
  '/spieler': routeLoaders.spieler,
  '/vorbereitung': routeLoaders.vorbereitung,
};

export function prefetchRoute(path: string) {
  // Failed speculative requests must not produce unhandled rejections.
  void destinations[path.split(/[?#]/, 1)[0]]?.().catch(() => {});
}

export function scheduleNavigationPreload(currentPath: string) {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  // Keep background work off analysis/live play and constrained connections.
  if (currentPath === '/game' || currentPath === '/play' || connection?.saveData ||
      (connection?.effectiveType && connection.effectiveType !== '4g')) {
    return () => {};
  }

  const queue = ['/game', '/play', '/profile', '/settings', '/chat', '/spieler', '/spieltag', '/region/nrw']
    .filter(path => path !== currentPath);
  let cancelled = false;
  let idleHandle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (cancelled || queue.length === 0 || document.hidden) return;
    const run = () => {
      idleHandle = undefined;
      timer = undefined;
      if (cancelled || document.hidden) return;
      const next = queue.shift();
      if (!next) return;
      void destinations[next]().catch(() => {}).then(() => {
        if (cancelled) return;
        // Finish parsing the Analysis route before warming its separate UCI worker.
        // Staggering these cold starts avoids competing during the first navigation.
        if (next === '/game' && (currentPath === '/' || currentPath === '/home') &&
            window.matchMedia('(min-width: 1024px)').matches) {
          const warm = () => {
            idleHandle = undefined;
            timer = undefined;
            if (!cancelled && !document.hidden) primeAnalysisEngine();
            schedule();
          };
          if ('requestIdleCallback' in window) {
            idleHandle = window.requestIdleCallback(warm, { timeout: 1800 });
          } else {
            timer = setTimeout(warm, 250);
          }
        } else {
          schedule();
        }
      });
    };
    if ('requestIdleCallback' in window) {
      // Home must paint first; avoid indefinite postponement on animated pages.
      idleHandle = window.requestIdleCallback(run, queue[0] === '/game' ? { timeout: 1600 } : undefined);
    } else {
      timer = setTimeout(run, queue[0] === '/game' ? 350 : 800);
    }
  };
  schedule();

  return () => {
    cancelled = true;
    if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
