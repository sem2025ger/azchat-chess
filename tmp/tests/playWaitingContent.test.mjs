import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('waiting windows keep search timer and invitation actions in their respective states', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Content } = await server.ssrLoadModule('/src/components/PlayWaitingContent.tsx');
    const props = { title:'Поиск противника…', description:'Ожидание соперника', copied:false, copyLabel:'Копировать', cancelLabel:'Отмена', onCopy() {}, onCancel() {} };
    const search = renderToStaticMarkup(createElement(Content, { ...props, elapsed:'0:09' }));
    assert.match(search, /<h2[^>]*>Поиск противника…<\/h2>/);
    assert.match(search, /play-waiting-timer/);
    assert.match(search, />0:09<\/span>/);
    assert.doesNotMatch(search, /<input|play-waiting-invite|scale-75|scale-90/);
    assert.equal((search.match(/<button /g) || []).length, 1);

    const url = 'https://chessaz.de/play?room=test-room';
    const friend = renderToStaticMarkup(createElement(Content, { ...props, title:'Waiting for friend...', inviteUrl:url }));
    assert.match(friend, /Waiting for friend/);
    assert.match(friend, /<label[^>]*for="play-waiting-invite-url"/);
    assert.match(friend, /readOnly="" value="https:\/\/chessaz.de\/play\?room=test-room"/);
    assert.match(friend, /aria-label="Копировать"/);
    assert.doesNotMatch(friend, /play-waiting-timer/);
    assert.equal((friend.match(/<button /g) || []).length, 2);
    const copied = renderToStaticMarkup(createElement(Content, { ...props, copied:true, copyLabel:'Скопировано', inviteUrl:url }));
    assert.match(copied, /aria-label="Скопировано"/);

    const connecting = renderToStaticMarkup(createElement(Content, { ...props, title:'Joining private room...' }));
    assert.doesNotMatch(connecting, /play-waiting-timer|<input/);
  } finally { await server.close(); }
});
