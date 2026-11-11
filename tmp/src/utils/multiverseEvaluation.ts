import { Chess } from 'chess.js';
import { StockfishEngine } from './StockfishEngine.ts';
import { validateAnalysisFen } from './analysisWorkspace.ts';
import type { MultiverseBranch } from './multiverse.ts';

/** Engine score of one position, always from White's perspective. */
export interface MultiverseScore {
  evaluation: number; // pawns, + favours White
  mate?: number; // moves to mate, + White mates, - Black mates, 0 = side to move is mated
  depth: number;
  terminal?: 'checkmate' | 'draw';
}

export type MultiverseScores = Record<string, MultiverseScore>;

/** Mate scores dominate every centipawn score and keep their ordering (#1 > #5). */
export const MULTIVERSE_MATE_VALUE = 100;
export const MULTIVERSE_MISTAKE_THRESHOLD = 1; // pawns lost by the mover

export function multiverseScoreValue(score: MultiverseScore): number {
  if (score.mate === undefined || score.mate === 0) return Math.max(-MULTIVERSE_MATE_VALUE, Math.min(MULTIVERSE_MATE_VALUE, score.evaluation));
  const distance = Math.min(Math.abs(score.mate), 99);
  return Math.sign(score.mate) * (MULTIVERSE_MATE_VALUE - distance);
}

/** Terminal positions never need the engine. */
export function multiverseTerminalScore(fen: string): MultiverseScore | null {
  const game = new Chess(validateAnalysisFen(fen));
  if (game.isCheckmate()) {
    return { evaluation: game.turn() === 'w' ? -MULTIVERSE_MATE_VALUE : MULTIVERSE_MATE_VALUE, depth: 0, terminal: 'checkmate' };
  }
  if (game.isGameOver()) return { evaluation: 0, depth: 0, terminal: 'draw' };
  return null;
}

/** "+0.35", "-1.20", "#3", "#-2"; `forBlack` flips the sign for a Black-perspective display. */
export function formatMultiverseScore(score: MultiverseScore | undefined, forBlack = false): string {
  if (!score) return '…';
  const sign = forBlack ? -1 : 1;
  if (score.terminal === 'draw') return '½-½';
  if (score.terminal === 'checkmate') return score.evaluation * sign > 0 ? '1-0' : '0-1';
  if (score.mate !== undefined && score.mate !== 0) {
    return `#${score.mate * sign}`;
  }
  const value = score.evaluation * sign;
  const text = Math.abs(value).toFixed(2);
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : '0.00';
}

/** Signed difference `next - base` on the comparable scale. */
export function multiverseScoreDelta(base: MultiverseScore, next: MultiverseScore): number {
  return multiverseScoreValue(next) - multiverseScoreValue(base);
}

export function formatMultiverseDelta(delta: number): string {
  const text = Math.abs(delta).toFixed(2);
  return delta > 0 ? `+${text}` : delta < 0 ? `-${text}` : '±0.00';
}

export interface MultiverseCriticalMove {
  ply: number; // 1-based index of the move inside the branch
  san: string;
  mover: 'w' | 'b';
  loss: number; // pawns lost by the mover, > 0
  moveNumber: number;
}

/** Largest evaluation loss by the mover inside one branch; null until both sides of the move are scored. */
export function findMultiverseCriticalMove(branch: MultiverseBranch, scores: MultiverseScores): MultiverseCriticalMove | null {
  let worst: MultiverseCriticalMove | null = null;
  for (let i = 0; i < branch.moves.length; i++) {
    const before = scores[branch.positions[i]];
    const after = scores[branch.positions[i + 1]];
    if (!before || !after) continue;
    const [, turn, , , , fullmove] = branch.positions[i].split(' ');
    const mover = turn === 'b' ? 'b' : 'w';
    const loss = multiverseScoreDelta(before, after) * (mover === 'w' ? -1 : 1);
    if (loss < MULTIVERSE_MISTAKE_THRESHOLD) continue;
    if (!worst || loss > worst.loss) worst = { ply: i + 1, san: branch.moves[i], mover, loss, moveNumber: Number(fullmove) || 1 };
  }
  return worst;
}

