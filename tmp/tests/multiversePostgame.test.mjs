import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Chess } from 'chess.js';
import { chromium } from '../../server/node_modules/playwright/index.mjs';
import { build, preview } from 'vite';

// Synthetic auth and Socket.IO only; the genuine Stockfish worker plays the training moves.
// Nothing reaches a real account, database or game server.
const root = resolve(import.meta.dirname, '..');
const profiles = [{ id: '11111111-1111-4111-8111-111111111111', username: 'QA White' }, { id: '22222222-2222-4222-8222-222222222222', username: 'QA Black' }];

test('MULTIVERSE after a finished online game: dismiss, play Stockfish from the final position, return unchanged', { timeout: 180_000 }, async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'chessaz-multiverse-postgame-'));
  let server, browser;
  try {
    await build({ root, logLevel: 'error', define: {
      'import.meta.env.VITE_SERVER_URL': JSON.stringify('http://127.0.0.1:6129'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('layout-fixture'),
      'import.meta.env.VITE_CHESSAZ_MULTIVERSE': JSON.stringify('true'),
    }, build: { outDir } });
    server = await preview({ root, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
    const base = server.resolvedUrls.local[0];
    const executablePath = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-gpu'], timeout: 12_000 });

    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const game = new Chess();
      for (const san of ['e4', 'c5', 'Nf3', 'd6']) game.move(san);
      const snapshot = { roomId: 'mv-postgame', color: 'w', fen: game.fen(), history: game.history(), initialFen: new Chess().fen(), playerIds: { w: profiles[0].id, b: profiles[1].id }, whiteTime: 178, blackTime: 177, status: 'active' };
      const commands = [];
      let send;
      await page.addInitScript(({ profiles }) => {
        localStorage.setItem('app-language', 'ru');
        localStorage.setItem('chess_confirmMobileMoves', 'false');
        localStorage.setItem('chess_sound', 'Muted / Off');
        localStorage.setItem('sb-fixture-auth-token', JSON.stringify({ access_token: 'mv', refresh_token: 'mv', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: profiles[0].id, user_metadata: { username: 'QA White' } } }));
      }, { profiles });
      await page.routeWebSocket(/127\.0\.0\.1:6129\/socket\.io\//, ws => {
        send = (name, data) => ws.send('42' + JSON.stringify([name, data]));
        ws.onMessage(message => {
          if (message.startsWith('40')) ws.send('40' + JSON.stringify({ sid: 'mv-postgame' }));
          if (message.startsWith('42')) {
            const [name, data] = JSON.parse(message.slice(2));
            commands.push([name, data]);
            if (name === 'reconnect_game') send('reconnect_success', snapshot);
          }
        });
        ws.send('0' + JSON.stringify({ sid: 'mv-engine', upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1000000 }));
      });
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fixture.supabase.co') return route.fulfill({ json: url.searchParams.get('id')?.startsWith('eq.') ? profiles[0] : profiles, headers: { 'access-control-allow-origin': '*' } });
        return url.origin === new URL(base).origin ? route.continue() : route.abort();
      });
      page.setDefaultTimeout(10_000);
      try {
        await page.goto(base + 'play?roomId=mv-postgame&color=w', { waitUntil: 'domcontentloaded' });
        await page.getByText('QA Black', { exact: true }).first().waitFor();
        assert.equal(await page.locator('[data-testid=multiverse-play]').count(), 0, `${width}: no training during a live game`);

        snapshot.status = 'ended'; snapshot.outcome = { reason: 'resignation', endedBy: 'b' };
        send('game_over', { roomId: snapshot.roomId, ...snapshot.outcome });
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.equal(await page.locator('[data-testid=multiverse-play]').count(), 0, `${width}: no training before the result is dismissed`);
        await dialog.getByRole('button', { name: 'Закрыть результат', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });

        const panel = page.locator('[data-testid=multiverse-play]');
        await panel.waitFor();
        assert.equal(await panel.count(), 1, `${width}: exactly one training panel`);
        assert.equal(await page.locator('[data-testid=multiverse-variations]').count(), 1);
        if (width >= 1024) assert.equal(await page.locator('[data-postgame-multiverse] [data-testid=multiverse-play]').count(), 1, 'Desktop: panel in the right-hand analysis column');
        else {
          const boardBox = await page.locator('.live-game-chessboard').boundingBox();
          const panelBox = await panel.boundingBox();
          assert.ok(panelBox.y >= boardBox.y + boardBox.height, `Mobile: training panel below the board (${panelBox.y} vs ${boardBox.y + boardBox.height})`);
        }
        assert.equal(await page.locator('[data-piece-square="f3"]').count(), 1, 'Final position shown');
        const movesBefore = commands.filter(([name]) => name === 'make_move').length;
        const commandsBefore = commands.length;

        await panel.locator('select').nth(1).selectOption('4');
        await panel.getByRole('button', { name: 'Играть отсюда', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid=multiverse-play] [role=status]')?.textContent.trim() === 'Ваш ход');
        const click = async square => {
          const cell = page.locator(`[data-square="${square}"]`).first();
          await cell.scrollIntoViewIfNeeded();
          const box = await cell.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        };
        await click('b1'); await click('c3');
        await page.waitForFunction(() => document.querySelector('[data-testid=multiverse-moves]')?.textContent.trim().split(' ').length === 2, null, { timeout: 30_000 });
        const line = (await page.locator('[data-testid=multiverse-moves]').innerText()).trim();
        assert.match(line, /^Nc3 \S+$/, `${width}: human move plus real Stockfish reply (${line})`);
        if (process.env.MULTIVERSE_QA_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.MULTIVERSE_QA_SCREENSHOT_DIR, `postgame-training-${width}.png`) });
        await panel.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
        await page.locator('[data-testid=multiverse-variations] li').first().waitFor();

        await panel.getByRole('button', { name: 'Вернуться к анализу', exact: true }).click();
        await panel.getByRole('button', { name: 'Играть отсюда', exact: true }).waitFor();
        assert.equal(await page.locator('[data-piece-square="c3"]').count(), 0, 'Finished game restored (no training knight on c3)');
        assert.equal(await page.locator('[data-piece-square="f3"]').count(), 1, 'Finished game restored at the final position');
        assert.equal(commands.filter(([name]) => name === 'make_move').length, movesBefore, 'Training sends no live moves');
        assert.equal(commands.length, commandsBefore, `Training emits no socket events: ${JSON.stringify(commands.slice(commandsBefore))}`);
        assert.ok(page.url().includes('roomId=mv-postgame'));
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('chessaz.multiverse.branches.v1') || '[]'));
        assert.equal(stored.length, 1);
        assert.equal(stored[0].rootFen, game.fen(), 'Saved variation starts from the final game position');

        // Open hands the variation to the Analysis route; the finished game is never overwritten.
        await page.locator('[data-testid=multiverse-variations] li').first().getByRole('button', { name: 'Открыть', exact: true }).click();
        await page.waitForURL(url => new URL(url).pathname === '/game');
        const session = await page.evaluate(() => JSON.parse(localStorage.getItem('chess_analysis_session_v1') || 'null'));
        assert.deepEqual(session.moves.slice(0, 1), ['Nc3']);
        assert.equal(session.initialFen, game.fen());
        assert.deepEqual(errors, []);
        console.log(`PASS postgame MULTIVERSE ${width}x${height}: ${line}`);
      } finally { await page.close(); }
    }
  } finally {
    await browser?.close();
    await new Promise(done => server ? server.httpServer.close(done) : done());
    await rm(outDir, { recursive: true, force: true });
  }
});
