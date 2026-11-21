import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const entry = '/__team_online_fixture.tsx';
const fixtureOrigin = 'https://team-online-fixture.invalid';
const fixture = `
import '/src/index.css';
import '/src/components/teamTournaments/teamTournaments.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Layout from '/src/components/Layout.tsx';
import { LanguageProvider, useLanguage } from '/src/context/LanguageContext.tsx';
import { ThemeProvider, useThemeContext } from '/src/context/ThemeContext.tsx';
import { premiumInterfaceThemes } from '/src/lib/interfaceThemes.ts';
import { M3Create, M3EventPanel } from '/src/components/teamTournaments/TeamTournamentsM3Panel.tsx';
import { TournamentRounds } from '/src/components/teamTournaments/TeamTournamentViews.tsx';
import MyTournamentCard from '/src/components/teamTournaments/MyTournamentCard.tsx';
import { tournamentCopy } from '/src/components/teamTournaments/copy.ts';

const id = '11111111-1111-4111-8111-111111111111';
const captain = '22222222-2222-4222-8222-222222222222';
const home = '33333333-3333-4333-8333-333333333333';
const away = '44444444-4444-4444-8444-444444444444';
const match = { id: away, round_no: 1, home_team_id: home, away_team_id: away, boards: [] };
const start = '2027-01-20T17:30:00.000Z';
const board = {
  tournament_id: id, tournament_name: 'Bochum Cup', match_id: match.id, round_no: 1,
  board_no: 1, opponent: 'WestBoard1', side: 'white', result: 'pending', status: 'pending',
  confirmed: false, starts_at: start,
};
const event = {
  id, name: 'Bochum Cup', status: 'registration', board_count: 2,
  starts_at: new Date(Date.now() + 7200000).toISOString(),
  registration_deadline: new Date(Date.now() + 3600000).toISOString(),
  remaining_spots: 0, max_teams: 2, teams: [{ id: home, name: 'Bochum Nord' }, { id: away, name: 'Bochum West' }],
  entries: [{ id: home, captain_id: captain, club_name: 'Bochum Nord', submitted_at: start, revision_pending: true }],
  profiles: [{ id: home, username: 'NorthBoard2' }, { id: away, username: 'NorthReserve' }],
  lineups: [captain, home].map((player_id, index) => ({ entry_id: home, player_id, board_no: index + 1, consented_at: start })),
  revision_lineups: [captain, away].map((player_id, index) => ({ entry_id: home, player_id, board_no: index + 1, consented_at: start })),
};
const official = { standings: [], matches: [] };
const draft = {
  name: 'AI Bochum Cup', start_time: '2031-12-20T15:00', registration_deadline: '2031-12-20T14:00',
  boards_per_team: 4, min_teams: 2, max_teams: 4, round_interval_minutes: 90,
};
window.fixtureCreates = [];
const nativeFetch = window.fetch;
window.fetch = async (input, options) => {
  const url = new URL(String(input), location.href);
  if (url.origin !== '${fixtureOrigin}') return nativeFetch(input, options);
  if (url.pathname.endsWith('/ai-organizer/plan')) {
    return Response.json({ ready: true, missing: [], question: null, assistant_text: 'Ready', draft });
  }
  if (url.pathname === '/api/team-tournaments/self-service' && options.method === 'POST') {
    window.fixtureCreates.push(JSON.parse(options.body));
    return Response.json({ code: 'temporarily_unavailable' }, { status: 503 });
  }
  if (url.pathname.endsWith('/my-board')) {
    const value = { ...board };
    if (window.fixtureUndated) delete value.starts_at;
    return Response.json({ board: value });
  }
  return Response.json(event);
};

function Showcase() {
  const { search } = useLocation();
  const { language, setLanguage } = useLanguage();
  const { background, setBackground } = useThemeContext();
  const navigate = useNavigate();
  const tr = tournamentCopy(language);
  window.fixtureNav = navigate;
  window.fixtureSelect = (locale, theme) => flushSync(() => { setLanguage(locale); setBackground(theme); });
  window.fixtureSelection = [language, background];
  window.fixtureThemes = ['Void Black','Deep Space','Velvet Gold','Champagne Light','Coffee Brown','Walnut Dark',
    'Emerald Night','Royal Blue','Royal Violet','Obsidian Gold', ...premiumInterfaceThemes.map(theme => theme.id)];
  const mode = new URLSearchParams(search).get('mode');
  if (mode === 'create') return <M3Create token="fixture-token" tr={tr} onCreated={() => {}} />;
  if (mode === 'lineup') return <M3EventPanel id={id} token="fixture-token" userId={captain} ownUsername="NorthCaptain" tr={tr} />;
  if (mode === 'myboard' || mode === 'undated-board') {
    window.fixtureUndated = mode === 'undated-board';
    return <MyTournamentCard key={mode} />;
  }
  return <section className="section-page team-tournament-page">
    <header><h1>Bochum Cup</h1></header>
    <TournamentRounds tr={tr} busy={false} names={{ [home]: 'Bochum Nord', [away]: 'Bochum West' }}
      event={{ status: 'published', rounds: [{ round_no: 1, bye_team_id: null, ...(mode === 'undated' ? {} : { starts_at: start }) }],
        matches: [match], official, provisional: official }} />
  </section>;
}
localStorage.setItem('app-language', 'en');
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter initialEntries={['/spieltag']}>
  <Routes><Route element={<Layout/>}><Route path="/spieltag" element={<Showcase />} /></Route></Routes>
</MemoryRouter></LanguageProvider></ThemeProvider>);
`;

