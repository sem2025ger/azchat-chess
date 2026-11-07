import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const eventId = '11111111-1111-4111-8111-111111111111';
const invite = 'a'.repeat(64);
const target = '/spieltag?tab=turniere&tournament=' + eventId + '&invite=' + invite;
const profilePath = value => '/profile?' + new URLSearchParams({ returnTo: value });
const fixtureOrigin = 'https://tournament-auth-fixture.invalid';
const fixtureModule = '/__tournament_auth_fixture.tsx';
const fixtureSupabase = '\0tournament-auth-supabase';

const fixture = `
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from '/src/context/AuthContext.tsx';
import { LanguageProvider } from '/src/context/LanguageContext.tsx';
import ProfileScreen from '/src/screens/ProfileScreen.tsx';
import SpieltagScreen from '/src/screens/SpieltagScreen.tsx';

localStorage.setItem('app-language', 'en');
const event = {
  id: '${eventId}', name: 'Fixture Tournament', status: 'registration', board_count: 4,
  starts_at: new Date(Date.now() + 7200000).toISOString(),
  registration_deadline: new Date(Date.now() + 3600000).toISOString(),
  remaining_spots: 4, max_teams: 4, teams: [],
};
const fetchLocal = window.fetch;
window.fetch = async (input, options) => {
  const url = new URL(String(input), location.href);
  if (url.origin !== '${fixtureOrigin}') return fetchLocal(input, options);
  const root = '/api/team-tournaments';
  if (url.pathname === root) return Response.json({ tournaments: [], can_create: false });
  if ([root + '/' + event.id + '/self-service', root + '/' + event.id + '/self-service/public'].includes(url.pathname)) {
    return Response.json(event);
  }
  if (url.pathname === root + '/' + event.id + '/redeem') {
    window.fixtureInviteRead = options.method === 'POST' &&
      options.headers.Authorization === 'Bearer synthetic-session' &&
      JSON.parse(options.body).token === '${invite}';
    return Response.json({});
  }
  return Response.json({ code: 'not_found' }, { status: 404 });
};

function Pages() {
  window.fixtureNavigate = useNavigate();
  return <Routes>
    <Route path="/profile" element={<ProfileScreen />} />
    <Route path="/spieltag" element={<SpieltagScreen />} />
  </Routes>;
}
createRoot(document.getElementById('root')).render(
  <BrowserRouter><LanguageProvider><AuthProvider><Pages /></AuthProvider></LanguageProvider></BrowserRouter>,
);
`;

const supabase = `
const session = { access_token: 'synthetic-session', user: {
  id: '22222222-2222-4222-8222-222222222222', user_metadata: { username: 'FixtureCaptain' },
} };
let onAuthChange;
export const supabase = {
  auth: {
    async getSession() {
      const confirmed = location.hash === '#fixture-confirmed';
      if (confirmed) history.replaceState(history.state, '', location.pathname + location.search);
      return { data: { session: confirmed ? session : null } };
    },
    onAuthStateChange(listener) {
      onAuthChange = listener;
      return { data: { subscription: { unsubscribe() { onAuthChange = undefined; } } } };
    },
    async signInWithPassword() {
      onAuthChange('SIGNED_IN', session);
      return { error: null };
    },
    async signUp({ options }) {
      window.fixtureEmailRedirect = options.emailRedirectTo;
      return { data: { session: null }, error: null };
    },
    async signInWithOtp({ options }) {
      window.fixtureEmailRedirect = options.emailRedirectTo;
      return { error: null };
    },
  },
  async rpc() { return { data: true, error: null }; },
  from() {
    const query = {
      select() { return query; }, eq() { return query; }, or() { return query; },
      order() { return query; }, async single() { return { data: null, error: null }; },
      async limit() { return { data: [], error: null }; },
    };
    return query;
  },
};
`;

