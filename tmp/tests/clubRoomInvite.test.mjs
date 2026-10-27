import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
test('invite return targets survive auth callbacks without introducing redirects to another origin', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { inviteReturnTarget, inviteAuthCallbackUrl, clubReturnTarget } = await server.ssrLoadModule('/src/lib/authCallbackUrl.ts');
    const target = '/schach-treff/einladung/' + 'a'.repeat(32);
    assert.equal(inviteReturnTarget(target), target);
    for (const value of [null, '//evil.example', 'https://evil.example', target + '?next=//evil.example', '/chat', '/schach-treff/einladung/invalid']) assert.equal(inviteReturnTarget(value), null);
    assert.equal(clubReturnTarget(target), null, 'legacy club validator retains its original scope');
    for (const path of ['/profile', '/update-password']) {
      const url = new URL(inviteAuthCallbackUrl('https://chessaz.de', path, target));
      assert.equal(url.origin, 'https://chessaz.de');
      assert.equal(url.pathname, path);
      assert.equal(url.searchParams.get('returnTo'), target);
    }
    assert.equal(new URL(inviteAuthCallbackUrl('https://chessaz.de', '/profile', '//evil.example')).searchParams.has('returnTo'), false);
  } finally { await server.close(); }
});
