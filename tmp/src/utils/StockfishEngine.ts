// Stockfish Engine – Real UCI integration via Web Worker
// Loads Stockfish.js from CDN, communicates over standard UCI protocol.

export interface EngineResult {
  evaluation: number; // in pawns, + is white advantage
  bestMove: string;
  depth: number;
  mate?: number; // moves to mate if detected
  continuation?: string[]; // array of moves in the main line
}

export type MoveQuality = 'best' | 'excellent' | 'good' | 'inaccurate' | 'mistake' | 'blunder' | 'book';

const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

export class StockfishEngine {
  private _worker: Worker | null = null;
  private onResultCallback: ((result: EngineResult) => void) | null = null;
  private onErrorCallback: (() => void) | null = null;
  private ready: boolean = false;
  private _initFailed: boolean = false;
  private _searching: boolean = false;
  private _pending: { fen: string; depth: number } | null = null;
  private _initTimer: ReturnType<typeof setTimeout> | null = null;

  // Accumulated UCI info state
  private _depth = 0;
  private _eval = 0;
  private _mate: number | undefined = undefined;
  private _pv: string[] = [];

  constructor() {
    this.initWorker();
  }

  /* ------------------------------------------------------------------ */
  /*  Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  private initWorker(): void {
    try {
      console.log('Engine: Creating Stockfish worker…');
      const script = `importScripts('${STOCKFISH_CDN}');`;
      const blob = new Blob([script], { type: 'application/javascript' });
      this._worker = new Worker(URL.createObjectURL(blob));
      this._worker.onmessage = (e: MessageEvent) => this.onUCI(String(e.data));
      this._worker.onerror = (err) => {
        console.error('Engine worker error:', err);
        this.markFailed();
      };
      this.send('uci');

      // Timeout: if engine is not ready within 15s, mark as failed
      this._initTimer = setTimeout(() => {
        if (!this.ready) this.markFailed();
      }, 15_000);
    } catch (err) {
      console.error('Engine: Init failed:', err);
      this.markFailed();
    }
  }

  private markFailed(): void {
    if (this._initFailed) return;
    this._initFailed = true;
    this.ready = false;
    this._pending = null;
    console.error('Engine: Stockfish failed to initialize');
    this.onErrorCallback?.();
  }

  /* ------------------------------------------------------------------ */
  /*  UCI message handling                                               */
  /* ------------------------------------------------------------------ */

  private send(cmd: string): void {
    this._worker?.postMessage(cmd);
  }

  private onUCI(line: string): void {
    // Handshake
    if (line === 'uciok') { this.send('isready'); return; }
    if (line === 'readyok') {
      this.ready = true;
      this._initFailed = false;
      if (this._initTimer) { clearTimeout(this._initTimer); this._initTimer = null; }
      console.log('Engine: UCI ready');
      if (this._pending) {
        const { fen, depth } = this._pending;
        this._pending = null;
        this.analyze(fen, depth);
      }
      return;
    }

    // Search info lines
    if (line.startsWith('info') && line.includes('depth') && this._searching) {
      this.parseInfo(line);
    }

    // Final bestmove
    if (line.startsWith('bestmove') && this._searching) {
      const m = line.match(/^bestmove\s+(\S+)/);
      const best = m?.[1] || this._pv[0] || '';
      this._searching = false;
      this.onResultCallback?.({
        evaluation: this._eval,
        bestMove: best,
        depth: this._depth,
        mate: this._mate,
        continuation: this._pv.length > 1 ? this._pv.slice(1) : undefined,
      });
    }
  }

  private parseInfo(line: string): void {
    if (line.includes(' string ') || /\bmultipv\s+[2-9]/.test(line)) return;

    const dM = line.match(/\bdepth\s+(\d+)/);
    if (dM) this._depth = parseInt(dM[1], 10);

    const cpM = line.match(/\bscore\s+cp\s+(-?\d+)/);
    if (cpM) { this._eval = parseInt(cpM[1], 10) / 100; this._mate = undefined; }

    const mtM = line.match(/\bscore\s+mate\s+(-?\d+)/);
    if (mtM) { this._mate = parseInt(mtM[1], 10); this._eval = this._mate > 0 ? 100 : -100; }

    const pvM = line.match(/\bpv\s+(.+)$/);
    if (pvM) this._pv = pvM[1].trim().split(/\s+/);

    // Emit intermediate results from depth 8+
    if (this._depth >= 8 && this._pv.length > 0 && this._searching) {
      this.onResultCallback?.({
        evaluation: this._eval,
        bestMove: this._pv[0],
        depth: this._depth,
        mate: this._mate,
        continuation: this._pv.length > 1 ? this._pv.slice(1) : undefined,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API  (same contract as before)                              */
  /* ------------------------------------------------------------------ */

  public onResult(callback: (result: EngineResult) => void): void {
    this.onResultCallback = callback;
  }

  public onError(callback: () => void): void {
    this.onErrorCallback = callback;
  }

  public analyze(fen: string, depth: number = 18): void {
    if (!this._worker) return;
    if (!this.ready) { this._pending = { fen, depth }; return; }

    this._searching = true;
    this._depth = 0;
    this._eval = 0;
    this._mate = undefined;
    this._pv = [];

    const pos = (!fen || fen === 'startpos') ? 'position startpos' : `position fen ${fen}`;
    this.send(pos);
    this.send(`go depth ${depth}`);
  }

  public stop(): void {
    if (this._searching) { this._searching = false; this.send('stop'); }
  }

  public destroy(): void {
    this.stop();
    if (this._initTimer) { clearTimeout(this._initTimer); this._initTimer = null; }
    this._worker?.terminate();
    this._worker = null;
    this.ready = false;
  }

  public isReady(): boolean {
    return this.ready;
  }

  public hasFailed(): boolean {
    return this._initFailed;
  }
}
