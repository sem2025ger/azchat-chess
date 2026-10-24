import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('email recovery and sign-in callbacks preserve production and unique QA origins with explicit play intent', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { authCallbackUrl } = await server.ssrLoadModule('/src/lib/authCallbackUrl.ts');
    for (const origin of ['https://chessaz.de', 'https://chessaz-preview-workspace-68bwdot2r-semov20207-3068s-projects.vercel.app']) {
      for (const path of ['/profile', '/update-password']) {
        const callback = new URL(authCallbackUrl(origin, path, false, true));
        assert.equal(callback.origin, origin);
        assert.equal(callback.pathname, path);
        assert.equal(callback.searchParams.get('returnTo'), '/play');
      }
    }
    assert.equal(new URL(authCallbackUrl('https://chessaz.de', '/profile', true, true)).searchParams.get('returnTo'), '/chat');
  } finally { await server.close(); }
});
