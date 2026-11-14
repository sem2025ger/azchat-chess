import { replayMultiverseBranch, type MultiverseBranch } from './multiverse.ts';

const KEY = 'chessaz.multiverse.branches.v1';
export function loadMultiverseBranches(storage: Pick<Storage, 'getItem'>): MultiverseBranch[] {
  try {
    const raw = storage.getItem(KEY);
    if (!raw || raw.length > 200_000) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const result: MultiverseBranch[] = [];
    for (const candidate of data.slice(-20)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const b = candidate as MultiverseBranch;
      if (typeof b.id !== 'string' || b.id.length > 100 || typeof b.label !== 'string' || b.label.length > 120 ||
        typeof b.rootFen !== 'string' || !Array.isArray(b.moves) || !Array.isArray(b.positions)) continue;
      try { replayMultiverseBranch(b); result.push(b); } catch { /* Ignore corrupted stored branches. */ }
    }
    return result;
  } catch { return []; }
}
export function saveMultiverseBranches(branches: MultiverseBranch[], storage: Pick<Storage, 'setItem'>): void {
  try { storage.setItem(KEY, JSON.stringify(branches.slice(-20))); } catch { /* Storage is optional. */ }
}
