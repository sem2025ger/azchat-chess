// Exercise the built Stockfish 19 JS+WASM in a real Chromium Web Worker.
// QA-only: serves dist/ on localhost; no application backend, credentials or production access.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Chess } from 'chess.js';
import { transpileModule, ScriptTarget, ModuleKind } from 'typescript';

const dist = resolve('dist');
const workerJs = join(dist, 'stockfish-19-lite-single.js');
const workerWasm = join(dist, 'stockfish-19-lite-single.wasm');
assert.ok(existsSync(workerJs) && existsSync(workerWasm),
  'Run npm run build before the browser engine smoke test');
// Exercise the actual application parser/scheduler as well as the raw UCI worker.
const integrationModule = transpileModule(await readFile(resolve('src/utils/StockfishEngine.ts'), 'utf8'), {
  compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 }
}).outputText;

function browserFixture() {
  window.__chessazSmoke = (async () => {
    const engine = new Worker('/stockfish-19-lite-single.js');
    const output = [];
    const listeners = new Set();
    let failed = null;
    engine.onmessage = event => {
      for (const line of String(event.data).split(/\r?\n/)) {
        if (line) output.push(line);
      }
      for (const listener of listeners) listener();
    };
    engine.onerror = event => {
      failed = String(event.message || 'Stockfish Worker failed to load or execute');
      for (const listener of listeners) listener();
    };
    const send = command => engine.postMessage(command);
    function until(start, predicate, label, timeoutMs = 30000) {
      return new Promise((resolve, reject) => {
        let timer;
        function check() {
          if (failed) { cleanup(); reject(new Error(failed)); return; }
          const match = output.slice(start).find(predicate);
          if (match) { cleanup(); resolve(match); }
        }
        function cleanup() { clearTimeout(timer); listeners.delete(check); }
        timer = setTimeout(() => {
          cleanup();
          reject(new Error('Timed out waiting for ' + label + ': ' + output.slice(-8).join(' | ')));
        }, timeoutMs);
        listeners.add(check);
        check();
      });
    }
    async function commandAndWait(command, predicate, label) {
      const cursor = output.length;
      send(command);
      return until(cursor, predicate, label);
    }
    async function search(label, fen, depth) {
      const cursor = output.length;
      send(fen === 'startpos' ? 'position startpos' : 'position fen ' + fen);
      send('go depth ' + depth);
      const last = await until(cursor, line => /^bestmove\s/.test(line), label + ' bestmove', 45000);
      const info = output.slice(cursor);
      return {
        label,
        fen,
        bestmove: last.match(/^bestmove\s+(\S+)/)?.[1] || '',
        multipv: [...new Set(info.filter(line => /^info /.test(line) && / depth /.test(' ' + line))
          .map(line => Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1)))].sort(),
        hasScore: info.some(line => /\bscore (cp|mate)\s+-?\d+/.test(line)),
        hasMate: info.some(line => /\bscore mate 1\b/.test(line))
      };
    }
    try {
      await commandAndWait('uci', line => line === 'uciok', 'uciok');
      send('setoption name MultiPV value 3');
      await commandAndWait('isready', line => line === 'readyok', 'readyok');
      const first = await search('startpos', 'startpos', 8);
      send('setoption name MultiPV value 1');
      await commandAndWait('isready', line => line === 'readyok', 'ready after MultiPV change');
      const blackFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const second = await search('black to move', blackFen, 8);
      const mateFen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
      const third = await search('mate in one', mateFen, 8);
      const { StockfishEngine } = await import('/StockfishEngine.js');
      const integration = new StockfishEngine();
      const received = [];
      const stale = [];
      let expectedFen = null;
      let wrapperError = false;
      integration.onError(() => { wrapperError = true; });
      integration.onResult(result => {
        received.push(result);
        if (expectedFen && result.analyzedFen !== expectedFen) stale.push(result.analyzedFen);
      });
      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      async function waitFor(predicate, label, timeoutMs = 30000) {
        const deadline = performance.now() + timeoutMs;
        while (!predicate()) {
          if (wrapperError || integration.hasFailed()) throw new Error('Application engine failed: ' + label);
          if (performance.now() >= deadline) throw new Error('Application engine timed out: ' + label);
          await new Promise(done => setTimeout(done, 20));
        }
      }
      async function analyze(fen, depth, lines) {
        expectedFen = fen;
        const cursor = received.length;
        integration.analyze(fen, depth, lines);
        await waitFor(() => received.slice(cursor).some(r => r.analyzedFen === fen && r.depth >= depth && r.lines?.length === lines), 'FEN/MultiPV ' + lines);
        return received.slice(cursor).find(r => r.analyzedFen === fen && r.depth >= depth && r.lines?.length === lines);
      }
      let wrapper;
      try {
        await waitFor(() => integration.isReady(), 'initialization');
        const variants = [];
        for (const count of [1, 3, 5, 1]) variants.push(await analyze(startFen, 8, count));
        const materialWhite = await analyze('7k/8/8/8/8/8/Q7/6K1 w - - 0 1', 8, 1);
        const materialBlack = await analyze('7k/8/8/8/8/8/Q7/6K1 b - - 0 1', 8, 1);
        // Keep a deep search running, then replace it repeatedly while stop is asynchronous.
        expectedFen = startFen;
        const cursor = received.length;
        integration.analyze(startFen, 36, 5);
        await waitFor(() => received.length > cursor, 'deep search progress');
        const soakStarted = performance.now();
        await new Promise(done => setTimeout(done, 10000));
        const soakResults = received.slice(cursor);
        for (const fen of [blackFen, startFen, blackFen, startFen]) {
          expectedFen = fen;
          integration.analyze(fen, 36, 3);
          await new Promise(done => setTimeout(done, 25));
        }
        const mateResult = await analyze(mateFen, 8, 1);
        integration.stop();
        const stoppedCount = received.length;
        await new Promise(done => setTimeout(done, 200));
        wrapper = {
          variants, materialWhite, materialBlack, mateResult, stale,
          soakMs: performance.now() - soakStarted, soakUpdates: soakResults.length,
          stopQuiet: received.length === stoppedCount, wrapperError
        };
      } finally {
        integration.destroy();
      }
      return {
        ok: true,
        run: new URL(location.href).searchParams.get('run'),
        viewportWidth: window.innerWidth,
        engine: output.find(line => /^id name /.test(line)) || '',
        results: [first, second, third], wrapper
      };
    } finally {
      engine.terminate();
    }
  })();
}

