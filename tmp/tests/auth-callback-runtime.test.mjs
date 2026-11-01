import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('email callbacks preserve production and QA branch aliases without crossing origins', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { authCallbackUrl, inviteAuthCallbackUrl } = await server.ssrLoadModule('/src/lib/authCallbackUrl.ts');
    const origins = [
      'https://chessaz.de',
      'https://chessaz-preview-workspace.vercel.app',
      'https://chessaz-preview-workspace-git-7d9026-semov20207-3068s-projects.vercel.app',
      'https://chessaz-preview-workspace-git-abcd1234-semov20207-3068s-projects.vercel.app',
      'https://chessaz-preview-workspace-68bwdot2r-semov20207-3068s-projects.vercel.app',
    ];

    for (const origin of origins) {
      for (const path of ['/profile', '/update-password']) {
        const expectedOrigin = path === '/update-password' && origin.includes('-68bwdot2r-')
          ? 'https://chessaz-preview-workspace.vercel.app'
          : origin;
        const callback = new URL(authCallbackUrl(origin, path, false, true));
        assert.equal(callback.origin, expectedOrigin, `origin of ${path} callback from ${origin}`);
        assert.equal(callback.pathname, path);
        assert.equal(callback.searchParams.get('returnTo'), '/play');

        const clubCallback = new URL(authCallbackUrl(origin, path, true, false));
        assert.equal(clubCallback.origin, expectedOrigin);
        assert.equal(clubCallback.searchParams.get('returnTo'), '/chat');

        const invite = '/schach-treff/einladung/' + 'a'.repeat(32);
        const inviteCallback = new URL(inviteAuthCallbackUrl(origin, path, invite));
        assert.equal(inviteCallback.origin, expectedOrigin);
        assert.equal(inviteCallback.searchParams.get('returnTo'), invite);
      }
    }

    assert.equal(
      new URL(authCallbackUrl('https://chessaz.de', '/profile', true, true)).searchParams.get('returnTo'),
      '/chat',
    );
  } finally {
    await server.close();
  }
});
