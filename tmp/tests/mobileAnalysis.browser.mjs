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
// Fail closed if Chromium or an open socket prevents the regression from ending.
const deadline = setTimeout(() => {
  console.error('FAIL mobile browser regression exceeded 120 seconds');
  chrome?.kill('SIGKILL');
  server.closeAllConnections();
  process.exit(1);
}, 120000);
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
      try { if (await evaluate(expression)) return; }
      catch (error) {
        // Only a navigation context replacement is transient. A dead/unresponsive
        // renderer must fail with its real error rather than spin to the watchdog.
        if (!/context.*destroyed|Cannot find context|Inspected target navigated|Execution context was destroyed/i.test(String(error))) throw error;
      }
      await pause();
    }
    const state = await evaluate("JSON.stringify({url:location.href,ready:document.readyState,text:document.body?.innerText.slice(0,800)})").catch(()=>'context unavailable');
    throw Error('UI timeout: ' + expression + '; ' + state);
  };
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:`
    localStorage.setItem('app-language','ru');localStorage.setItem('chess_sound','Muted / Off');
    window.__engineCommands = [];
    window.__stockfishId = '';
    window.__stockfishWorkerUrls = [];
    const NativeWorker = window.Worker;
    // Geometry-only pages need no engine computation. Running several WASM
    // workers sequentially in headless Chromium can stall the CDP renderer.
    // Keep the genuine browser engine for both full interaction scenarios.
    const realEngineQA = location.search.includes('mobile-qa=interactions') ||
      location.search.includes('desktop-qa=preserved');
    if (realEngineQA) {
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          window.__stockfishWorkerUrls.push(String(args[0]));
          this.addEventListener('message', event => {
            if (typeof event.data !== 'string') return;
            const name = event.data.match(/^id name (.*)$/m);
            if (name) window.__stockfishId = name[1].trim();
          });
        }
        postMessage(...args) { window.__engineCommands.push(args[0]); return super.postMessage(...args); }
      };
    } else {
      // UI geometry assertions are independent of evaluation. A minimal
      // handshake stub avoids WASM startup, without changing the app code.
      window.Worker = class {
        onmessage = null;
        onerror = null;
        postMessage(command) {
          window.__engineCommands.push(command);
          if (command === 'uci' || command === 'isready') {
            queueMicrotask(() => this.onmessage?.({ data: command === 'uci' ? 'uciok' : 'readyok' }));
          }
        }
        terminate() {}
      };
    }
  ` });
  const capture = async name => {
    if (!process.env.MOBILE_QA_SCREENSHOT_DIR) return;
    await mkdir(process.env.MOBILE_QA_SCREENSHOT_DIR, { recursive:true });
    const shot = await cdp('Page.captureScreenshot', { format:'png' });
    await writeFile(join(process.env.MOBILE_QA_SCREENSHOT_DIR, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
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
        lineFontSize:parseFloat(getComputedStyle(document.querySelector('.mobile-analysis-line p')).fontSize),
        lineWeight:parseInt(getComputedStyle(document.querySelector('.mobile-analysis-line p')).fontWeight),
        lineBounds:[...document.querySelectorAll('[data-mobile-engine-line]')].map(row=>row.getBoundingClientRect().toJSON()),
        labelSize:getComputedStyle(document.querySelector('.mobile-analysis-engine')).fontSize,
        tabSize:getComputedStyle(document.querySelector('.mobile-analysis-tabs button')).fontSize };
    })()`);
    assert.equal(bounds.scrollWidth, width, 'Page must not scroll horizontally');
    assert.ok(Math.abs(bounds.board.width - bounds.board.height) < 1, 'Board frame must stay square');
    assert.ok(Math.abs(bounds.grid.width - bounds.grid.height) < 1, 'Actual square grid must stay square');
    assert.equal(bounds.rows, 2, 'Both line slots are visible without expansion');
    assert.ok(bounds.lineFontSize >= 21 && bounds.lineWeight >= 900, 'PV moves remain large and bold');
    assert.ok(bounds.lineBounds.every(row => row.height <= 47), 'Engine rows remain compact');
    assert.ok(bounds.lineBounds.every(row => row.top >= bounds.details.top && row.bottom <= bounds.details.bottom + 1), 'Both complete rows fit inside the analysis panel');
    assert.equal(bounds.labelSize, bounds.tabSize, 'Engine label matches tab typography');
    assert.ok(bounds.details.top >= bounds.header.bottom - 1 && bounds.board.top >= bounds.details.bottom - 1, 'Two engine rows sit between header and board');
    assert.ok(bounds.controls.every(button=>button.width >= 44 && button.height >= 44), 'Five controls keep 44px touch targets');
    if (height > width) {
      assert.ok(bounds.moves.top >= 0 && bounds.moves.bottom <= bounds.dock.top && bounds.details.bottom <= bounds.board.top,
        'Board, navigation and two lines must fit together above the dock in portrait: ' + JSON.stringify(bounds));
    } else {
      await evaluate("document.querySelector('#mobile-analysis-details').scrollIntoView({block:'end'})");
      assert.ok(await evaluate("document.querySelector('#mobile-analysis-details').getBoundingClientRect().bottom <= document.querySelector('[data-mobile-app-nav]').getBoundingClientRect().top"), 'Short landscape keeps lines reachable by scrolling');
    }
    if (width === 393 || width === 320) await capture(`analysis-${width}x${height}`);
    if (width === 320) assert.ok(bounds.board.width >= 256, 'Short portrait board uses the reclaimed space');
    if (width === 360) assert.ok(bounds.board.width >= 328, 'Medium portrait board uses the reclaimed space');
    console.log(`PASS mobile geometry ${width}x${height}`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width:320, height:568, deviceScaleFactor:1 });
  await cdp('Page.navigate', {url:base + '/game?mobile-qa=safe-area'});
  await waitFor("!!document.querySelector('[data-mobile-analysis-header]')");
  const dockHeight = await evaluate("document.querySelector('[data-mobile-app-nav]').getBoundingClientRect().height");
  await evaluate("document.querySelector('[data-analysis-route]').style.setProperty('--mobile-analysis-safe-bottom','34px')");
  await waitFor(`Math.abs(document.querySelector('[data-mobile-app-nav]').getBoundingClientRect().height - ${dockHeight + 34}) < 1`);
  assert.ok(await evaluate("document.querySelector('[data-mobile-move-navigation]').getBoundingClientRect().bottom <= document.querySelector('[data-mobile-app-nav]').getBoundingClientRect().top"), 'Simulated 34px bottom safe area preserves transport clearance on a short phone');
  console.log('PASS short portrait with simulated bottom safe area');
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width:390, height:844, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/game?mobile-qa=interactions' });
  await waitFor("document.querySelectorAll('.mobile-analysis-line').length === 2 && [...document.querySelectorAll('.mobile-analysis-score')].every(score=>score.textContent !== '—')");
  assert.ok(await evaluate("window.__engineCommands.some(command=>command === 'setoption name MultiPV value 2')"), 'Worker calculates two lines, rather than hiding extra work');
  await waitFor("typeof window.__stockfishId === 'string' && window.__stockfishId.length > 0");
  const realEngineIdentity = await evaluate("window.__stockfishId");
  assert.match(realEngineIdentity, /Stockfish\s+19\b/i, 'Official UCI id must identify the genuine Stockfish 19 engine');
  assert.ok(await evaluate("window.__stockfishWorkerUrls.some(url => url.endsWith('/stockfish-19-lite-single.js'))"), 'Analysis must load bundled Stockfish 19 worker');
  assert.equal(await evaluate("document.querySelector('.mobile-analysis-engine')?.textContent.trim()"), 'Stockfish 19', 'Engine label matches actual UCI version');
  console.log('PASS real Stockfish 19 UCI identity: ' + realEngineIdentity);
  console.log('PASS real Stockfish worker and two visible PV lines');
  await waitFor("document.querySelectorAll('.mobile-analysis-figurine').length > 0 && [...document.querySelectorAll('.mobile-analysis-figurine')].every(img => img.complete && img.naturalWidth > 0)");
  assert.ok(await evaluate("[...document.querySelectorAll('.mobile-analysis-figurine')].every(img => img.complete && img.naturalWidth > 0 && Math.abs(img.getBoundingClientRect().width - 33) < 0.5)"), 'Figurines load from existing assets at fixed readable size');
  assert.ok(await evaluate("!document.querySelector('.mobile-analysis-lines-heading') && getComputedStyle(document.querySelector('#mobile-analysis-details .sr-only')).position === 'absolute'"), 'Engine variant heading consumes no visible row');
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
  await evaluate("document.querySelectorAll('.mobile-analysis-tabs button')[1].click()");
  assert.equal(await evaluate("document.querySelector('.desktop-analysis-board-frame').getBoundingClientRect().top"), boardTop, 'Moves tab must not shift the board');
  const movesGeometry = await evaluate(`(() => {
    const copy = document.querySelector('[data-copy-moves]').getBoundingClientRect();
    const panel = document.querySelector('.mobile-analysis-moves').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.mobile-analysis-moves tr')].map(row => row.getBoundingClientRect());
    return {copy:copy.toJSON(),panel:panel.toJSON(),rows:rows.map(row=>row.toJSON())};
  })()`);
  assert.ok(movesGeometry.copy.width <= 36 && movesGeometry.copy.height <= 36 && movesGeometry.copy.right <= movesGeometry.panel.right,
    'Copy action stays icon-sized in upper-right corner: ' + JSON.stringify(movesGeometry));
  assert.ok(movesGeometry.rows.length && movesGeometry.rows[0].bottom <= movesGeometry.panel.bottom,
    'At least the first played move remains visible with an unchanged board');
  await evaluate("document.querySelectorAll('.mobile-analysis-tabs button')[0].click()");
  assert.equal(await evaluate("document.querySelector('.desktop-analysis-board-frame').getBoundingClientRect().top"), boardTop, 'Returning to analysis must preserve board position');
  console.log('PASS moves, history, board flip without engine restart, stable tabs and independent PV scrolling');
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
  // Desktop preservation is a separate scenario. Dispose the mobile document
  // before changing media queries, avoiding an unrelated engine restart during
  // unload; all real-engine and desktop assertions below remain unchanged.
  console.log('CHECK desktop: dispose mobile document before viewport change');
  await cdp('Page.navigate', { url:'about:blank' });
  await waitFor("location.href === 'about:blank'");
  console.log('CHECK desktop: switch viewport');
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:false, width:1440, height:900, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/game?desktop-qa=preserved' });
  console.log('CHECK desktop: navigation committed; wait for three engine lines');
  await waitFor("document.querySelectorAll('.analysis-engine-line').length === 3");
  await evaluate("document.querySelector('[aria-label=\"Линий анализа: 5\"]').click()");
  console.log('CHECK desktop: wait for five real Stockfish variations');
  // Fixed slots appear immediately, before the worker can receive the new
  // MultiPV command. Wait for the actual command and five non-placeholder
  // scores; asserting the slot count alone would produce a false pass.
  await waitFor("window.__engineCommands.some(command=>command === 'setoption name MultiPV value 5')");
  await waitFor("document.querySelectorAll('.analysis-engine-line').length === 5 && [...document.querySelectorAll('.analysis-engine-score')].every(score => score.textContent.trim() !== '—')");
  assert.ok(await evaluate("window.__engineCommands.some(command=>command === 'setoption name MultiPV value 5')"), 'Desktop retains five-line engine support');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#mobile-analysis-details')).display"), 'none', 'Mobile panel stays hidden on desktop');
  console.log('PASS desktop retains three/five-line controls');
  // Lobby layout is independent of game/analysis layout and needs no account.
  await cdp('Page.navigate', { url:'about:blank' });
  await waitFor("location.href === 'about:blank'");
  for (const [width, height] of [[375,667], [393,720], [390,844], [360,640]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width, height, deviceScaleFactor:1 });
    await cdp('Page.navigate', { url:base + '/play?mobile-qa=arena' });
    await waitFor("!!document.querySelector('.mobile-arena-time[aria-haspopup=dialog]')");
    const geometry = await evaluate(`(() => {
      const panel = document.querySelector('.mobile-arena-panel');
      const board = document.querySelector('.play-lobby-board').getBoundingClientRect();
      const nav = document.querySelector('[data-mobile-app-nav]').getBoundingClientRect();
      return {panel:panel.getBoundingClientRect().toJSON(),board:board.toJSON(),nav:nav.toJSON(),
        internalScroll:panel.scrollHeight > panel.clientHeight + 2,
        lobby:document.querySelectorAll('.online-lobby').length,
        clocks:panel.querySelectorAll('.mobile-arena-time').length,nativeLists:panel.querySelectorAll('select').length,
        timeHeight:panel.querySelector('.mobile-arena-time').getBoundingClientRect().height,
        scrollOwners:[...document.querySelectorAll('main,main div')].filter(n=>/auto|scroll/.test(getComputedStyle(n).overflowY)).map(n=>({client:n.clientHeight,scroll:n.scrollHeight}))};
    })()`);
    assert.ok(geometry.panel.bottom <= geometry.nav.top, 'All mobile arena actions stay above navigation: ' + JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.board.width - geometry.board.height) < 1, 'Lobby board stays square');
    assert.equal(geometry.internalScroll, false);
    assert.equal(geometry.lobby, 0, 'Desktop lobby must not mount on mobile');
    assert.equal(geometry.clocks, 1);
    assert.equal(geometry.nativeLists, 0);
    assert.ok(geometry.timeHeight >= 44 && geometry.timeHeight <= 50, 'Compact time trigger keeps a touch target');
    assert.ok(geometry.board.width >= Math.min(width - 8, height - 344), 'Board uses the recovered vertical space');
    assert.ok(geometry.scrollOwners.every(n=>n.scroll<=n.client+2), 'Pre-game screen needs no nested vertical scrolling: '+JSON.stringify(geometry));
    await evaluate("document.querySelector('.mobile-arena-time').click()");
    await waitFor("document.querySelector('.mobile-time-dialog')?.open");
    const picker = await evaluate(`(() => {
      const d=document.querySelector('.mobile-time-dialog'); const r=d.getBoundingClientRect();
      return {rect:r.toJSON(),scroll:d.scrollHeight>d.clientHeight+1,buttons:d.querySelectorAll('.mobile-time-options button').length,
        groups:[...d.querySelectorAll('h3')].map(n=>n.textContent),width:innerWidth,height:innerHeight};
    })()`);
    assert.equal(picker.scroll, false, 'All nine options fit without a scroll');
    assert.equal(picker.buttons, 9);
    assert.deepEqual(picker.groups, ['Bullet','Blitz','Rapid']);
    assert.ok(picker.rect.top >= 0 && picker.rect.bottom <= height);
    assert.ok(Math.abs((picker.rect.top + picker.rect.bottom)/2 - height/2) < 2, 'Time picker is centered');
    await evaluate("[...document.querySelectorAll('.mobile-time-options button')].find(b=>b.textContent === '5 мин.').click()");
    await waitFor("document.querySelector('.mobile-arena-clock strong').textContent === '5 мин.'");
    assert.equal(await evaluate("document.querySelector('.mobile-time-dialog').open"), true, 'Selection remains visible until confirmed');
    assert.equal(await evaluate("document.querySelector('.mobile-time-options button[aria-pressed=true]').textContent"), '5 мин.');
    await evaluate("document.querySelector('.mobile-time-done').click()");
    await waitFor("!document.querySelector('.mobile-time-dialog')");
    assert.equal(await evaluate("document.activeElement === document.querySelector('.mobile-arena-time')"), true);
    await evaluate("document.querySelector('.mobile-arena-time').click()");
    await waitFor("document.querySelector('.mobile-time-dialog')?.open");
    await evaluate("document.querySelector('.mobile-time-options button[aria-pressed=true]').click()");
    await waitFor("!document.querySelector('.mobile-time-dialog')");
    await evaluate("document.querySelector('.mobile-arena-time').click()");
    await waitFor("document.querySelector('.mobile-time-dialog')?.open");
    await evaluate("document.querySelector('.mobile-time-close').click()");
    await waitFor("!document.querySelector('.mobile-time-dialog')");
    await evaluate("document.querySelector('.mobile-arena-footer button').focus();document.querySelector('.mobile-arena-footer button').click()");
    await waitFor("!!document.querySelector('[role=dialog]')");
    const dialog = await evaluate("document.querySelector('[role=dialog]').getBoundingClientRect().toJSON()");
    assert.ok(dialog.top >= 0 && dialog.bottom <= height, 'Friend dialog fits mobile viewport');
    await evaluate("document.querySelector('[aria-label=\"Закрыть\"]').click()");
    await waitFor("!document.querySelector('[role=dialog]')");
    assert.equal(await evaluate("document.activeElement === document.querySelector('.mobile-arena-footer button')"), true, 'Closing the friend dialog restores focus to its visible trigger');
    console.log('PASS larger board, centered time grid, selection/close/focus and friend dialog at', width, height);
  }
  await cdp('Page.navigate', { url:'about:blank' });
  await waitFor("location.href === 'about:blank'");
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:false, width:1440, height:900, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/play?desktop-qa=arena' });
  await waitFor("!!document.querySelector('.arena-play-panel .online-lobby')");
  assert.equal(await evaluate("document.querySelectorAll('.arena-quick-times button').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('.mobile-arena-panel').length"), 0);
  assert.equal(await evaluate("document.querySelector('[role=switch]').getAttribute('aria-checked')"), 'false');
  console.log('PASS desktop golden arena and opt-in readiness preserved');
 } catch (error) {
  // Print the actual failing assertion before cleanup; a stuck child must not
  // mask it behind the outer watchdog's generic timeout.
  console.error('FAIL mobile browser check:', error);
  throw error;
} finally {
  // Closing a CDP socket can leave a pending Browser.close response unresolved.
  // Terminate the disposable browser after assertions and bound all cleanup.
  try { ws?.close(); } catch { /* Already disconnected. */ }
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    let cleanupTimer;
    await Promise.race([
      new Promise(done => { chrome.once('exit', done); if (!chrome.kill('SIGKILL')) done(); }),
      new Promise(done => { cleanupTimer = setTimeout(done, 3000); }),
    ]);
    clearTimeout(cleanupTimer);
  }
  server.closeAllConnections();
  let serverTimer;
  await Promise.race([
    new Promise(done => server.close(done)),
    new Promise(done => { serverTimer = setTimeout(done, 3000); }),
  ]);
  clearTimeout(serverTimer);
  if (profile) await rm(profile, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
  clearTimeout(deadline);
}