const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><script>(' +
  browserFixture.toString() + ')();</script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (pathname === '/StockfishEngine.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(integrationModule);
      return;
    }
    const assets = {
      '/stockfish-19-lite-single.js': [workerJs, 'text/javascript; charset=utf-8'],
      '/stockfish-19-lite-single.wasm': [workerWasm, 'application/wasm']
    };
    const asset = assets[pathname];
    if (!asset) { res.writeHead(404); res.end(); return; }
    const body = await readFile(asset[0]);
    res.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': body.byteLength });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

let chrome;
let ws;
let directory;
try {
  await new Promise((done, fail) => server.listen(0, '127.0.0.1', error => error ? fail(error) : done()));
  const port = server.address().port;
  const chromeBinary = process.env.CHROME_BIN ||
    ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(chromeBinary, 'Chrome/Chromium is required for actual browser QA');
  directory = await mkdtemp(join(tmpdir(), 'chessaz-chrome-'));
  chrome = spawn(chromeBinary, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--disable-background-networking', '--disable-extensions', '--disable-component-update',
    '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    '--remote-debugging-port=0', '--user-data-dir=' + directory, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeStderr = '';
  let launchError;
  chrome.stderr.on('data', chunk => { chromeStderr = (chromeStderr + chunk.toString()).slice(-16000); });
  chrome.on('error', error => { launchError = error; });
  let debugPort;
  const startupDeadline = Date.now() + 45000;
  while (Date.now() < startupDeadline) {
    try {
      debugPort = Number((await readFile(join(directory, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (debugPort) break;
    } catch {}
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error('Chromium exited before opening DevTools: ' + chromeStderr);
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(debugPort, 'Chromium DevTools did not become available within 45s: ' + chromeStderr);
  const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
  const target = targets.find(t => t.type === 'page');
  assert.ok(target?.webSocketDebuggerUrl, 'No Chromium page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    ws.addEventListener('open', done, { once: true });
    ws.addEventListener('error', fail, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Chromium command timed out: ' + method));
      }, 120000);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  for (const device of ['desktop', 'mobile-emulation']) {
    if (device === 'mobile-emulation') {
      await cdp('Emulation.setDeviceMetricsOverride', {
        mobile: true, width: 390, height: 844, deviceScaleFactor: 2
      });
    }
    // A distinct URL prevents reusing the previous document's resolved promise.
    const fixtureUrl = 'http://127.0.0.1:' + port + '/?run=' + device;
    await cdp('Page.navigate', { url: fixtureUrl });
    // Wait for the new navigation, not a stale execution context from the previous run.
    let navigated = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const state = await cdp('Runtime.evaluate', { expression: 'location.href === ' + JSON.stringify(fixtureUrl) + ' && !!window.__chessazSmoke', returnByValue: true });
        if (state.result?.value === true) { navigated = true; break; }
      } catch {}
      await new Promise(done => setTimeout(done, 100));
    }
    assert.ok(navigated, 'Browser fixture did not load after navigation');
    const evaluation = await cdp('Runtime.evaluate', {
      expression: 'window.__chessazSmoke',
      awaitPromise: true,
      returnByValue: true
    });
    if (evaluation.exceptionDetails) {
      throw new Error(device + ': ' + JSON.stringify(evaluation.exceptionDetails));
    }
    const result = evaluation.result?.value;
    assert.equal(result?.ok, true, device + ': missing Stockfish success result');
    assert.equal(result.run, device, 'Result belongs to a previous document');
    if (device === 'mobile-emulation') assert.equal(result.viewportWidth, 390);
    assert.match(result.engine, /stockfish\s+19\b/i, 'Wrong UCI engine version');
    assert.deepEqual(result.results[0].multipv, [1, 2, 3], 'MultiPV 3 did not execute');
    const wrapper = result.wrapper;
    assert.deepEqual(wrapper.variants.map(r => r.lines.length), [1, 3, 5, 1]);
    assert.deepEqual(wrapper.stale, [], 'Application emitted a stale FEN after restart');
    assert.ok(wrapper.materialWhite.evaluation > 3 && wrapper.materialBlack.evaluation > 3,
      'White advantage must stay positive for either side to move');
    assert.equal(wrapper.mateResult.mate, -1, 'Black mate must be negative from White perspective');
    assert.equal(wrapper.stopQuiet, true, 'Stop must cancel delayed callbacks');
    assert.equal(wrapper.wrapperError, false);
    assert.ok(wrapper.soakUpdates > 1 && wrapper.soakMs >= 10000, 'Deep analysis did not continue');
    for (const r of [...wrapper.variants, wrapper.materialWhite, wrapper.materialBlack, wrapper.mateResult]) {
      for (const line of r.lines) {
        const chess = new Chess(r.analyzedFen);
        for (const move of line.pv) {
          assert.ok(chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] || 'q' }),
            device + ': illegal application PV');
        }
      }
    }
    for (const r of result.results) {
      assert.ok(r.hasScore, device + ': no real UCI evaluation for ' + r.label);
      assert.match(r.bestmove, /^[a-h][1-8][a-h][1-8][qrbn]?$/, 'Invalid UCI bestmove');
      const chess = r.fen === 'startpos' ? new Chess() : new Chess(r.fen);
      const move = chess.move({
        from: r.bestmove.slice(0, 2), to: r.bestmove.slice(2, 4),
        promotion: r.bestmove[4] || 'q'
      });
      assert.ok(move, device + ': bestmove is illegal for ' + r.label);
      if (r.label === 'mate in one') {
        assert.ok(chess.isCheckmate(), device + ': engine did not find the forced checkmate');
        assert.ok(r.hasMate, device + ': no UCI mate score reported');
      }
    }
    console.log('PASS real Chromium ' + device + ': UCI, evaluations, MultiPV 3, FEN changes, mate-in-one');
    console.log('Engine: ' + result.engine);
    console.log('PASS application wrapper: MultiPV 1/3/5/1, score perspective, rapid restarts, stop, legal PV; deep analysis ' + Math.round(wrapper.soakMs) + 'ms / ' + wrapper.soakUpdates + ' updates');
  }
} finally {
  try { ws?.close(); } catch {}
  if (chrome) chrome.kill('SIGKILL');
  await new Promise(done => server.close(done));
  if (directory) await rm(directory, { recursive: true, force: true });
}
