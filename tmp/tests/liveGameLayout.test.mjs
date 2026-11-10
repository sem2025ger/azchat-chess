import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../server/node_modules/playwright/index.mjs';
import { createServer } from 'vite';

test('desktop online game keeps the opponent and clock clear of the top edge', { timeout: 30_000 }, async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  try {
    await server.listen();
    const executablePath = process.env.CHROME_BIN
      || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-gpu'] });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const gameUrl = server.resolvedUrls.local[0] + 'play?roomId=layout-test&color=b';
      const opponent = page.locator('[data-live-game-player="opponent"]');
      const player = page.locator('[data-live-game-player="self"]');
      const topSquare = page.locator('[data-square="h1"]:not([data-piece-square])');
      const bottomSquare = page.locator('[data-square="a8"]:not([data-piece-square])');

      for (const [width, height] of [[1536, 864], [1366, 768], [1024, 600]]) {
        await page.setViewportSize({ width, height });
        await page.goto(gameUrl);
        await page.evaluate(() => document.fonts.ready);
        await page.getByText('UNRATED', { exact: true }).waitFor();
        const [header, clock, top, bottom, footer] = await Promise.all([
          opponent.boundingBox(),
          opponent.getByText('10:00', { exact: true }).boundingBox(),
          topSquare.boundingBox(),
          bottomSquare.boundingBox(),
          player.boundingBox(),
        ]);
        const viewport = `${width}×${height}`;
        assert.ok(header && clock && top && bottom && footer, `Expected both player rows and the board at ${viewport}`);
        assert.ok(header.y >= 16, `Opponent row must start at least 16px below the top at ${viewport} (got ${header.y}px)`);
        assert.ok(clock.y >= header.y && clock.y + clock.height <= header.y + header.height, `Clock fits its row at ${viewport}`);
        assert.ok(header.y + header.height <= top.y && bottom.y + bottom.height <= footer.y, `Rows do not overlap the board at ${viewport}`);
        assert.ok(footer.y + footer.height <= height, `Both player rows fit at ${viewport}`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