export interface MultiverseBranchSummary {
  id: string;
  label: string;
  plies: number;
  finalFen: string;
  score?: MultiverseScore;
  deltaFromRoot?: number;
  critical: MultiverseCriticalMove | null;
  pendingPositions: number;
}

/** Engine-based comparison of saved branches with a shared root. Pure; never mutates branches. */
export function summarizeMultiverseBranches(branches: MultiverseBranch[], scores: MultiverseScores): MultiverseBranchSummary[] {
  return branches.map(branch => {
    const finalFen = branch.positions[branch.positions.length - 1];
    const root = scores[branch.rootFen];
    const score = scores[finalFen];
    return {
      id: branch.id,
      label: branch.label,
      plies: branch.moves.length,
      finalFen,
      score,
      deltaFromRoot: root && score ? multiverseScoreDelta(root, score) : undefined,
      critical: findMultiverseCriticalMove(branch, scores),
      pendingPositions: branch.positions.filter(fen => !scores[fen]).length,
    };
  });
}

/** Positions still needing an engine score, deduplicated, bounded per request. */
export function multiversePositionsToScore(branches: MultiverseBranch[], scores: MultiverseScores, limit = 200): string[] {
  const unique = new Set<string>();
  for (const branch of branches) for (const fen of branch.positions) if (!scores[fen]) unique.add(fen);
  return Array.from(unique).slice(0, limit);
}

/**
 * Own Stockfish worker that scores positions one at a time. Results are
 * matched to the requested FEN and the final bestmove only, so a stale search
 * can never be written to another position.
 */
export class MultiverseEvaluator {
  private engine: StockfishEngine | null = null;
  private queue: string[] = [];
  private current: string | null = null;
  private closed = false;
  private failed = false;
  private readonly known = new Set<string>();
  private readonly depth: number;
  private readonly onScore: (fen: string, score: MultiverseScore) => void;
  private readonly onFailure: () => void;
  private readonly onIdle: () => void;

  constructor(depth: number, onScore: (fen: string, score: MultiverseScore) => void, onFailure: () => void, onIdle: () => void = () => {}) {
    if (!Number.isInteger(depth) || depth < 1 || depth > 30) throw new Error('Invalid evaluation depth');
    this.depth = depth;
    this.onScore = onScore;
    this.onFailure = onFailure;
    this.onIdle = onIdle;
  }

  private ensureEngine(): StockfishEngine {
    if (this.engine) return this.engine;
    const engine = new StockfishEngine();
    engine.onResult(result => {
      if (this.closed || !this.current || !result.final || result.analyzedFen !== this.current) return;
      const fen = this.current;
      this.current = null;
      if (!result.bestMove || result.bestMove === '(none)') {
        // Engine refused the position: do not invent a score, let the UI show it as pending.
        this.known.delete(fen);
      } else {
        this.onScore(fen, { evaluation: result.evaluation, mate: result.mate, depth: result.depth });
      }
      this.next();
    });
    engine.onError(() => { if (!this.closed) { this.failed = true; this.queue = []; this.current = null; this.onFailure(); } });
    this.engine = engine;
    return engine;
  }

  enqueue(fens: string[]): void {
    if (this.closed || this.failed) return;
    for (const fen of fens) {
      if (this.known.has(fen)) continue;
      this.known.add(fen);
      const terminal = multiverseTerminalScore(fen);
      if (terminal) { this.onScore(fen, terminal); continue; }
      this.queue.push(fen);
    }
    this.next();
  }

  isBusy(): boolean { return this.current !== null || this.queue.length > 0; }

  private next(): void {
    if (this.closed || this.failed || this.current) return;
    const fen = this.queue.shift();
    if (!fen) { this.onIdle(); return; }
    this.current = fen;
    this.ensureEngine().analyze(fen, this.depth, 1);
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.queue = [];
    this.current = null;
    this.engine?.destroy();
    this.engine = null;
  }
}
