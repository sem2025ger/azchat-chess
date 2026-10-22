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

const dist = resolve('dist');
const workerJs = join(dist, 'stockfish-19-lite-single.js');
const workerWasm = join(dist, 'stockfish-19-lite-single.wasm');
assert.ok(existsSync(workerJs) && existsSync(workerWasm),
  'Run npm run build before the browser engine smoke test');

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
      return {
        ok: true,
        engine: output.find(line => /^id name /.test(line)) || '',
        results: [first, second, third]
      };
    } finally {
      engine.terminate();
    }
  })();
}

const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>(' +
  browserFixture.toString() + ')();</script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
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
    '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    '--remote-debugging-port=0', '--user-data-dir=' + directory, 'about:blank'
  ], { stdio: 'ignore' });
  let debugPort;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      debugPort = Number((await readFile(join(directory, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (debugPort) break;
    } catch {}
    if (chrome.exitCode !== null) throw new Error('Chromium exited before opening DevTools');
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(debugPort, 'Chromium DevTools did not become available');
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
      pending.set(id, { resolve, reject });
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
    await cdp('Page.navigate', { url: 'http://127.0.0.1:' + port + '/' });
    const evaluation = await cdp('Runtime.evaluate', {
      expression: '(async()=>{for(let n=0;n<200;n++){if(window.__chessazSmoke)return await window.__chessazSmoke;await new Promise(r=>setTimeout(r,100));}throw new Error("Browser fixture did not load")})()',
      awaitPromise: true,
      returnByValue: true
    });
    if (evaluation.exceptionDetails) {
      throw new Error(device + ': ' + JSON.stringify(evaluation.exceptionDetails));
    }
    const result = evaluation.result?.value;
    assert.equal(result?.ok, true, device + ': missing Stockfish success result');
    assert.match(result.engine, /stockfish/i, 'Missing UCI engine identification');
    assert.deepEqual(result.results[0].multipv, [1, 2, 3], 'MultiPV 3 did not execute');
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
  }
} finally {
  try { ws?.close(); } catch {}
  if (chrome) chrome.kill('SIGKILL');
  await new Promise(done => server.close(done));
  if (directory) await rm(directory, { recursive: true, force: true });
}
