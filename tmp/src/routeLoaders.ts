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
  clubsNrw: cacheImport(() => import('./screens/ClubsNRWScreen')),
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

  const queue = ['/game', '/play', '/profile', '/settings', '/chat']
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
      if (next) void destinations[next]().catch(() => {}).then(schedule);
    };
    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(run);
    } else {
      timer = setTimeout(run, 800);
    }
  };
  schedule();

  return () => {
    cancelled = true;
    if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
