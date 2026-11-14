// ChessAZ MULTIVERSE real-browser regression (flag ON build). Uses the genuine
// Stockfish worker: play from a position, save, compare with engine scores, share
// by link, reopen, and verify the flag-OFF build renders nothing.
// Run: VITE_CHESSAZ_MULTIVERSE=true npx vite build --outDir dist-multiverse && node tests/multiverse.browser.mjs
// Optional: MULTIVERSE_DIST (default dist-multiverse), FLAG_OFF_DIST (default dist), CHROME_BIN, MULTIVERSE_QA_SCREENSHOT_DIR.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const flagOnDist = resolve(process.env.MULTIVERSE_DIST || 'dist-multiverse');
const flagOffDist = resolve(process.env.FLAG_OFF_DIST || 'dist');
assert.ok(existsSync(join(flagOnDist, 'index.html')), 'Build the flag-ON bundle first: VITE_CHESSAZ_MULTIVERSE=true npx vite build --outDir dist-multiverse');
assert.ok(existsSync(join(flagOffDist, 'index.html')), 'Run npm run build first (flag-OFF bundle)');
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.mp3':'audio/mpeg', '.mp4':'video/mp4' };
const serve = dist => createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
    const target = extname(file) ? file : join(dist, 'index.html');
    response.setHeader('Content-Type', mime[extname(target)] || 'application/octet-stream');
    response.end(await readFile(target));
  } catch { response.writeHead(404).end(); }
});
const onServer = serve(flagOnDist);
const offServer = serve(flagOffDist);

