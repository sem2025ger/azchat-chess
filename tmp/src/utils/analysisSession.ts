import { Chess, DEFAULT_POSITION } from 'chess.js';
import { analysisFromMoves } from './analysisWorkspace.ts';

export const ANALYSIS_SESSION_KEY = 'chess_analysis_session_v1';
type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>;
interface SavedSession {
  version: 1;
  moves: string[];
  initialFen?: string;
  viewMoveIndex: number;
}

let memorySession: SavedSession | null = null;

function browserStorage(): SessionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function emptyAnalysisSession() {
  const game = new Chess();
  return { game, positionHistory: [game.fen()], moveHistory: [] as string[], viewMoveIndex: -1 };
}

export function loadAnalysisSession(storage = browserStorage()) {
  let saved: unknown = memorySession;
  try {
    if (storage) {
      const raw = storage.getItem(ANALYSIS_SESSION_KEY);
      if (raw) {
        try {
          saved = JSON.parse(raw);
        } catch {
          return emptyAnalysisSession();
        }
      } else {
        saved = null;
      }
    }
  } catch {
    // Storage may be unavailable; keep navigation working with the in-memory copy.
  }
  if (!saved || typeof saved !== 'object') return emptyAnalysisSession();
  const candidate = saved as Partial<SavedSession>;
  if (candidate.version !== 1 || !Array.isArray(candidate.moves) ||
      candidate.moves.length > 2048 ||
      !candidate.moves.every(move => typeof move === 'string' && move.length <= 16)) {
    return emptyAnalysisSession();
  }

  let session;
  try {
    if (candidate.initialFen !== undefined && typeof candidate.initialFen !== 'string') return emptyAnalysisSession();
    session = analysisFromMoves(candidate.moves, candidate.initialFen || DEFAULT_POSITION);
  } catch {
    return emptyAnalysisSession();
  }
  const index = candidate.viewMoveIndex;
  session.viewMoveIndex = typeof index === 'number' && Number.isInteger(index) &&
    index >= 0 && index < session.positionHistory.length ? index : -1;
  return session;
}

export function saveAnalysisSession(
  moves: string[],
  viewMoveIndex: number,
  storage = browserStorage(),
  initialFen = DEFAULT_POSITION,
) {
  memorySession = { version: 1, moves: [...moves], viewMoveIndex, initialFen };
  try {
    storage?.setItem(ANALYSIS_SESSION_KEY, JSON.stringify(memorySession));
  } catch {
    // Quota or privacy restrictions must not interrupt a move or route change.
  }
}
