import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

test('Inter styles resolve locally for every existing weight and language subset', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/);
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    for (const weight of [300, 400, 500, 600, 700, 800, 900]) {
      assert.ok(main.includes(`import '@fontsource/inter/${weight}.css'`));
      const transformed = await server.transformRequest(`/node_modules/@fontsource/inter/${weight}.css`);
      assert.ok(transformed?.code);
      assert.doesNotMatch(transformed.code, /https?:\/\//);
      for (const subset of ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']) {
        assert.ok(transformed.code.includes(`inter-${subset}-${weight}-normal.woff2`));
      }
    }
  } finally { await server.close(); }
});