let chrome;
let ws;
let profile;
const deadline = setTimeout(() => {
  console.error('FAIL multiverse browser regression exceeded 240 seconds');
  chrome?.kill('SIGKILL');
  onServer.closeAllConnections();
  offServer.closeAllConnections();
  process.exit(1);
}, 240000);
try {
  for (const server of [onServer, offServer]) await new Promise((done, fail) => server.listen(0, '127.0.0.1', error => error ? fail(error) : done()));
  const base = 'http://127.0.0.1:' + onServer.address().port;
  const offBase = 'http://127.0.0.1:' + offServer.address().port;
  const binary = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(binary, 'Chrome/Chromium required; set CHROME_BIN');
  profile = await mkdtemp(join(tmpdir(), 'chessaz-multiverse-'));
  chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--no-first-run', '--disable-background-networking', '--remote-allow-origins=*', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, ...JSON.parse(process.env.CHROME_ARGS || '[]'), 'about:blank'], { stdio:['ignore','ignore','pipe'] });
  let stderr = '';
  let launchError;
  chrome.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  chrome.on('error', error => { launchError = error; });
  const pause = (ms = 100) => new Promise(done => setTimeout(done, ms));
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
  const pageErrors = [];
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
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
  const waitFor = async (expression, attempts = 400) => {
    for (let n = 0; n < attempts; n++) {
      try { if (await evaluate(expression)) return; }
      catch (error) { if (!/context.*destroyed|Cannot find context|Inspected target navigated|Execution context was destroyed/i.test(String(error))) throw error; }
      await pause();
    }
    const state = await evaluate("JSON.stringify({url:location.href,ready:document.readyState,text:document.body?.innerText.slice(0,1200)})").catch(()=>'context unavailable');
    throw Error('UI timeout: ' + expression + '; ' + state);
  };
  const capture = async name => {
    if (!process.env.MULTIVERSE_QA_SCREENSHOT_DIR) return;
    await mkdir(process.env.MULTIVERSE_QA_SCREENSHOT_DIR, { recursive:true });
    const shot = await cdp('Page.captureScreenshot', { format:'png' });
    await writeFile(join(process.env.MULTIVERSE_QA_SCREENSHOT_DIR, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  const game = ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7','e3','O-O','Nf3','h6','Bh4','b6'];
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:`
    if (location.protocol !== 'http:') { /* about:blank has no storage */ } else {
    localStorage.setItem('app-language','ru');localStorage.setItem('chess_sound','Muted / Off');
    window.__copied = [];
    if (location.search.includes('multiverse-qa=desktop')) localStorage.setItem('chess_analysis_session_v1', JSON.stringify({version:1, moves:${JSON.stringify(game)}, viewMoveIndex:10, initialFen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}));
    if (location.search.includes('multiverse-qa=fresh')) { localStorage.removeItem('chessaz.multiverse.branches.v1'); localStorage.removeItem('chess_analysis_session_v1'); }
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: text => { window.__copied.push(text); return Promise.resolve(); } }, configurable: true });
    }
  ` });
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('missing ' + ${JSON.stringify(selector)}); el.click(); return true; })()`);
  const clickButton = (scope, text) => evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw Error('missing button ' + ${JSON.stringify(text)}); if (el.disabled) throw Error('disabled button ' + ${JSON.stringify(text)}); el.click(); return true; })()`);
  const boardMove = async (from, to) => {
    await evaluate(`document.querySelector('.desktop-analysis-main-board [data-square=${from}]').click()`);
    await evaluate(`document.querySelector('.desktop-analysis-main-board [data-square=${to}]').click()`);
  };
  const movesText = () => evaluate("document.querySelector('[data-testid=multiverse-moves]')?.textContent.trim()");
  const statusText = () => evaluate("document.querySelector('[data-testid=multiverse-play] [role=status]')?.textContent.trim()");
  const session = () => evaluate("JSON.parse(localStorage.getItem('chess_analysis_session_v1') || 'null')");
  const PLAY = '[data-testid=multiverse-play]';
  const VARS = '[data-testid=multiverse-variations]';

  // ---------- Desktop: play from a loaded game at move 7 ----------
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:false, width:1440, height:900, deviceScaleFactor:1 });
  const openTrainingTab = async () => {
    await waitFor("!!document.querySelector('.desktop-analysis-workspace-tabs')");
    await evaluate("[...document.querySelectorAll('.desktop-analysis-workspace-tabs button')].find(b => b.textContent.trim() === 'Тренировка').click()");
    await waitFor(`!!document.querySelector('${PLAY}') && !!document.querySelector('${VARS}')`);
  };
  await cdp('Page.navigate', { url:base + '/game?multiverse-qa=desktop' });
  await waitFor("!!document.querySelector('.desktop-analysis-workspace-tabs') && document.querySelectorAll('.desktop-analysis-workspace-tabs button').length === 4");
  assert.equal(await evaluate(`document.querySelector('${PLAY}')`), null, 'Analysis tab stays unchanged until Training is opened');
  await openTrainingTab();
  assert.equal(await evaluate(`document.querySelector('${PLAY} select').value`), 'w');
  await evaluate(`(() => { const s = document.querySelectorAll('${PLAY} select')[1]; s.value = '4'; s.dispatchEvent(new Event('change', { bubbles:true })); })()`);
  const originalSession = JSON.stringify(await session());
  await clickButton(PLAY, 'Играть отсюда');
  await waitFor(`document.querySelector('${PLAY} [role=status]')?.textContent.trim() === 'Ваш ход'`);
  // Position after 5...O-O (viewMoveIndex 9): White to move at move 6. Alternative: 6.Bd3 instead of 6.Nf3.
  await boardMove('f1', 'd3');
  await waitFor("document.querySelector('[data-testid=multiverse-moves]')?.textContent.trim().split(' ').length === 2", 600);
  assert.match(await movesText(), /^Bd3 \S+$/, 'Human move then an engine reply');
  assert.equal(await statusText(), 'Ваш ход');
  assert.equal(await evaluate("document.querySelector('.desktop-analysis-main-board [data-square]').dataset.square"), 'a8', 'White keeps the board oriented for White');
  assert.ok(await evaluate("document.querySelector('.desktop-analysis-board-frame').getBoundingClientRect().top < 200"), 'Board stays at the top of the desktop layout while training');
  await capture('desktop-play');
  await clickButton(PLAY, 'Сохранить вариант');
  await waitFor(`document.querySelector('${VARS} li') !== null`);
  assert.equal(JSON.stringify(await session()), originalSession, 'Saving a variation never touches the original analysis');
  console.log('PASS desktop play from move 6 alternative with real engine reply, saved: ' + await movesText());

  // Try again from the same root, choose a different first move, save again → comparable pair.
  await clickButton(PLAY, 'Попробовать снова');
  await waitFor(`document.querySelector('${PLAY} [role=status]')?.textContent.trim() === 'Ваш ход' && document.querySelector('[data-testid=multiverse-moves]')?.textContent.trim() === '—'`);
  await boardMove('g1', 'f3');
  await waitFor("document.querySelector('[data-testid=multiverse-moves]')?.textContent.trim().split(' ').length === 2", 600);
  await clickButton(PLAY, 'Сохранить вариант');
  await waitFor(`document.querySelectorAll('${VARS} li').length === 2 && !!document.querySelector('[data-testid=multiverse-compare]')`);
  await clickButton(PLAY, 'Вернуться к анализу');
  await waitFor(`!document.querySelector('[data-testid=multiverse-moves]') && document.querySelector('${PLAY} button')?.textContent.trim() === 'Играть отсюда'`);
  assert.equal(JSON.stringify(await session()), originalSession, 'Return to analysis restores the original game unchanged');
  assert.equal(await evaluate("document.querySelectorAll('.desktop-analysis-main-board [data-square=d3] img, .desktop-analysis-main-board [data-square=d3] [data-piece]').length"), 0, 'Board shows the original analysis position again');
  console.log('PASS try again, second variation, return to analysis');

  // ---------- Engine comparison ----------
  await clickButton('[data-testid=multiverse-compare]', 'Сравнить');
  await waitFor("document.querySelectorAll('[data-testid=multiverse-compare-row]').length === 2 && [...document.querySelectorAll('[data-testid=multiverse-compare-row] td')].every(td => td.textContent.trim() !== '…')", 1200);
  const rows = await evaluate("[...document.querySelectorAll('[data-testid=multiverse-compare-row]')].map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim()))");
  for (const [label, score, delta, critical] of rows) {
    assert.match(label, /^Вариант \d$/);
    assert.match(score, /^([+-]\d+\.\d\d|0\.00|#-?\d+|1-0|0-1|½-½)$/, 'Score format: ' + score);
    assert.match(delta, /^([+-]\d+\.\d\d|±0\.00)$/, 'Delta format: ' + delta);
    assert.ok(critical === 'Серьёзных ошибок нет' || /\(−\d+\.\d\d\)$/.test(critical), 'Critical move format: ' + critical);
  }
  assert.equal(await evaluate("[...document.querySelectorAll('[data-testid=multiverse-compare] button')].some(b => b.textContent.trim() === 'Сравнить' && !b.disabled)"), true, 'Compare finishes and re-enables');
  await capture('desktop-compare');
  console.log('PASS engine comparison rows: ' + JSON.stringify(rows));

  // ---------- Share link ----------
  await clickButton(VARS + ' li:first-child', 'Поделиться');
  await waitFor("window.__copied.length === 1");
  const link = await evaluate("window.__copied[0]");
  assert.match(link, new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/game\\?mv=[A-Za-z0-9_-]+$'), 'Share link: ' + link);
  await clickButton(VARS + ' li:first-child', 'Копировать PGN');
  await waitFor("window.__copied.length === 2");
  assert.match(await evaluate("window.__copied[1]"), /\[SetUp "1"\]\s*\[FEN "/, 'PGN carries the setup FEN');
  const firstMoves = await evaluate(`document.querySelector('${VARS} li:first-child span').title`);
  // Fresh browser state: the receiving side has no saved variations.
  await cdp('Page.navigate', { url:base + '/game?multiverse-qa=fresh' });
  await openTrainingTab();
  assert.equal(await evaluate(`document.querySelectorAll('${VARS} li').length`), 0);
  await cdp('Page.navigate', { url:link });
  await waitFor(`document.querySelectorAll('${VARS} li').length === 1 && !location.search.includes('mv=')`);
  assert.equal(await evaluate(`document.querySelector('${PLAY} [role=status]')?.textContent.trim()`), 'Открыт вариант по ссылке');
  const shared = await session();
  assert.equal(shared.moves.join(' '), firstMoves, 'Shared link reproduces the variation moves in Analysis');
  assert.equal(shared.initialFen.split(' ')[0], 'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR', 'Shared link reproduces the root position');
  await cdp('Page.navigate', { url:base + '/game?mv=%21%21not-a-payload' });
  await waitFor(`document.querySelector('${PLAY} [role=status]')?.textContent.trim() === 'Ссылка недействительна'`);
  assert.equal((await session()).moves.join(' '), firstMoves, 'Invalid link keeps the previous analysis');
  console.log('PASS share link round trip and invalid payload handling');

  // ---------- Black side, terminal position, flag off ----------
  await cdp('Page.navigate', { url:base + '/game?multiverse-qa=fresh' });
  await openTrainingTab();
  await cdp('Page.navigate', { url:base + '/game?multiverse-qa=black' });
  await openTrainingTab();
  await evaluate(`(() => { const s = document.querySelectorAll('${PLAY} select')[0]; s.value = 'b'; s.dispatchEvent(new Event('change', { bubbles:true })); const d = document.querySelectorAll('${PLAY} select')[1]; d.value = '4'; d.dispatchEvent(new Event('change', { bubbles:true })); })()`);
  await clickButton(PLAY, 'Играть отсюда');
  await waitFor("document.querySelector('[data-testid=multiverse-moves]')?.textContent.trim().split(' ').length === 1 && document.querySelector('[data-testid=multiverse-play] [role=status]')?.textContent.trim() === 'Ваш ход'", 600);
  assert.equal(await evaluate("document.querySelector('.desktop-analysis-main-board [data-square]').dataset.square"), 'h1', 'Black plays with the board flipped');
  await clickButton(PLAY, 'Вернуться к анализу');
  await cdp('Page.navigate', { url:base + '/game?fen=' + encodeURIComponent('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3') });
  await openTrainingTab();
  assert.equal(await evaluate(`[...document.querySelectorAll('${PLAY} button')].find(b => b.textContent.trim() === 'Играть отсюда').disabled`), true, 'Checkmate position cannot be played');
  console.log('PASS black side with engine first move; terminal position blocked');

  // ---------- Mobile layout ----------
  await cdp('Page.navigate', { url:'about:blank' });
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:true, width:390, height:844, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:base + '/game?multiverse-qa=mobile' });
  await waitFor("!!document.querySelector('[data-mobile-analysis-header]')");
  const mobile = await evaluate(`(() => { const el = document.querySelector('${PLAY}'); const r = el?.getBoundingClientRect(); return { present: !!el, scrollWidth: document.documentElement.scrollWidth, visible: !!el && getComputedStyle(el).display !== 'none' && r.width > 0, width: r?.width, left: r?.left }; })()`);
  assert.equal(mobile.scrollWidth, 390, 'No horizontal scroll on mobile');
  assert.ok(mobile.present && mobile.visible, 'Practice section renders on mobile: ' + JSON.stringify(mobile));
  assert.ok(await evaluate("document.querySelector('.desktop-analysis-board-frame').getBoundingClientRect().top < document.querySelector('[data-testid=multiverse-play]').getBoundingClientRect().top"), 'Mobile keeps the board above the practice section');
  await evaluate(`document.querySelector('${PLAY}').scrollIntoView()`);
  await capture('mobile-panel');
  console.log('PASS mobile layout keeps the practice section reachable');

  // ---------- Flag OFF build renders nothing ----------
  await cdp('Page.navigate', { url:'about:blank' });
  await cdp('Emulation.setDeviceMetricsOverride', { mobile:false, width:1440, height:900, deviceScaleFactor:1 });
  await cdp('Page.navigate', { url:offBase + '/game?multiverse-qa=off' });
  await waitFor("!!document.querySelector('.desktop-analysis-main-board')");
  assert.equal(await evaluate(`document.querySelector('${PLAY}')`), null, 'Flag OFF: no practice section');
  assert.equal(await evaluate(`document.querySelector('${VARS}')`), null, 'Flag OFF: no variations section');
  assert.equal(await evaluate("document.querySelectorAll('.desktop-analysis-workspace-tabs button').length"), 3, 'Flag OFF: original three workspace tabs');
  console.log('PASS flag OFF build has no MULTIVERSE UI');

  const fatal = pageErrors.filter(text => !/ResizeObserver|AbortError/.test(String(text)));
  assert.deepEqual(fatal, [], 'No uncaught page errors');
  console.log('PASS multiverse browser regression');
} finally {
  clearTimeout(deadline);
  ws?.close();
  chrome?.kill('SIGKILL');
  for (const server of [onServer, offServer]) { server.closeAllConnections(); server.close(); }
  if (profile) await rm(profile, { recursive:true, force:true, maxRetries:15, retryDelay:150 });
}
