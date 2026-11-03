import { StockfishEngine } from './StockfishEngine';

// One idle browser worker may be reused across analysis navigation.
// Never search in the background or prewarm on low-bandwidth/mobile connections.
const CACHE_MS = 30_000;
let cached: StockfishEngine | null = null;
let active: StockfishEngine | null = null;
let expiry: ReturnType<typeof setTimeout> | null = null;

function cancelExpiry() {
  if (expiry !== null) clearTimeout(expiry);
  expiry = null;
}

function keepBriefly(engine: StockfishEngine) {
  cancelExpiry();
  cached = engine;
  expiry = setTimeout(() => {
    if (cached === engine) {
      cached = null;
      engine.destroy();
    }
    expiry = null;
  }, CACHE_MS);
}

export function primeAnalysisEngine(): void {
  if (active || cached || typeof window === 'undefined' ||
      typeof Worker === 'undefined' || !window.matchMedia('(min-width: 1024px)').matches ||
      document.hidden) return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  try {
    keepBriefly(new StockfishEngine()); // UCI handshake only; no CPU-heavy search.
  } catch { /* Navigation still works via the normal cold start. */ }
}

export function acquireAnalysisEngine(): StockfishEngine {
  cancelExpiry();
  if (active) return active;
  let engine = cached;
  cached = null;
  if (engine?.hasFailed()) {
    engine.destroy();
    engine = null;
  }
  active = engine ?? new StockfishEngine();
  return active;
}

export function releaseAnalysisEngine(engine: StockfishEngine): void {
  if (active !== engine) return;
  active = null;
  engine.stop();
  // Prevent state updates in the unmounted React screen.
  engine.onResult(() => {});
  engine.onError(() => {});
  if (engine.hasFailed()) {
    engine.destroy();
    return;
  }
  if (cached && cached !== engine) cached.destroy();
  keepBriefly(engine);
}
