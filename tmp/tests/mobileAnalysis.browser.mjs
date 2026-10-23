// Real-browser geometry regression. Run after `npm run build` with CHROME_BIN
// pointing to Chromium/Chrome. No backend, credentials or production access.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const dist = resolve('dist');
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first');
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.mp3':'audio/mpeg', '.mp4':'video/mp4' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
    const target = extname(file) ? file : join(dist, 'index.html');
    response.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    response.end(await readFile(target));
  } catch { response.writeHead(404).end(); }
});

let chrome;
let ws;
let profile;
try {
  await new Promise((done, fail) => server.listen(0, '127.0.0.1', error => error ? fail(error) : done()));
  const base = 'http://127.0.0.1:' + server.address().port;
  const binary = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(binary, 'Chrome/Chromium required; set CHROME_BIN');
  profile = await mkdtemp(join(tmpdir(), 'chessaz-mobile-'));
  chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--no-first-run', '--disable-background-networking', '--remote-allow-origins=*', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, ...JSON.parse(process.env.CHROME_ARGS || '[]'), 'about:blank'], { stdio:['ignore','ignore','pipe'] });
  let stderr = '';
  let launchError;
  chrome.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  chrome.on('error', error => { launchError = error; });
  const pause = () => new Promise(done => setTimeout(done, 100));
  let port;
  for (let n = 0; n < 200; n++) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw Error('Chromium exited: ' + stderr);
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch { /* Wait for startup. */ }
    await pause();
  }
  assert.ok(port, 'Chromium did not start: ' + stderr);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, fail) => { ws.addEventListener('open', done, { once:true }); ws.addEventListener('error', fail, { once:true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    message.error ? handler.reject(Error(JSON.stringify(message.error))) : handler.resolve(message.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(Error('CDP timeout: ' + method)); }, 20000);
    pending.set(requestId, { resolve:value => { clearTimeout(timer); resolve(value); }, reject:error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id:requestId, method, params }));
  });
  const evaluate = async expression => {
    const value = await cdp('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
    if (value.exceptionDetails) throw Error(JSON.stringify(value.exceptionDetails));
    return value.result?.value;
  };
  const waitFor = async expression => {
    for (let n = 0; n < 200; n++) {
      try { if (await evaluate(expression)) return; } catch { /* Navigation changes contexts. */ }
      await pause();
    }
    throw Error('UI timeout: ' + expression);
  };
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:"localStorage.setItem('app-language','ru');localStorage.setItem('chess_sound','Muted / Off');" });
  for (const [width, height] of [[320,568],[360,640],[390,844],[430,932],[667,375]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width, height, deviceScaleFactor:1 });
    const url = `${base}/game?mobile-qa=${width}`;
    await cdp('Page.navigate', { url });
    await waitFor(`location.href === ${JSON.stringify(url)} && !!document.querySelector('[data-mobile-analysis-header]')`);
    await evaluate("document.querySelector('[data-mobile-move-navigation]').scrollIntoView({block:'center'})");
    const bounds = await evaluate(`(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        board:rect('.desktop-analysis-board-frame'), grid:rect('.desktop-analysis-main-board .aspect-square'),
        moves:rect('[data-mobile-move-navigation]'), dock:rect('[data-mobile-app-nav]') };
    })()`);
    assert.equal(bounds.scrollWidth, width, 'Page must not scroll horizontally');
    assert.ok(Math.abs(bounds.board.width - bounds.board.height) < 1, 'Board frame must stay square');
    assert.ok(Math.abs(bounds.grid.width - bounds.grid.height) < 1, 'Actual square grid must stay square');
    assert.ok(bounds.moves.top >= 0 && bounds.moves.bottom <= bounds.dock.top, 'Move controls must be reachable above the dock');
    console.log(`PASS mobile geometry ${width}x${height}`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width:390, height:844, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/game?mobile-qa=interactions' });
  await waitFor("!!document.querySelector('.mobile-analysis-summary') && document.querySelector('.mobile-analysis-score').textContent !== '—'");
  await evaluate("document.querySelector('.mobile-analysis-summary').click();document.querySelector('.mobile-analysis-engine-controls > div button:last-child').click()");
  await waitFor("document.querySelectorAll('.mobile-analysis-line').length === 5");
  console.log('PASS real Stockfish worker, expansion and five PV lines');
  const saved = await evaluate("localStorage.getItem('chess_analysis_session_v1')");
  await evaluate("document.querySelector('[data-mobile-tool=position]').click()");
  await waitFor("!!document.querySelector('[data-main-position-editor]')");
  await evaluate("[...document.querySelectorAll('.mobile-position-tools button')].find(button=>button.textContent==='Очистить доску').click()");
  const invalid = await evaluate(`(() => {
    const footer = document.querySelector('.mobile-position-tools footer');
    const status = footer.querySelector('[role=status]');
    const apply = footer.querySelector('button');
    const dialog = document.querySelector('[data-mobile-analysis-dialog]');
    return {disabled:apply.disabled, text:status.textContent, statusBottom:status.getBoundingClientRect().bottom,
      applyTop:apply.getBoundingClientRect().top, applyBottom:apply.getBoundingClientRect().bottom, dialogBottom:dialog.getBoundingClientRect().bottom};
  })()`);
  assert.equal(invalid.disabled, true);
  assert.match(invalid.text, /по одному белому и чёрному королю/);
  assert.ok(invalid.statusBottom <= invalid.applyTop && invalid.applyBottom < invalid.dialogBottom, 'Validation and Apply must be visible together');
  await evaluate("[...document.querySelectorAll('.mobile-position-tools footer button')].find(button=>button.textContent==='Отмена').click()");
  assert.equal(await evaluate("localStorage.getItem('chess_analysis_session_v1')"), saved, 'Cancel must preserve analysis');
  console.log('PASS editor validation placement and draft cancellation');
} finally {
  try { ws?.close(); } catch { /* Already disconnected. */ }
  chrome?.kill('SIGKILL');
  await new Promise(done => server.close(done));
  if (profile) await rm(profile, { recursive:true, force:true });
}
