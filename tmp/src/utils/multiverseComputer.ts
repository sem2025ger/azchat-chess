import { Chess } from 'chess.js';
import { StockfishEngine } from './StockfishEngine';
import { appendMultiverseMove, createMultiverseBranch, type MultiverseBranch } from './multiverse';

/** Own worker: never shares analysis-engine callbacks or UCI searches. */
export class MultiverseComputerSession {
  private engine: StockfishEngine;
  private branch: MultiverseBranch;
  private human: 'w' | 'b';
  private depth: number;
  private pending = false;
  private closed = false;
  private onChange: (branch: MultiverseBranch) => void;
  private onFailure: () => void;
  private failed = false;

  constructor(fen: string, human: 'w' | 'b', depth: number, onChange: (branch: MultiverseBranch) => void, onFailure: () => void) {
    if (!Number.isInteger(depth) || depth < 1 || depth > 20) throw new Error('Invalid computer level');
    this.branch = createMultiverseBranch(fen, 'Computer practice', 'computer');
    if (new Chess(this.branch.rootFen).isGameOver()) throw new Error('Position is already finished');
    this.human = human;
    this.depth = depth;
    this.onChange = onChange;
    this.onFailure = onFailure;
    this.engine = new StockfishEngine();
    this.engine.onResult(result => {
      if (this.closed || !this.pending || result.analyzedFen !== this.currentFen() || !result.final) return;
      this.pending = false;
      try {
        this.branch = appendMultiverseMove(this.branch, result.bestMove);
        this.onChange(this.branch);
      } catch { this.failed = true; this.onFailure(); }
    });
    this.engine.onError(() => { if (!this.closed) { this.pending = false; this.failed = true; this.onFailure(); } });
    this.nextComputerMove();
  }

  private currentFen(): string { return this.branch.positions[this.branch.positions.length - 1]; }
  private nextComputerMove(): void {
    if (this.closed || this.failed) return;
    const game = new Chess(this.currentFen());
    if (game.isGameOver() || game.turn() === this.human) return;
    this.pending = true;
    this.engine.analyze(game.fen(), this.depth, 1);
  }

  move(uci: string): boolean {
    if (this.closed || this.pending || this.failed) return false;
    const game = new Chess(this.currentFen());
    if (game.isGameOver() || game.turn() !== this.human) return false;
    try {
      this.branch = appendMultiverseMove(this.branch, uci);
      this.onChange(this.branch);
      this.nextComputerMove();
      return true;
    } catch { return false; }
  }

  getBranch(): MultiverseBranch { return this.branch; }
  isComputerThinking(): boolean { return this.pending; }
  stop(): void {
    if (this.closed) return;
    this.closed = true;
    this.pending = false;
    this.engine.destroy();
  }
}
