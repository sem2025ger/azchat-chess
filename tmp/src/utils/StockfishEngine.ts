// Stockfish Engine – Real UCI integration via Web Worker
// Loads Stockfish.js from CDN, communicates over standard UCI protocol.

export interface EngineLine {
  multipv: number;
  evaluation: number;
  mate?: number;
  depth: number;
  pv: string[];
}

export interface EngineResult {
  evaluation: number; // in pawns, + is white advantage
  bestMove: string;
  depth: number;
  mate?: number; // moves to mate if detected
  continuation?: string[]; // array of moves in the main line
  lines?: EngineLine[];
  analyzedFen?: string;
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
  private _lastGoodPv: string[] = [];
  private _lines: Record<number, EngineLine> = {};
  private _lastGoodLines: Record<number, EngineLine> = {};
  private _rootBlackToMove = false;
  private _analyzedFen = '';
  private _queuedAnalysis: { fen?: string; depth: number } | null = null;
  private _stoppingForRestart = false;

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
    if (line === 'uciok') { 
      this.send('setoption name MultiPV value 3');
      this.send('isready'); 
      return; 
    }
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
      if (this._stoppingForRestart) return;
      this.parseInfo(line);
    }

    // Final bestmove
    if (line.startsWith('bestmove') && this._searching) {
      if (this._stoppingForRestart) {
        this._searching = false;
        this._stoppingForRestart = false;
        const queued = this._queuedAnalysis;
        this._queuedAnalysis = null;
        if (queued) this.beginSearch(queued.fen, queued.depth);
        return;
      }
      const m = line.match(/^bestmove\s+(\S+)/);
      const best = m?.[1] || this._pv[0] || '';
      this._searching = false;
      const isUsablePv = (pvArr: string[], mateScore: number | undefined) => pvArr.length > 1 || (mateScore != null && pvArr.length > 0);
      const finalPv = isUsablePv(this._pv, this._mate) ? this._pv : (isUsablePv(this._lastGoodPv, this._mate) ? this._lastGoodPv : this._pv);
      this.onResultCallback?.({
        evaluation: this._eval,
        bestMove: best,
        depth: this._depth,
        mate: this._mate,
        continuation: finalPv.length > 1 ? finalPv.slice(1) : undefined,
        lines: this.getStableLines(),
        analyzedFen: this._analyzedFen,
      });
    }
  }

  private parseInfo(line: string): void {
    if (line.includes(' string ')) return;

    const mpvM = line.match(/\bmultipv\s+(\d+)/);
    const multipv = mpvM ? parseInt(mpvM[1], 10) : 1;
    if (multipv > 3) return;

    const dM = line.match(/\bdepth\s+(\d+)/);
    if (dM && multipv === 1) this._depth = parseInt(dM[1], 10);

    let depth = dM ? parseInt(dM[1], 10) : (this._lines[multipv]?.depth || this._depth);

    let evalCp = this._lines[multipv]?.evaluation || 0;
    let mate: number | undefined = this._lines[multipv]?.mate;

    const cpM = line.match(/\bscore\s+cp\s+(-?\d+)/);
    if (cpM) {
      let rawCp = parseInt(cpM[1], 10) / 100;
      evalCp = this._rootBlackToMove ? -rawCp : rawCp;
      mate = undefined;
    }

    const mtM = line.match(/\bscore\s+mate\s+(-?\d+)/);
    if (mtM) {
      let rawMate = parseInt(mtM[1], 10);
      mate = this._rootBlackToMove ? -rawMate : rawMate;
      evalCp = mate > 0 ? 100 : -100;
    }

    const pvM = line.match(/\bpv\s+(.+)$/);
    let pv = this._lines[multipv]?.pv || [];
    if (pvM) {
      pv = pvM[1].trim().split(/\s+/);
    }

    const isUsablePv = (pvArr: string[], mateScore: number | undefined) => pvArr.length > 1 || (mateScore != null && pvArr.length > 0);

    this._lines[multipv] = { multipv, evaluation: evalCp, mate, depth, pv };
    if (isUsablePv(pv, mate)) {
      this._lastGoodLines[multipv] = { ...this._lines[multipv] };
    }

    if (multipv === 1) {
      if (cpM) { this._eval = evalCp; this._mate = undefined; }
      if (mtM) { this._mate = mate; this._eval = evalCp; }
      if (pvM) {
        this._pv = pv;
        if (isUsablePv(this._pv, this._mate)) {
          this._lastGoodPv = [...this._pv];
        }
      }
    }

    // Emit intermediate results from depth 5+
    if (this._depth >= 5 && this._pv.length > 0 && this._searching) {
      this.onResultCallback?.({
        evaluation: this._eval,
        bestMove: this._pv[0],
        depth: this._depth,
        mate: this._mate,
        continuation: this._pv.length > 1 ? this._pv.slice(1) : undefined,
        lines: this.getStableLines(),
        analyzedFen: this._analyzedFen,
      });
    }
  }

  private getStableLines(): EngineLine[] {
    const out: EngineLine[] = [];
    const isUsableLine = (line?: EngineLine) =>
      !!line && (line.pv.length > 1 || (line.mate != null && line.pv.length > 0));

    for (let i = 1; i <= 3; i++) {
      const line = this._lines[i];
      const goodLine = this._lastGoodLines[i];
      if (isUsableLine(line)) {
        out.push(line!);
      } else if (isUsableLine(goodLine)) {
        out.push(goodLine!);
      }
    }
    return out;
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

    if (this._searching) {
      this._queuedAnalysis = { fen, depth };
      this._stoppingForRestart = true;
      this.send('stop');
      return;
    }

    this.beginSearch(fen, depth);
  }

  private beginSearch(fen?: string, depth = 18): void {
    this._searching = true;
    this._depth = 0;
    this._eval = 0;
    this._mate = undefined;
    this._pv = [];
    this._lastGoodPv = [];
    this._lines = {};
    this._lastGoodLines = {};

    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this._analyzedFen = (!fen || fen === 'startpos') ? START_FEN : fen;
    this._rootBlackToMove = this._analyzedFen.split(' ')[1] === 'b';

    const pos = (!fen || fen === 'startpos') ? 'position startpos' : `position fen ${fen}`;
    this.send(pos);
    this.send(`go depth ${depth}`);
  }

  public stop(): void {
    this._queuedAnalysis = null;
    this._stoppingForRestart = false;
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
