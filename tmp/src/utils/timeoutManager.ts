/**
 * Safe, leak-free timer manager for tracking and clearing timeouts in React components.
 */
export interface TimeoutManager {
  set(key: string, callback: () => void, delayMs: number): void;
  clear(key: string): void;
  clearAll(): void;
  has(key: string): boolean;
}

export function createTimeoutManager(): TimeoutManager {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    set(key: string, callback: () => void, delayMs: number): void {
      const existing = timers.get(key);
      if (existing !== undefined) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        timers.delete(key);
        callback();
      }, delayMs);

      timers.set(key, timer);
    },

    clear(key: string): void {
      const existing = timers.get(key);
      if (existing !== undefined) {
        clearTimeout(existing);
        timers.delete(key);
      }
    },

    clearAll(): void {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },

    has(key: string): boolean {
      return timers.has(key);
    },
  };
}
