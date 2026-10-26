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
  console.error('FAIL play lobby browser regression exceeded 120 seconds');
  chrome?.kill('SIGKILL');
  server.closeAllConnections();
  process.exit(1);
}, 120000);
try {
  await new Promise((done, fail) => server.listen(0, '127.0.0.1', error => error ? fail(error) : done()));
  const base = 'http://127.0.0.1:' + server.address().port;
  const binary = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(binary, 'Chrome/Chromium required; set CHROME_BIN');
  profile = await mkdtemp(join(tmpdir(), 'chessaz-play-'));
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
  await cdp('Network.enable');
  // Geometry uses the built local app. No credentials or backend are needed.
  await cdp('Network.setBlockedURLs', { urls:['https://*', 'wss://*'] });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:`
    localStorage.setItem('app-language','en');
    window.__lobbyFrames = [];
    window.__lobbyLoadingFrames = 0;
    function sampleLobby() {
      const board = document.querySelector('.play-lobby-board');
      const panel = document.querySelector('.arena-play-panel, .mobile-arena-panel');
      if (location.pathname === '/play') {
        if (board && panel) {
          const bounds = element => {
            const {x,y,width,height} = element.getBoundingClientRect();
            return {x,y,width,height};
          };
          window.__lobbyFrames.push({board:bounds(board),panel:bounds(panel)});
        } else if (document.querySelector('main [aria-busy=true]')) {
          window.__lobbyLoadingFrames++;
        }
      }
      requestAnimationFrame(sampleLobby);
    }
    requestAnimationFrame(sampleLobby);
  ` });
  const checkFrames = async label => {
    await waitFor('window.__lobbyFrames?.length >= 50');
    const {frames,loading,images} = await evaluate(`({
      frames:window.__lobbyFrames,
      loading:window.__lobbyLoadingFrames,
      images:[...document.querySelectorAll('.play-lobby-board img')].filter(image=>!image.complete || !image.naturalWidth).length
    })`);
    assert.equal(loading, 0, label + ': lobby must render with the shell, without a route spinner');
    assert.equal(images, 0, label + ': piece artwork must load');
    for (const frame of frames) {
      for (const target of ['board','panel']) {
        for (const dimension of ['x','y','width','height']) {
          assert.ok(Math.abs(frame[target][dimension] - frames[0][target][dimension]) < 0.75,
            label + ': ' + target + ' must keep its first-painted geometry: ' + JSON.stringify({first:frames[0],frame}));
        }
      }
      assert.ok(Math.abs(frame.board.width-frame.board.height)<0.75, label + ': board stays square');
    }
    console.log('PASS ' + label + ': ' + frames.length + ' stable frames, no loading placeholder');
  };
  for (const [width,height] of [[1366,768],[1440,900],[1920,1080],[390,844]]) {
    await cdp('Emulation.setDeviceMetricsOverride', {mobile:width<768,width,height,deviceScaleFactor:1});
    await cdp('Network.clearBrowserCache');
    await cdp('Page.navigate', {url:base+'/play?lobby-qa='+width});
    await waitFor(`location.href === ${JSON.stringify(base+'/play?lobby-qa='+width)}`);
    await checkFrames('cold lobby '+width+'x'+height);
    const previousOrigin = await evaluate('performance.timeOrigin');
    await cdp('Page.reload', {ignoreCache:true});
    await waitFor(`performance.timeOrigin !== ${previousOrigin} && window.__lobbyFrames?.length >= 50`);
    await checkFrames('reload lobby '+width+'x'+height);
  }
  await cdp('Emulation.setDeviceMetricsOverride', {mobile:false,width:1440,height:900,deviceScaleFactor:1});
  await cdp('Page.navigate', {url:base+'/home'});
  await waitFor("!!document.querySelector('.desktop-home-play')");
  await evaluate("window.__lobbyFrames=[];window.__lobbyLoadingFrames=0;document.querySelector('.desktop-home-play').click()");
  await checkFrames('Home to Start Game');
  await evaluate("document.querySelector('.arena-selected-time').click()");
  await waitFor("document.querySelectorAll('.arena-time-options button').length === 9");
  await evaluate("[...document.querySelectorAll('.arena-time-options button')].find(button=>button.textContent==='5 min.').click()");
  assert.equal(await evaluate("document.querySelector('.arena-time-value').textContent"), '5 min.');
  console.log('PASS time selection remains interactive');
} finally {
  clearTimeout(deadline);
  ws?.close();
  chrome?.kill('SIGTERM');
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  if (profile) await rm(profile,{recursive:true,force:true,maxRetries:3});
}
