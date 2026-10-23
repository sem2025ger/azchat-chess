import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('real recovery screen offers retry for expired links and only verified recovery reveals password fields', async () => {
  const originals = Object.fromEntries(['window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hash: '' } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ru' } });
  const server = await createServer({
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{ name: 'qa-recovery-state', enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:recovery-state' || id.endsWith('/context/AuthContext')) return '\0qa-recovery-state';
        if (id.endsWith('/services/supabase')) return '\0qa-recovery-service';
      },
      load(id) {
        if (id === '\0qa-recovery-state') return 'let state; export const setAuthState = value => { state = value }; export const useAuth = () => state;';
        if (id === '\0qa-recovery-service') return 'export const supabase = { auth: {} };';
      },
    }],
  });
  try {
    const { default: Screen } = await server.ssrLoadModule('/src/screens/UpdatePasswordScreen.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { setAuthState } = await server.ssrLoadModule('virtual:recovery-state');
    const render = (state, path = '/update-password') => {
      setAuthState(state);
      return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
        createElement(LanguageProvider, null, createElement(Screen))));
    };
    const ordinary = { user: { id: 'qa-user', email: 'qa@example.invalid' }, isLoading: false, passwordRecoveryVerified: false };
    const invalid = render(ordinary, '/update-password?error_code=otp_expired');
    assert.match(invalid, /role="alert"/);
    assert.match(invalid, /Запросить новую ссылку/);
    const emailInput = invalid.match(/<input[^>]*id="recovery-email"[^>]*>/)?.[0] || '';
    assert.match(emailInput, /name="email"/);
    assert.match(emailInput, /type="email"/);
    assert.doesNotMatch(invalid, /id="new-password"/);
    assert.doesNotMatch(render(ordinary), /id="new-password"/, 'An ordinary logged-in session is not recovery');
    const verified = { ...ordinary, passwordRecoveryVerified: true };
    const valid = render(verified);
    assert.match(valid, /id="new-password"/);
    assert.match(valid, /id="confirm-password"/);
    assert.doesNotMatch(valid, /disabled=""/);
    assert.doesNotMatch(render(verified, '/update-password?error_code=otp_expired'), /id="new-password"/);
    const checking = render({ user: null, isLoading: true, passwordRecoveryVerified: false });
    assert.match(checking, /Проверяем ссылку восстановления/);
    assert.doesNotMatch(checking, /role="alert"|id="new-password"/);
  } finally {
    await server.close();
    for (const key of Object.keys(originals)) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]); else delete globalThis[key];
    }
  }
});
