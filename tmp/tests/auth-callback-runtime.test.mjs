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


test('ephemeral QA URLs use only their own stable branch for magic links and recovery', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { authCallbackUrl } = await server.ssrLoadModule('/src/lib/authCallbackUrl.ts');
    const temporary = 'https://chessaz-preview-workspace-242gy0z38-semov20207-3068s-projects.vercel.app';
    const stable = 'https://chessaz-preview-workspace-git-3ada05-semov20207-3068s-projects.vercel.app';
    for (const path of ['/profile', '/update-password']) {
      for (const candidate of [stable, stable.slice('https://'.length)]) {
        const target = new URL(authCallbackUrl(temporary, path, false, true, candidate));
        assert.equal(target.origin, stable);
        assert.equal(target.pathname, path);
        assert.equal(target.searchParams.get('returnTo'), '/play');
      }
    }
    for (const bad of [undefined, '', 'https://chessaz-preview-workspace.vercel.app', 'https://chessaz.de', 'https://evil.example', 'https://chessaz-preview-workspace-git-main-semov20207-3068s-projects.vercel.app', 'https://chessaz-preview-workspace-git-3ada05-semov20207-3068s-projects.vercel.app.evil.example', 'https://chessaz-preview-workspace-git-3ada05-semov20207-3068s-projects.vercel.app/redirect']) {
      assert.throws(() => authCallbackUrl(temporary, '/profile', false, false, bad), /QA login not configured/);
    }
    assert.equal(authCallbackUrl(stable, '/profile', false, false, 'https://evil.example'), stable + '/profile');
    assert.equal(authCallbackUrl('https://chessaz.de', '/profile', false, false, stable), 'https://chessaz.de/profile');
  } finally {
    await server.close();
  }
});