const fixturePlugin = {
  name: 'tournament-auth-browser-fixture',
  enforce: 'pre',
  resolveId(id) {
    if (id === fixtureModule) return id;
    if (/(?:^|\/)services\/supabase(?:\.ts)?$/.test(id)) return fixtureSupabase;
  },
  load(id) {
    if (id === fixtureModule) return fixture;
    if (id === fixtureSupabase) return supabase;
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!/^\/(?:profile|spieltag)(?:\?|$)/.test(req.url)) return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml(req.url,
        `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="${fixtureModule}"></script></body></html>`));
    });
  },
};

export async function checkTournamentAuth({ cdp, evaluate, wait, click }) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'chessaz-tournament-auth-'));
  let server;
  try {
    server = await createServer({
      configFile: false, envDir: false, cacheDir, plugins: [fixturePlugin, react()],
      server: { host: '127.0.0.1', port: 0, hmr: false },
      define: Object.fromEntries(Object.entries({
        VITE_SUPABASE_URL: fixtureOrigin,
        VITE_SERVER_URL: fixtureOrigin,
        VITE_TEAM_TOURNAMENTS_ENABLED: 'true',
        VITE_TEAM_TOURNAMENTS_M3_ENABLED: 'true',
        VITE_SPIELTAG_ENABLED: 'true',
      }).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
    });
    await server.listen();
    const origin = new URL(server.resolvedUrls.local[0]).origin;
    const open = path => cdp('Page.navigate', { url: origin + path });
    const fill = (type, value) => evaluate(`(() => {
      const input = document.querySelector('form input[type="${type}"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const submit = () => evaluate("document.querySelector('form').requestSubmit()");
    const loginForm = "document.querySelector('form input[type=email]')";
    const email = 'captain@fixture.invalid';
    const password = 'fixture-password';

    await cdp('Network.enable');
    await cdp('Network.setBlockedURLs', { urls: ['https://*'] });
    await open(target);
    await wait("document.querySelector('.team-tournament-actions a[href^=\"/profile?\"]')");
    await click('Sign in');
    await wait(loginForm);
    await fill('email', email);
    await fill('password', password);
    await submit();
    await wait("document.body.innerText.includes('Accept invitation')");
    assert.ok(await evaluate('location.pathname + location.search === ' + JSON.stringify(target)),
      'password sign-in returned to the exact invite URL');
    await click('Accept invitation');
    await wait('window.fixtureInviteRead === true');

    for (const action of ['Register', 'Sign in with email link']) {
      await open(profilePath(target));
      await wait(loginForm);
      await fill('email', email);
      if (action === 'Register') {
        await click(action);
        await fill('text', 'FixtureCaptain');
        await fill('password', password);
        await submit();
      } else {
        await click(action);
      }
      await wait('typeof window.fixtureEmailRedirect === "string"');
      const callback = new URL(await evaluate('window.fixtureEmailRedirect'));
      assert.equal(callback.origin, origin);
      assert.equal(callback.pathname, '/profile');
      assert.ok(callback.searchParams.get('returnTo') === target, action + ' carries the exact return target');
      // The email link comes from outside the app, so the callback must load a new document.
      await cdp('Page.navigate', { url: 'about:blank' });
      await wait('location.href === "about:blank"');
      await open(callback.pathname + callback.search + '#fixture-confirmed');
      await wait("document.body.innerText.includes('Accept invitation')");
      assert.ok(await evaluate('location.pathname + location.search === ' + JSON.stringify(target)),
        action + ' callback returned to the exact invite URL');
    }

    const foreign = profilePath('https://foreign.example/spieltag?tab=turniere');
    await evaluate('window.fixtureNavigate(' + JSON.stringify(foreign) + ')');
    await wait("document.body.innerText.includes('FixtureCaptain')");
    assert.equal(await evaluate('location.pathname + location.search'), foreign,
      'a foreign return target leaves a signed-in user on profile');
  } finally {
    await server?.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
}