const plugin = {
  name: 'online-team-tournament-browser-fixtures',
  enforce: 'pre',
  resolveId(id) {
    if (id === entry) return id;
    if (/(?:^|\/)context\/AuthContext(?:\.tsx)?$/.test(id)) return '\0team-online-auth';
    if (/(?:^|\/)routeLoaders(?:\.ts)?$/.test(id)) return '\0team-online-preload';
  },
  load(id) {
    if (id === entry) return fixture;
    if (id === '\0team-online-auth') return "export const useAuth = () => ({ session: { access_token: 'fixture-token', user: { id: '22222222-2222-4222-8222-222222222222' } } });";
    if (id === '\0team-online-preload') return 'export const prefetchRoute = () => {}; export const scheduleNavigationPreload = () => () => {};';
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== '/team-online-fixture') return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml(req.url,
        `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
         <body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`));
    });
  },
};

export async function checkOnlineTeamTournaments({ cdp, evaluate, wait }) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'chessaz-team-online-'));
  const langs = { de: 'Spieltag', en: 'Matchday', az: 'Oyun günü', tr: 'Maç günü', ua: 'Ігровий день', ru: 'Игровой день' };
  const setWidth = width => cdp('Emulation.setDeviceMetricsOverride', {
    width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: width === 390,
  });
  const select = (lang, theme) => evaluate('window.fixtureSelect(' + JSON.stringify(lang) + ',' + JSON.stringify(theme) + ')');
  const navigate = mode => evaluate('window.fixtureNav(' + JSON.stringify('/spieltag?mode=' + mode) + ')');
  const navMetrics = () => evaluate(`(() => {
    const nav = document.querySelector('[data-mobile-app-nav]');
    const bounds = nav.getBoundingClientRect();
    const links = [...nav.querySelectorAll('a')].map(link => {
      const label = link.querySelector('.site-nav-label');
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const rect = link.getBoundingClientRect();
      return { path: link.getAttribute('href'), label: label.textContent, left: rect.left, right: rect.right,
        textLeft: text.left, textRight: text.right, lines: range.getClientRects().length,
        hidden: label.scrollWidth > label.clientWidth + 1, active: link.getAttribute('aria-current') };
    });
    return { width: innerWidth, hasFlag: nav.hasAttribute('data-spieltag-enabled'), left: bounds.left, right: bounds.right, links };
  })()`);
  const captureRoot = process.env.SPIELTAG_CAPTURE;
  const capture = async (mode, lang, width) => {
    if (!captureRoot) return;
    await mkdir(captureRoot, { recursive: true });
    await evaluate('document.fonts.ready');
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(captureRoot, 'bochum-' + mode + '-' + lang + '-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
  };
  const fill = (selector, value) => evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    for (let detail = node.closest('details'); detail; detail = detail.parentElement?.closest('details')) detail.open = true;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, ${JSON.stringify(value)});
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const desktopLink = "document.querySelector('aside a[href=\"/spieltag\"]')";
  try {
    for (const [spieltag, tournaments] of [[false, false], [true, false], [false, true]]) {
      const enabled = spieltag || tournaments;
      const server = await createServer({
        configFile: false, envDir: false, cacheDir: join(cacheDir, String(spieltag) + tournaments),
        plugins: [plugin, react()],
        server: { host: '127.0.0.1', port: 0, hmr: false },
        define: Object.fromEntries(Object.entries({
          VITE_SERVER_URL: fixtureOrigin,
          VITE_TEAM_TOURNAMENTS_ENABLED: String(tournaments),
          VITE_SPIELTAG_ENABLED: String(spieltag),
          VITE_TEAM_TOURNAMENTS_M3_ENABLED: String(tournaments),
          VITE_AI_ORGANIZER_ENABLED: String(tournaments),
        }).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
      });
      try {
        await server.listen();
        await setWidth(390);
        await cdp('Page.navigate', { url: server.resolvedUrls.local[0] + 'team-online-fixture' });
        await wait('typeof window.fixtureSelect === "function" && !!document.querySelector("[data-mobile-app-nav]")');
        await evaluate('document.fonts.ready');
        const themes = tournaments ? await evaluate('window.fixtureThemes') : ['Soft Graphite'];
        for (const [lang, spieltagLabel] of Object.entries(langs)) {
          for (const theme of themes) {
            await select(lang, theme);
            assert.deepEqual(await evaluate('window.fixtureSelection'), [lang, theme]);
            const { width, hasFlag, left, right, links } = await navMetrics();
            const context = '390px / ' + lang + ' / ' + theme;
            const paths = ['/home', '/game', '/chat', '/profile', '/settings'];
            if (enabled) paths.splice(3, 0, '/spieltag');
            assert.equal(width, 390, context);
            assert.equal(hasFlag, enabled, context);
            assert.deepEqual(links.map(link => link.path), paths, context);
            if (enabled) {
              assert.equal(links[3].label, spieltagLabel, context);
              assert.equal(links[3].active, 'page', context);
              links.forEach((link, index) => {
                const fits = link.left >= left && link.right <= right && link.lines === 1 && !link.hidden &&
                  link.textLeft >= link.left - 1 && link.textRight <= link.right + 1 &&
                  (index === 0 || link.left >= links[index - 1].right - 1);
                assert.ok(fits, context + ' ' + JSON.stringify(link));
              });
            }
          }
        }
        await setWidth(1366);
        if (enabled) await wait(desktopLink);
        else assert.equal(await evaluate('Boolean(' + desktopLink + ')'), false);
        if (!tournaments) continue;

        for (const width of [390, 1366]) {
          await setWidth(width);
          for (const lang of ['de', 'ru']) {
            await navigate('schedule');
            await select(lang, 'Soft Graphite');
            await wait('document.querySelector("time")?.textContent.includes("18:30")');
            await capture('schedule', lang, width);
            await navigate('lineup');
            await wait('document.body.innerText.includes("NorthReserve")');
            await capture('lineup', lang, width);
          }
        }
        await navigate('undated');
        await wait('!document.querySelector("time") && document.body.innerText.includes("Bochum West")');
        await navigate('myboard');
        await wait('document.querySelector("time")?.textContent.includes("18:30")');
        await navigate('undated-board');
        await wait('!document.querySelector("time") && document.body.innerText.includes("WestBoard1")');

        await navigate('create');
        await select('en', 'Soft Graphite');
        await wait('document.querySelector(".team-create-manual-form")');
        await fill('.team-create-manual-form [name="name"]', 'Bochum test');
        await fill('.team-create-manual-form [name="start_time"]', '2031-12-20T15:00');
        const submit = async ordinal => {
          await evaluate('document.querySelector(".team-create-manual-form").requestSubmit()');
          await wait('window.fixtureCreates.length === ' + ordinal + ' && !document.querySelector(".team-create-primary").disabled');
        };
        await submit(1);
        await submit(2);
        await fill('.team-create-manual-form [name="round_interval_minutes"]', '60');
        await submit(3);
        await fill('.team-create-manual-form [name="round_interval_minutes"]', '90');
        await fill('.team-create-manual-form [name="round_interval_minutes"]', '60');
        await submit(4);
        await fill('.ai-organizer-composer input', 'Bochum Cup with 90 minutes between rounds');
        await evaluate('document.querySelector(".ai-organizer-composer").requestSubmit()');
        await wait('document.querySelector(".ai-organizer-draft [name=round_interval_minutes]")?.value === "90"');
        await evaluate('document.querySelector(".ai-organizer-primary").click()');
        await wait('window.fixtureCreates.length === 5 && !document.querySelector(".ai-organizer-primary").disabled');
        await evaluate('document.querySelector(".ai-organizer-primary").click()');
        await wait('window.fixtureCreates.length === 6');
        const [first, retry, changed, changedBack, ai, aiRetry] = await evaluate('window.fixtureCreates');
        assert.match(first.client_request_id, /^[0-9a-f-]{36}$/);
        assert.equal(retry.client_request_id, first.client_request_id);
        assert.notEqual(changed.client_request_id, first.client_request_id);
        assert.notEqual(changedBack.client_request_id, changed.client_request_id);
        assert.equal(changedBack.round_interval_minutes, 60);
        assert.equal(ai.round_interval_minutes, 90);
        assert.equal(ai.name, 'AI Bochum Cup');
        assert.notEqual(ai.client_request_id, changedBack.client_request_id);
        assert.deepEqual(aiRetry, ai);
      } finally { await server.close(); }
    }
  } finally { await rm(cacheDir, { recursive: true, force: true }); }
}
