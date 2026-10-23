// Real-browser geometry regression. Run after `npm run build` with CHROME_BIN
// pointing to Chromium/Chrome. No backend, credentials or production access.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:`
    localStorage.setItem('app-language','ru');localStorage.setItem('chess_sound','Muted / Off');
    window.__engineCommands = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(...args) { window.__engineCommands.push(args[0]); return super.postMessage(...args); }
    };
  ` });
  for (const [width, height] of [[320,568],[360,640],[393,725],[390,844],[430,932],[667,375]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width, height, deviceScaleFactor:1 });
    const url = `${base}/game?mobile-qa=${width}`;
    await cdp('Page.navigate', { url });
    await waitFor(`location.href === ${JSON.stringify(url)} && !!document.querySelector('[data-mobile-analysis-header]')`);
    const bounds = await evaluate(`(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        board:rect('.desktop-analysis-board-frame'), grid:rect('.desktop-analysis-main-board .aspect-square'),
        header:rect('[data-mobile-analysis-header]'), details:rect('#mobile-analysis-details'),
        moves:rect('[data-mobile-move-navigation]'), dock:rect('[data-mobile-app-nav]'),
        rows:document.querySelectorAll('[data-mobile-engine-line]').length,
        controls:[...document.querySelectorAll('[data-mobile-move-navigation] button')].map(button=>button.getBoundingClientRect().toJSON()),
        labelSize:getComputedStyle(document.querySelector('.mobile-analysis-engine')).fontSize,
        tabSize:getComputedStyle(document.querySelector('.mobile-analysis-tabs button')).fontSize };
    })()`);
    assert.equal(bounds.scrollWidth, width, 'Page must not scroll horizontally');
    assert.ok(Math.abs(bounds.board.width - bounds.board.height) < 1, 'Board frame must stay square');
    assert.ok(Math.abs(bounds.grid.width - bounds.grid.height) < 1, 'Actual square grid must stay square');
    assert.equal(bounds.rows, 2, 'Both line slots are visible without expansion');
    assert.equal(bounds.labelSize, bounds.tabSize, 'Engine label matches tab typography');
    assert.ok(bounds.board.top >= bounds.header.bottom - 1, 'Board follows the compact header');
    assert.ok(bounds.controls.every(button=>button.width >= 44 && button.height >= 44), 'Five controls keep 44px touch targets');
    if (height > width) {
      assert.ok(bounds.moves.top >= 0 && bounds.details.bottom <= bounds.dock.top,
        'Board, navigation and two lines must fit together above the dock in portrait: ' + JSON.stringify(bounds));
    } else {
      await evaluate("document.querySelector('#mobile-analysis-details').scrollIntoView({block:'end'})");
      assert.ok(await evaluate("document.querySelector('#mobile-analysis-details').getBoundingClientRect().bottom <= document.querySelector('[data-mobile-app-nav]').getBoundingClientRect().top"), 'Short landscape keeps lines reachable by scrolling');
    }
    console.log(`PASS mobile geometry ${width}x${height}`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width:390, height:844, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/game?mobile-qa=interactions' });
  await waitFor("document.querySelectorAll('.mobile-analysis-line').length === 2 && [...document.querySelectorAll('.mobile-analysis-score')].every(score=>score.textContent !== '—')");
  assert.ok(await evaluate("window.__engineCommands.some(command=>command === 'setoption name MultiPV value 2')"), 'Worker calculates two lines, rather than hiding extra work');
  console.log('PASS real Stockfish worker and two visible PV lines');
  const capture = async name => {
    if (!process.env.MOBILE_QA_SCREENSHOT_DIR) return;
    await mkdir(process.env.MOBILE_QA_SCREENSHOT_DIR, { recursive:true });
    const shot = await cdp('Page.captureScreenshot', { format:'png' });
    await writeFile(join(process.env.MOBILE_QA_SCREENSHOT_DIR, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  await capture('analysis-mobile-new');
  await evaluate("document.querySelector('.desktop-analysis-main-board [data-square=e2]').click()");
  await evaluate("document.querySelector('.desktop-analysis-main-board [data-square=e4]').click()");
  await waitFor("JSON.parse(localStorage.getItem('chess_analysis_session_v1')).moves.join(' ') === 'e4'");
  await evaluate("document.querySelector('.desktop-analysis-main-board [data-square=e7]').click()");
  await evaluate("document.querySelector('.desktop-analysis-main-board [data-square=e5]').click()");
  await waitFor("JSON.parse(localStorage.getItem('chess_analysis_session_v1')).moves.join(' ') === 'e4 e5'");
  await evaluate("document.querySelector('[data-mobile-move-navigation] button:nth-child(2)').click()");
  await waitFor("JSON.parse(localStorage.getItem('chess_analysis_session_v1')).viewMoveIndex === 1");
  await evaluate("document.querySelector('[data-mobile-move-navigation] button:nth-child(4)').click()");
  await waitFor("JSON.parse(localStorage.getItem('chess_analysis_session_v1')).viewMoveIndex === -1");
  await waitFor("[...document.querySelectorAll('.mobile-analysis-score')].every(score=>score.textContent !== '—')");
  const saved = await evaluate("localStorage.getItem('chess_analysis_session_v1')");
  const searchCount = await evaluate("window.__engineCommands.filter(command=>typeof command==='string' && command.startsWith('go ')).length");
  assert.equal(await evaluate("document.querySelector('.desktop-analysis-main-board [data-square]').dataset.square"), 'a8');
  await evaluate("document.querySelector('[data-mobile-board-flip]').click()");
  await waitFor("document.querySelector('.desktop-analysis-main-board [data-square]').dataset.square === 'h1'");
  assert.equal(await evaluate("localStorage.getItem('chess_analysis_session_v1')"), saved, 'Flip must preserve the current position and history');
  assert.equal(await evaluate("window.__engineCommands.filter(command=>typeof command==='string' && command.startsWith('go ')).length"), searchCount, 'Flip must not restart engine search');
  const boardTop = await evaluate("document.querySelector('.desktop-analysis-board-frame').getBoundingClientRect().top");
  await evaluate("document.querySelector('.mobile-analysis-line p').scrollLeft = 100");
  assert.equal(await evaluate("document.querySelector('.desktop-analysis-board-frame').getBoundingClientRect().top"), boardTop, 'Reading a PV continuation must not move the board');
  console.log('PASS moves, history, board flip without engine restart and independent PV scrolling');
  await evaluate("document.querySelector('.mobile-analysis-more').click()");
  await waitFor("!!document.querySelector('.mobile-analysis-actions-dialog[open]')");
  await capture('analysis-menu-new');
  await evaluate("document.querySelector('[data-mobile-tool=position]').click()");
  assert.equal(await evaluate("document.querySelector('.mobile-analysis-actions-dialog').open"), false, 'Overflow closes before the editor opens');
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
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:false, width:1440, height:900, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/game?desktop-qa=preserved' });
  await waitFor("document.querySelectorAll('.analysis-engine-line').length === 3");
  await evaluate("document.querySelector('[aria-label=\"Линий анализа: 5\"]').click()");
  await waitFor("document.querySelectorAll('.analysis-engine-line').length === 5");
  assert.ok(await evaluate("window.__engineCommands.some(command=>command === 'setoption name MultiPV value 5')"), 'Desktop retains five-line engine support');
  console.log('PASS desktop retains three/five-line controls');
} finally {
  try { ws?.close(); } catch { /* Already disconnected. */ }
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    await new Promise(done => {
      chrome.once('exit', done);
      if (!chrome.kill('SIGKILL')) done();
    });
  }
  await new Promise(done => server.close(done));
  // Chromium children may finish flushing profile files just after the parent exits.
  if (profile) await rm(profile, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
}
