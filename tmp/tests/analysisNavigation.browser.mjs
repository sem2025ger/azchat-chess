// Synthetic, read-only Chrome DevTools benchmark for first desktop Home -> Analysis.
// Records cold and repeat paint delays, plus main-thread long tasks.
// No account, production endpoint, or engine stub is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const dist = resolve('dist');
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(dist, '.' + pathname);
    if (file !== dist && !file.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
    const target = extname(file) ? file : join(dist, 'index.html');
    res.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    res.end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
let chrome, ws, profile;
const deadline = setTimeout(() => {
  chrome?.kill('SIGKILL');
  server.closeAllConnections();
  console.error('Navigation browser benchmark exceeded 90 seconds');
  process.exit(1);
}, 90_000);
try {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  const base = 'http://127.0.0.1:' + server.address().port;
  const binary = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(binary, 'Chromium required');
  profile = await mkdtemp(join(tmpdir(), 'chessaz-nav-'));
  chrome = spawn(binary, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--no-first-run', '--disable-background-networking', '--remote-allow-origins=*',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', launchError;
  chrome.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-5000); });
  chrome.on('error', error => { launchError = error; });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let port = 0;
  for (let n = 0; n < 200; n++) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw Error('Chromium exited: ' + stderr);
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {}
    if (port) break;
    await sleep(100);
  }
  assert.ok(port, 'Chromium DevTools failed to start: ' + stderr);
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    message.error ? waiter.reject(Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(Error('CDP timeout ' + method)); }, 20_000);
    pending.set(requestId, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const waitFor = async expression => {
    for (let n = 0; n < 200; n++) {
      if (await evaluate(expression)) return;
      await sleep(75);
    }
    throw Error('Timed out: ' + expression);
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1 });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('app-language', 'ru');
    localStorage.setItem('chess_sound', 'Muted / Off');
    window.__navLongTasks = [];
    new PerformanceObserver(list => {
      for (const item of list.getEntries()) window.__navLongTasks.push({ start: item.startTime, duration: item.duration });
    }).observe({ type: 'longtask', buffered: true });
  ` });
  await cdp('Page.navigate', { url: base + '/' });
  await waitFor("!!document.querySelector('.site-nav-link[href=\"/game\"]') && !!document.querySelector('main')");
  // Give Home its first paint and a realistic chance to start route prefetch.
  await sleep(450);
  const navigate = async (selector, readySelector) => {
    const started = await evaluate(`(() => {
      const link = document.querySelector(${JSON.stringify(selector)});
      if (!link) throw Error('Missing navigation link');
      const start = performance.now();
      window.__navSample = { start, done: 0 };
      link.click();
      const check = () => {
        if (document.querySelector(${JSON.stringify(readySelector)})) {
          requestAnimationFrame(() => { window.__navSample.done = performance.now(); });
        } else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
      return start;
    })()`);
    await waitFor('window.__navSample?.done > 0');
    await sleep(100); // PerformanceObserver reports long tasks asynchronously.
    return evaluate(`(() => {
      const end = window.__navSample.done;
      const tasks = window.__navLongTasks.filter(item => item.start >= ${started} && item.start <= end);
      return { ms: Math.round(end - ${started}),
        longTaskCount: tasks.length,
        maxLongTaskMs: Math.round(Math.max(0, ...tasks.map(item => item.duration))),
        url: location.pathname };
    })()`);
  };
  const cold = await navigate('.site-nav-link[href="/game"]', '.desktop-analysis-main-board [data-square]');
  assert.equal(cold.url, '/game');
  const back = await navigate('.site-nav-link[href="/home"]', '.home-screen-root');
  assert.equal(back.url, '/home');
  await sleep(250);
  const warm = await navigate('.site-nav-link[href="/game"]', '.desktop-analysis-main-board [data-square]');
  assert.equal(warm.url, '/game');
  // These are diagnostics, not an artificial guarantee of zero-millisecond navigation.
  // Regression gate: the board must render on both navigation attempts.
  assert.ok(cold.ms < 5_000 && warm.ms < 5_000, 'Analysis route failed to paint within 5 seconds');
  console.log('ANALYSIS_NAVIGATION_QA ' + JSON.stringify({ cold, back, warm }));
  console.log('PASS first/repeat desktop navigation paints chessboard with real Stockfish worker');
} finally {
  clearTimeout(deadline);
  ws?.close();
  chrome?.kill('SIGKILL');
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
}
