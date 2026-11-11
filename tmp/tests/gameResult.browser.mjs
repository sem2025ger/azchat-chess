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
      localStorage.setItem('chess_confirmMobileMoves','true');
      localStorage.setItem('chess_background', ['Soft Graphite', 'Champagne Light', 'Deep Space'][color === 'w' ? 0 : 1]);
      localStorage.setItem(`sb-${supabaseHost}-auth-token`,JSON.stringify({access_token:'layout-fixture',refresh_token:'layout-fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:profiles[color === 'w' ? 0 : 1].id,user_metadata:{username:color === 'w' ? 'QA White':'QA Black'}}}));
      window.__uci = [];
      window.Worker = class {
        onmessage;
        constructor() { window.__engineReply = data => this.onmessage?.({data}); }
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
      const slots = page.locator('[data-live-game-layout] [data-engine-slot]');
      const pvBounds = async () => Promise.all([page.locator('.analysis-engine-content').boundingBox(), ...[1,2,3].map(slot => page.locator(`[data-engine-slot="${slot}"]`).boundingBox())]);
      const assertSamePvBounds = (before, after) => {
        for (let i=0;i<before.length;i++) for (const dimension of ['x','y','width','height']) assert.ok(Math.abs(before[i][dimension]-after[i][dimension]) < 1,`PV ${i}/${dimension} moved (${before[i][dimension]} -> ${after[i][dimension]})`);
      };
      let stablePvBounds;

      const clock = row => row.locator('.font-mono');
      const clockSeconds = async row => (await clock(row).innerText()).split(':').reduce((minutes, seconds) => minutes * 60 + Number(seconds), 0);
      const whiteRow = color === 'w' ? self : opponent;
      const blackRow = color === 'b' ? self : opponent;
      if (index < 2) {
        assert.equal(await clockSeconds(whiteRow),178,'White clock belongs to the white player');
        assert.equal(await clockSeconds(blackRow),177,'Black clock belongs to the black player');
        const expectRunning = async (running, stopped) => {
          const beforeRunning = await clockSeconds(running), beforeStopped = await clockSeconds(stopped);
          await page.waitForTimeout(1200);
          assert.ok(await clockSeconds(running) < beforeRunning,'Side to move counts down');
          assert.equal(await clockSeconds(stopped),beforeStopped,'Other side stays stopped');
        };
        await expectRunning(whiteRow, blackRow);
        game.move('a3');
        snapshot.fen = game.fen(); snapshot.history = game.history(); snapshot.whiteTime = 175;
        send('update_board',snapshot);
        await page.locator('[data-piece-square="a3"]').waitFor();
        await expectRunning(blackRow, whiteRow);
        game.move('a6');
        snapshot.fen = game.fen(); snapshot.history = game.history(); snapshot.blackTime = 174;
        send('update_board',snapshot);
        await page.locator('[data-piece-square="a6"]').waitFor();
        await expectRunning(whiteRow, blackRow);
        // Resync supplies final authoritative times before the game is ended.
        send('update_board',snapshot);
        await page.waitForTimeout(50);
        console.log(`PASS ${color}: clock ownership and white -> black -> white countdown`);
      }
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
      if (width >= 768) {
        assert.equal(await slots.count(),3,'Three pending PV slots before first result');
        stablePvBounds = await pvBounds();
        for (const [depth,length] of [[8,2],[18,24],[24,3]]) {
          const updates = Array.from({length:3},(_,index) => {
            const position = new Chess(game.fen()), pv = [];
            for (let ply=0;ply<length;ply++) {
              const legal = position.moves({verbose:true}).sort((a,b)=>b.san.length-a.san.length);
              if (!legal.length) break;
              const move = legal[index % legal.length];
              pv.push(move.from+move.to+(move.promotion||'')); position.move(move);
            }
            return `info depth ${depth} multipv ${index+1} score cp ${index === 0 ? 25 : index === 1 ? -30 : 0} pv ${pv.join(' ')}`;
          });
          await page.evaluate(updates => updates.forEach(line => window.__engineReply(line)),updates);
          await page.waitForFunction(depth => document.querySelector('.analysis-stockfish-depth')?.textContent?.includes(String(depth)),depth);
          assertSamePvBounds(stablePvBounds,await pvBounds());
          const badge = slots.first().locator('.analysis-engine-score');
          const badgeRect = await badge.boundingBox();
          assert.ok(badgeRect.width <= 54 && badgeRect.height <= 26,'Compact score badge');
          assert.notEqual(await badge.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)','Subdued positive evaluation');
          if (captureDir && depth === 18) await page.screenshot({path:`${captureDir}/analysis-lines-${width}.png`});
        }
      }
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
      const play = async (from, to) => {
        for (const square of [from, to]) {
          const cell = page.locator(`[data-square="${square}"]:not([data-piece-square])`);
          await cell.scrollIntoViewIfNeeded();
          const box = await cell.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }
      };
      const previousMove = async () => {
        if (width >= 768) await page.getByRole('button',{name:'Предыдущий ход',exact:true}).click();
        else await page.locator('[data-live-game-navigation] button').nth(1).click();
      };
      const expectFen = async fen => page.waitForFunction(fen => window.__uci.at(-1) !== undefined && window.__uci.includes('position fen '+fen),fen);
      // Invalid moves remain rejected, but legal moves for either colour now work locally.
      await play('f3','f5');
      assert.equal(await page.locator('[data-piece-square="f5"]').count(),0);
      await play('f3','g5');
      await page.waitForFunction(() => document.querySelector('[data-piece-square="g5"]'),null,{timeout:3000});
      const variation = new Chess(game.fen()); variation.move('Ng5');
      await expectFen(variation.fen());
      if (stablePvBounds) assertSamePvBounds(stablePvBounds,await pvBounds());
      await play('g8','f6');
      await page.waitForFunction(() => document.querySelector('[data-piece-square="f6"]'));
      variation.move('Nf6'); await expectFen(variation.fen());
      assert.equal(commands.filter(([name]) => name === 'make_move').length,sentBefore, 'Analysis sends no live moves');
      // Stale socket delivery, recovery and rejections must not overwrite the local variation.
      send('game_over',{roomId:snapshot.roomId,...snapshot.outcome});
      send('update_board',snapshot);
      send('reconnect_success',snapshot);
      send('move_rejected',{reason:'game_over'});
      send('reconnect_failed',{roomId:snapshot.roomId,reason:'room_not_found'});
      await page.waitForTimeout(100);
      assert.equal(await dialog.count(),0);
      assert.equal(await page.locator('[data-piece-square="g5"]').count(),1);
      assert.equal(await page.locator('[data-piece-square="f6"]').count(),1);
      assert.ok(page.url().includes('roomId=layout-fixture'));
      assert.equal(await clockSeconds(opponent),color === 'w' ? snapshot.blackTime : snapshot.whiteTime);
      assert.equal(await clockSeconds(self),color === 'w' ? snapshot.whiteTime : snapshot.blackTime);
      await previousMove();
      await page.waitForFunction(() => document.querySelector('[data-piece-square="g8"]'));
      await previousMove();
      await page.waitForFunction(() => document.querySelector('[data-piece-square="f3"]'));
      // Branch from the original final ply, replacing the previous analysis continuation.
      await play('d2','d4');
      await page.waitForFunction(() => document.querySelector('[data-piece-square="d4"]'));
      await play('c5','d4');
      await page.waitForFunction(() => !document.querySelector('[data-piece-square="c5"]'));
      const branched = new Chess(game.fen()); branched.move('d4'); branched.move('cxd4');
      await expectFen(branched.fen());
      assert.equal(await page.locator('[data-piece-square="d4"] img').getAttribute('alt'),'bP');
      assert.equal(commands.filter(([name]) => name === 'make_move').length,sentBefore);
      assert.deepEqual(snapshot.history,game.history(),'Recorded game remains unchanged');
      if (captureDir && index === 0) await page.screenshot({path:`${captureDir}/live-review.png`});
      console.log(`PASS ${language} ${width}x${height} ${color}: stable board, local moves for both sides, branching, FEN, replay and socket isolation`);
      assert.deepEqual(errors,[]);
      // A fresh result still opens and the new-game button returns to the lobby.
      await page.reload({waitUntil:'domcontentloaded'});
      await dialog.waitFor();
      await dialog.getByRole('button',{name:newGame,exact:true}).click();
      await page.waitForURL(url => url.pathname === '/play' && !url.searchParams.has('roomId'));
    } finally { await page.close(); }
  }
}
