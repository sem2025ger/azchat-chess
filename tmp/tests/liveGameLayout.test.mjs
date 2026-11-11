import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../server/node_modules/playwright/index.mjs';
import { build, preview } from 'vite';

test('desktop online game keeps the opponent and clock clear of the top edge', { timeout: 60_000 }, async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const outDir = await mkdtemp(join(tmpdir(), 'chessaz-live-layout-'));
  let server;
  try {
    // Use a stable bundle so lazy route loads cannot trigger dev dependency reloads.
    await build({ root, logLevel: 'error', build: { outDir } });
    server = await preview({ root, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
    const executablePath = process.env.CHROME_BIN
      || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-gpu'], timeout: 12_000 });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const base = server.resolvedUrls.local[0];
      await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      page.setDefaultTimeout(8_000);
      const gameUrl = base + 'play?roomId=layout-test&color=b';
      const opponent = page.locator('[data-live-game-player="opponent"]');
      const player = page.locator('[data-live-game-player="self"]');
      const topSquare = page.locator('[data-square="h1"]:not([data-piece-square])');
      const bottomSquare = page.locator('[data-square="a8"]:not([data-piece-square])');

      for (const [width, height] of [[1536, 864], [1366, 768], [1024, 600]]) {
        await page.setViewportSize({ width, height });
        await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
        await opponent.waitFor();
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
    await server?.close();
    await rm(outDir, { recursive: true, force: true });
  }
});
