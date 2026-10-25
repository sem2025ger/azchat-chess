import { useSyncExternalStore } from 'react';
export const desktopQuery = '(min-width: 1024px)';
function subscribe(callback: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
export function useDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(desktopQuery).matches, () => false);
}
