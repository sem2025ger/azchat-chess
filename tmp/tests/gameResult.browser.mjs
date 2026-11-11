import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { mkdir } from 'node:fs/promises';

// All auth, socket and engine responses below are synthetic and browser-local.
// No requests or game actions reach a real account, database or server.
export async function verifyGameResult(browser, base, { supabaseHost = 'fixture', socketPattern = /127\.0\.0\.1:6129\/socket\.io\//, captureDir = process.env.LIVE_GAME_CAPTURE } = {}) {
  if (captureDir) await mkdir(captureDir, {recursive:true});
  const profiles = [{id:'11111111-1111-4111-8111-111111111111',username:'QA White'}, {id:'22222222-2222-4222-8222-222222222222',username:'QA Black'}];
  const locales = {
    ru: ['Новая партия', 'Закрыть результат'], de: ['Neue Partie', 'Ergebnis schließen'],
    en: ['New game', 'Close result'], az: ['Yeni partiya', 'Nəticəni bağla'],
    tr: ['Yeni oyun', 'Sonucu kapat'], ua: ['Нова партія', 'Закрити результат'],
  };
  const sizes = [[1536,864], [1366,768], [1024,600], [768,1024], [390,844], [360,640]];
  for (const [index, [language, [newGame, close]]] of Object.entries(locales).entries()) {
    const [width,height] = sizes[index];
    const color = index % 2 ? 'b' : 'w';
    const page = await browser.newPage({ viewport: {width,height}, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const game = new Chess();
    for (const san of ['e4','c5','Nf3','d6']) game.move(san);
    const snapshot = {roomId:'layout-fixture',color,fen:game.fen(),history:game.history(),initialFen:new Chess().fen(),playerIds:{w:profiles[0].id,b:profiles[1].id},whiteTime:178,blackTime:177,status:'active'};
    const commands = [];
    let send;
    await page.addInitScript(({language, color, profiles, supabaseHost}) => {
      localStorage.setItem('app-language',language);
      localStorage.setItem('chess_background', ['Soft Graphite', 'Champagne Light', 'Deep Space'][color === 'w' ? 0 : 1]);
      localStorage.setItem(`sb-${supabaseHost}-auth-token`,JSON.stringify({access_token:'layout-fixture',refresh_token:'layout-fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:profiles[color === 'w' ? 0 : 1].id,user_metadata:{username:color === 'w' ? 'QA White':'QA Black'}}}));
      window.__uci = [];
      window.Worker = class {
        onmessage;
        postMessage(message) {
          window.__uci.push(message);
          if (message === 'uci' || message === 'isready') setTimeout(() => this.onmessage?.({data:message === 'uci' ? 'uciok' : 'readyok'}),0);
          if (message === 'stop') setTimeout(() => this.onmessage?.({data:'bestmove a2a3'}),0);
        }
        terminate() {}
      };
    }, {language,color,profiles,supabaseHost});
    await page.routeWebSocket(socketPattern, ws => {
      send = (name,data) => ws.send('42'+JSON.stringify([name,data]));
      ws.onMessage(message => {
        if (message.startsWith('40')) ws.send('40'+JSON.stringify({sid:'layout-fixture'}));
        if (message.startsWith('42')) {
          const [name,data] = JSON.parse(message.slice(2));
          commands.push([name,data]);
          if (name === 'reconnect_game') send('reconnect_success',snapshot);
        }
      });
      ws.send('0'+JSON.stringify({sid:'layout-engine',upgrades:[],pingInterval:25000,pingTimeout:20000,maxPayload:1000000}));
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === `${supabaseHost}.supabase.co`) return route.fulfill({json:url.searchParams.get('id')?.startsWith('eq.') ? profiles[color === 'w' ? 0 : 1] : profiles,headers:{'access-control-allow-origin':'*'}});
      return url.origin === new URL(base).origin ? route.continue() : route.abort();
    });
    page.setDefaultTimeout(8_000);
    try {
      await page.goto(base+'play?roomId=layout-fixture&color='+color, {waitUntil:'domcontentloaded'});
      await page.getByText(color === 'w' ? 'QA Black' : 'QA White',{exact:true}).first().waitFor();
      const grid = page.locator('.live-game-chessboard > .aspect-square');
      const opponent = page.locator('[data-live-game-player="opponent"]');
      const self = page.locator('[data-live-game-player="self"]');
      const geometry = async () => Promise.all([grid.boundingBox(),opponent.boundingBox(),self.boundingBox()]);
      const before = await geometry();
      assert.equal(await page.getByRole('dialog').count(),0);
      assert.equal(await page.locator('.live-game-evaluation').isVisible(),false);
      assert.ok(!(await page.evaluate(() => window.__uci)).some(cmd => cmd.startsWith('go ')), 'No engine searches during a live game');
      const ranks = page.locator('.live-game-chessboard [data-coordinate-axis="rank"]');
      const files = page.locator('.live-game-chessboard [data-coordinate-axis="file"]');
      assert.deepEqual(await ranks.locator('span').allTextContents(),color === 'w' ? ['8','7','6','5','4','3','2','1'] : ['1','2','3','4','5','6','7','8']);
      assert.deepEqual(await files.locator('span').allTextContents(),color === 'w' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a']);
      const rankRect = await ranks.boundingBox(), fileRect = await files.boundingBox();
      assert.ok(rankRect.x + rankRect.width <= before[0].x, 'Ranks outside grid');
      assert.ok(fileRect.y >= before[0].y + before[0].height, 'Files outside grid');
      assert.ok(before[0].width > 0 && Math.abs(before[0].width-before[0].height) < 1, 'Square grid');
      assert.ok(before[0].y >= before[1].y + before[1].height && fileRect.y + fileRect.height <= before[2].y, 'Coordinates and players do not overlap');
      if (captureDir && index === 0) await page.screenshot({path:`${captureDir}/live-before.png`});
      snapshot.status = 'ended'; snapshot.outcome = {reason:'resignation',endedBy:color};
      send(index % 2 ? 'update_board' : 'game_over', index % 2 ? snapshot : {roomId:snapshot.roomId,...snapshot.outcome});
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByRole('button',{name:newGame,exact:true}).waitFor();
      await page.waitForFunction(() => window.__uci.some(command => command.startsWith('position fen ')));
      assert.ok((await page.evaluate(() => window.__uci)).includes('position fen '+game.fen()),'Analysis uses exact final FEN');
      const after = await geometry();
      for (let i=0;i<before.length;i++) for (const dimension of ['x','y','width','height']) assert.ok(Math.abs(before[i][dimension]-after[i][dimension]) < 1,`${width}x${height}: stable ${i}/${dimension} (${before[i][dimension]} -> ${after[i][dimension]})`);
      if (captureDir) await page.screenshot({path:`${captureDir}/live-result-${width}.png`});
      if (index % 2) await page.keyboard.press('Escape');
      else await dialog.getByRole('button',{name:close,exact:true}).click();
      assert.equal(await dialog.count(),0);
      assert.equal(await page.locator('[data-game-result-overlay]').count(),0);
      assert.ok(page.url().includes('roomId=layout-fixture'));
      assert.equal(await page.locator('[data-piece-square="f3"]').count(),1, 'Final position preserved');
      const sentBefore = commands.filter(([name]) => name === 'make_move').length;
      const source = await page.locator('[data-square="f3"]:not([data-piece-square])').boundingBox();
      await page.mouse.click(source.x + source.width / 2, source.y + source.height / 2);
      await page.locator('[data-square="g5"]:not([data-piece-square])').click();
      assert.equal(commands.filter(([name]) => name === 'make_move').length,sentBefore, 'Dismiss never re-enables live moves');
      // Duplicated terminal delivery / reconnect must not reopen the dismissed result.
      send('game_over',{roomId:snapshot.roomId,...snapshot.outcome});
      send('reconnect_success',snapshot);
      if (width >= 768) {
        await page.getByRole('button',{name:'Предыдущий ход',exact:true}).click();
        await page.waitForFunction(() => document.querySelector('[data-piece-square="d7"]'));
      } else {
        await page.locator('[data-live-game-navigation] button').nth(1).click();
        await page.waitForFunction(() => document.querySelector('[data-piece-square="d7"]'));
      }
      assert.equal(await dialog.count(),0);
      const previous = new Chess(); for (const san of ['e4','c5','Nf3']) previous.move(san);
      await page.waitForFunction(fen => window.__uci.includes('position fen '+fen),previous.fen());
      if (captureDir && index === 0) await page.screenshot({path:`${captureDir}/live-review.png`});
      console.log(`PASS ${language} ${width}x${height} ${color}: grid ${before[0].width.toFixed(1)}px, stable result, close, FEN and replay`);
      assert.deepEqual(errors,[]);
      // A fresh result still opens and the new-game button returns to the lobby.
      await page.reload({waitUntil:'domcontentloaded'});
      await dialog.waitFor();
      await dialog.getByRole('button',{name:newGame,exact:true}).click();
      await page.waitForURL(url => url.pathname === '/play' && !url.searchParams.has('roomId'));
    } finally { await page.close(); }
  }
}
