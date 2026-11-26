import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const entry = '/__team_online_fixture.tsx';
const fixtureOrigin = 'https://team-online-fixture.invalid';
const fixture = `
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '/src/index.css';
import '/src/components/teamTournaments/teamTournaments.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Layout from '/src/components/Layout.tsx';
import HomeScreen from '/src/screens/HomeScreen.tsx';
import ProfileScreen from '/src/screens/ProfileScreen.tsx';
import SettingsScreen from '/src/screens/SettingsScreen.tsx';
import { LanguageProvider, useLanguage } from '/src/context/LanguageContext.tsx';
import { ThemeProvider, useThemeContext } from '/src/context/ThemeContext.tsx';
import { premiumInterfaceThemes } from '/src/lib/interfaceThemes.ts';
import { M3Create, M3EventPanel } from '/src/components/teamTournaments/TeamTournamentsM3Panel.tsx';
import { TournamentRounds } from '/src/components/teamTournaments/TeamTournamentViews.tsx';
import MyTournamentCard from '/src/components/teamTournaments/MyTournamentCard.tsx';
import { tournamentCopy } from '/src/components/teamTournaments/copy.ts';
import { TournamentOnlineBanner } from '/src/components/teamTournaments/TournamentOnlineViews.tsx';

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
const control = '5+0';
const online = import.meta.env.VITE_TEAM_TOURNAMENTS_ONLINE_PLAY === 'true';
const onlineStates = ['scheduled','scheduled','live','finished','forfeit'];
const onlineRows = onlineStates.map((status, i) => ({
  match_id: match.id, board_no: i + 1, status, white_ready_at: i === 1 ? start : null, black_ready_at: null,
}));
const now = Date.now();
const onlineStart = new Date(now - 60_000).toISOString();
const readyBy = new Date(now + 240_000).toISOString();
const onlineEvent = { ...event, status: 'published', starts_at: onlineStart, play_mode: 'online',
  roles: [{ role: 'organizer' }], online_boards: onlineRows };
const onlineWorkspace = {
  ...onlineEvent, rounds: [{ round_no:1, starts_at:onlineStart, bye_team_id:null }],
  matches: [{ ...match, boards:onlineRows.map(row => ({ board_no:row.board_no, home_white:true,
    result: row.status === 'finished' ? '1-0' : row.status === 'forfeit' ? '-/-' : 'pending',
    confirmed: ['finished','forfeit'].includes(row.status), revision:0 })) }],
};
window.fixtureOnlinePhase = 'play';
window.fixtureOnlineRequests = 0;
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
  if (url.pathname.endsWith('/online/my-board')) {
    window.fixtureOnlineRequests++;
    const phase = window.fixtureOnlinePhase;
    return Response.json({ durable:true, boards:[{ ...board, status:phase === 'finished' ? 'finished' : 'scheduled',
      starts_at: phase === 'scheduled' ? new Date(now + 60_000).toISOString() : onlineStart,
      deadline: phase === 'previous' ? null : readyBy, ready: phase === 'waiting', time_control:control,
      result: phase === 'finished' ? '1-0' : 'pending', score: { home:phase === 'finished' ? 2 : 1,away:1 } }] });
  }
  if (online && url.pathname.endsWith('/workspace')) return Response.json(onlineWorkspace);
  if (online && url.pathname.endsWith('/self-service')) return Response.json(onlineEvent);
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
  window.fixtureWords = tr;
  window.fixtureThemes = ['Void Black','Deep Space','Velvet Gold','Champagne Light','Coffee Brown','Walnut Dark',
    'Emerald Night','Royal Blue','Royal Violet','Obsidian Gold', ...premiumInterfaceThemes.map(theme => theme.id)];
  const mode = new URLSearchParams(search).get('mode');
  if (mode === 'create') return <M3Create token="fixture-token" tr={tr} onCreated={() => {}} />;
  if (mode === 'play-online') return <div className="section-page team-tournament-page">
    <M3EventPanel id={id} token="fixture-token" userId={captain} ownUsername="NorthCaptain" tr={tr} />
  </div>;
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
function HomeFixtureControls() {
  const navigate = useNavigate();
  const { setLanguage } = useLanguage();
  window.fixtureHomeNav = path => flushSync(() => navigate(path));
  window.fixtureHomeLanguage = locale => flushSync(() => setLanguage(locale));
  return null;
}
localStorage.setItem('app-language', 'en');
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter initialEntries={['/spieltag']}>
  <HomeFixtureControls />
  {online && <TournamentOnlineBanner />}
  <Routes><Route element={<Layout/>}><Route path="/spieltag" element={<Showcase />} />
    <Route path="/play" element={<p data-online-test-game>{away}</p>} />
    <Route path="/home" element={<HomeScreen />} />
    <Route path="/profile" element={<ProfileScreen />} />
    <Route path="/settings" element={<SettingsScreen />} />
    <Route path="/chat" element={<p data-home-fixture-chat>Schach-Treff</p>} />
  </Route></Routes>
</MemoryRouter></LanguageProvider></ThemeProvider>);
`;

const plugin = {
  name: 'online-team-tournament-browser-fixtures',
  enforce: 'pre',
  resolveId(id) {
    if (id === entry) return id;
    if (/(?:^|\/)context\/AuthContext(?:\.tsx)?$/.test(id)) return '\0team-online-auth';
    if (/(?:^|\/)context\/SocketContext(?:\.tsx)?$/.test(id)) return '\0team-online-socket';
    if (/(?:^|\/)services\/supabase(?:\.ts)?$/.test(id)) return '\0team-online-profile-db';
    if (/(?:^|\/)routeLoaders(?:\.ts)?$/.test(id)) return '\0team-online-preload';
  },
  load(id) {
    if (id === entry) return fixture;
    if (id === '\0team-online-auth') return `
      const user = { id: '22222222-2222-4222-8222-222222222222' };
      const session = { access_token: 'fixture-token', user };
      const profile = { username: 'QA Player' };
      const signOut = async () => {};
      export const useAuth = () => window.fixtureHomeMode === 'guest'
        ? { session: null, user: null, isLoading: false, signOut }
        : window.fixtureHomeMode === 'signed-in'
          ? { session, user, profile, isLoading: false, signOut }
          : { session };
    `;
    if (id === '\0team-online-profile-db') return `
      export const supabase = { from() {
        const q = { select: () => q, or: () => q, order: () => q, limit: () => q,
          then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject) };
        return q;
      } };
    `;
    if (id === '\0team-online-socket') return `
      const listeners = new Map();
      const socket = {
        connected:true, timeout:() => socket,
        on(name, callback) {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name).add(callback);
        },
        off(name, callback) { listeners.get(name)?.delete(callback); },
        emit(name, payload, callback) {
          window.fixtureReadyRequest = { name,payload };
          window.fixtureOnlineUpdate('waiting');
          callback(null, { ok:true });
        },
      };
      window.fixtureOnlineUpdate = phase => {
        window.fixtureOnlinePhase = phase;
        for (const listener of listeners.get('tournament_board_status') ?? []) listener({});
      };
      window.fixtureMatchFound = () => {
        for (const listener of listeners.get('match_found') ?? []) {
          listener({ roomId:'44444444-4444-4444-8444-444444444444',color:'w',tournament:true });
        }
      };
      export const useSocket = () => ({ socket,isConnected:true });
    `;
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
      return { path: link.getAttribute('href'), label: label.textContent, left: rect.left, right: rect.right, height: rect.height,
        textLeft: text.left, textRight: text.right, lines: range.getClientRects().length,
        hidden: label.scrollWidth > label.clientWidth + 1, textOverflow: getComputedStyle(label).textOverflow, overflowWrap: getComputedStyle(label).overflowWrap,
        lineText: [...label.textContent].reduce((rows,char,i)=>{const part=document.createRange();part.setStart(label.firstChild,i);part.setEnd(label.firstChild,i+1);const rect=[...part.getClientRects()].find(r=>r.width>0)||part.getBoundingClientRect();const key=rect.top.toFixed(2);rows[key]=(rows[key]||'')+char;return rows;},{}), active: link.getAttribute('aria-current') };
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
    for (const [spieltag, tournaments, onlinePlay] of [[false, false, false], [true, false, false],
      [false, true, false], [false, true, true]]) {
      const enabled = spieltag || tournaments;
      const server = await createServer({
        configFile: false, envDir: false, cacheDir: join(cacheDir, String(spieltag) + tournaments + onlinePlay),
        plugins: [plugin, react()],
        server: { host: '127.0.0.1', port: 0, hmr: false },
        define: Object.fromEntries(Object.entries({
          VITE_SERVER_URL: fixtureOrigin,
          VITE_TEAM_TOURNAMENTS_ENABLED: String(tournaments),
          VITE_SPIELTAG_ENABLED: String(spieltag),
          VITE_TEAM_TOURNAMENTS_M3_ENABLED: String(tournaments),
          VITE_AI_ORGANIZER_ENABLED: String(tournaments),
          VITE_TEAM_TOURNAMENTS_ONLINE_PLAY: String(onlinePlay),
        }).map(([key, value]) => ['import.meta.env.' + key, JSON.stringify(value)])),
      });
      try {
        await server.listen();
        await setWidth(390);
        const url = new URL('team-online-fixture', server.resolvedUrls.local[0]);
        await cdp('Page.navigate', { url: url.href });
        await wait('location.href === ' + JSON.stringify(url.href) +
          ' && typeof window.fixtureSelect === "function" && !!document.querySelector("[data-mobile-app-nav]")');
        await evaluate('document.fonts.ready');
        if (!tournaments) {
          // Real Home, Profile and Settings, synthetic auth only. Exercise both flag states.
          await evaluate("window.fixtureHomeMode='guest';window.fixtureHomeNav('/home')");
          await wait("!!document.querySelector('.home-screen-root .chess-arena-reference-title')");
          const state = enabled ? 'on' : 'off';
          const expected = enabled ? ['/home','/game','/chat','/spieltag','/profile'] : ['/home','/game','/chat','/profile','/settings'];
          for (const [width,height] of [[360,640],[390,844],[430,932]]) {
            await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
            for (const zoom of [100,125]) {
              await evaluate("document.documentElement.style.fontSize='"+(17*zoom/100)+"px'");
              for (const locale of Object.keys(langs)) {
                await evaluate("window.fixtureHomeLanguage("+JSON.stringify(locale)+")");
                await evaluate('document.fonts.ready');
                const context = state+' '+locale+' '+width+' '+zoom+'%';
                const metrics = await navMetrics();
                assert.deepEqual(metrics.links.map(link=>link.path),expected,context);
                assert.ok(Math.abs((metrics.links[2].left+metrics.links[2].right)/2-width/2)<=2,context+' centered chat');
                for (const [i,link] of metrics.links.entries()) {
                  const rows=Object.values(link.lineText);
                  const fullLabel=rows.join('')===link.label&&(rows.length===1||(link.label==='Schach-Treff'&&JSON.stringify(rows)===JSON.stringify(['Schach-','Treff'])));
                  assert.ok(link.left>=metrics.left&&link.right<=metrics.right&&link.lines>=1&&link.lines<=2&&!link.hidden&&fullLabel&&link.textOverflow==='clip'&&link.overflowWrap==='normal'&&link.textLeft>=link.left-1&&link.textRight<=link.right+1&&link.right-link.left>=44&&link.height>=44&&(i===0||link.left>=metrics.links[i-1].right-1),context+' '+JSON.stringify(link));
                }
                const geometry = await evaluate(`(()=>{const root=document.querySelector('.home-screen-root'),title=root.querySelector('.chess-arena-reference-title'),word=title.firstElementChild,king=title.lastElementChild,letter=word.querySelector('.mobile-home-brand-domain'),arena=title.closest('.mobile-home-arena'),board=root.querySelector('.home-board:not(.home-board-frame)'),slogan=root.querySelector('.mobile-home-slogan'),copy=slogan.firstElementChild,play=board.nextElementSibling,nav=document.querySelector('[data-mobile-app-nav]'),chat=nav.querySelector('a[href="/chat"]'),r=e=>e.getBoundingClientRect(),center=e=>(r(e).left+r(e).right)/2,s=getComputedStyle(arena),range=document.createRange();range.selectNodeContents(copy);const text=range.getBoundingClientRect();return{titleCenter:center(word),kingGap:Math.max(0,r(king).left-r(letter).right),plaque:s.borderTopWidth!=='0px'||s.outlineStyle!=='none'||s.backgroundImage!=='none'||s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.boxShadow!=='none',boardWidth:r(board).width,boardHeight:r(board).height,boardLeft:r(board).left,boardRight:innerWidth-r(board).right,duplicateChat:!!root.querySelector('a[href="/chat"],.mobile-home-chat'),topGap:r(title).top-r(root).top,bottomGap:r(nav).top-r(play).bottom,logoBoardGap:r(board).top-r(slogan).bottom,boardPlayGap:r(play).top-r(board).bottom,wordFont:parseFloat(getComputedStyle(word).fontSize),fontFamily:getComputedStyle(word).fontFamily,fontWeight:getComputedStyle(word).fontWeight,fontLoaded:document.fonts.check('700 40px "Bodoni Moda"'),gradient:getComputedStyle(letter).backgroundImage,gradientClip:getComputedStyle(letter).backgroundClip,sloganLines:range.getClientRects().length,sloganFits:text.left>=r(slogan).left-1&&text.right<=r(slogan).right+1&&text.left>=0&&text.right<=innerWidth&&slogan.scrollWidth<=slogan.clientWidth+1,sloganText:copy.textContent,kingWidth:r(king).width,kingHeight:r(king).height,kingSheen:getComputedStyle(king.querySelector('.sidebar-king-sheen')).backgroundImage,navIcons:[...nav.querySelectorAll('a>div>svg:first-child')].map(e=>r(e).width),highlight:getComputedStyle(chat).color,ring:getComputedStyle(chat).boxShadow,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight||[...document.querySelectorAll('main,main div')].some(e=>e.clientHeight>0&&/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1)}})()`);
                assert.ok(!geometry.plaque&&Math.abs(geometry.titleCenter-width/2)<=2&&geometry.kingGap<=2,context+' brand '+JSON.stringify(geometry));
                assert.ok(geometry.boardWidth>=width-4&&Math.abs(geometry.boardWidth-geometry.boardHeight)<=1&&geometry.boardLeft>=-1&&geometry.boardLeft<=2&&geometry.boardRight>=-1&&geometry.boardRight<=2,context+' board '+JSON.stringify(geometry));
                assert.ok(!geometry.duplicateChat&&!geometry.overflow&&geometry.topGap>=-1&&geometry.bottomGap>=-1&&Math.abs(geometry.topGap-geometry.bottomGap)<=24&&geometry.wordFont===46&&geometry.fontFamily.includes('Bodoni Moda')&&geometry.fontWeight==='700'&&geometry.fontLoaded&&Math.abs(geometry.kingWidth-28)<=1&&Math.abs(geometry.kingHeight-56)<=1,context+' centered Home '+JSON.stringify(geometry));
                assert.ok(Math.abs(geometry.logoBoardGap-22)<=2&&Math.abs(geometry.boardPlayGap-14)<=2,context+' spacing '+JSON.stringify(geometry));
                assert.ok(geometry.gradient.includes('rgb(228, 225, 218)')&&geometry.gradient.includes('rgb(191, 195, 197)')&&geometry.gradient.includes('rgb(144, 150, 154)')&&geometry.gradientClip==='text',context+' platinum domain');
                assert.ok(geometry.sloganLines===1&&geometry.sloganFits,context+' slogan '+JSON.stringify(geometry));
                assert.ok(geometry.kingSheen.includes('rgba(37, 44, 55, 0.46)')&&geometry.navIcons.length===5&&geometry.navIcons.every(w=>Math.abs(w-17)<=1),context+' king sheen and compact icons '+JSON.stringify(geometry));
                assert.equal(geometry.sloganText,{en:'Play • Learn • Win',de:'Spielen • Lernen • Siegen',ua:'Грай • Навчайся • Перемагай',ru:'Играй • Учись • Побеждай',az:'Oyna • Öyrən • Qalib gəl',tr:'Oyna • Öğren • Kazan'}[locale],context);
                assert.ok(geometry.ring.includes('rgba(184, 190, 197, 0.18)'),context+' graphite sheen');
                assert.equal(geometry.highlight,'rgb(184, 190, 197)',context+' graphite chat');
                if(width===390&&locale==='ru'){
                  await capture('mobile-home-'+state+'-'+zoom,locale,width);
                  await capture('mobile-nav-'+state+'-'+zoom,locale,width);
                }
              }
            }
          }
          await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
          await evaluate("window.fixtureHomeLanguage('ru');document.documentElement.style.fontSize='21.25px'");
          await evaluate("document.querySelector('[data-mobile-app-nav] a[href=\"/chat\"]').click()");
          await wait("!!document.querySelector('[data-home-fixture-chat]')");
          assert.equal(await evaluate("document.querySelector('[data-mobile-app-nav] a[href=\"/chat\"]').getAttribute('aria-current')"),'page');
          assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-mobile-app-nav] a[href=\"/chat\"]')).color"),'rgb(224, 227, 230)');
          await evaluate("window.fixtureHomeNav('/profile')");
          await wait("!!document.querySelector('[data-guest-settings]')");
          for(const [locale,word] of Object.entries({ru:'Настройки',de:'Einstellungen',en:'Settings',az:'Ayarlar',tr:'Ayarlar',ua:'Налаштування'})){
            await evaluate("window.fixtureHomeLanguage("+JSON.stringify(locale)+")");
            const guest=await evaluate("(()=>{const a=document.querySelector('[data-guest-settings]'),r=a.getBoundingClientRect();return{text:a.textContent.trim(),height:r.height,href:a.getAttribute('href'),visible:r.bottom<=document.querySelector('[data-mobile-app-nav]').getBoundingClientRect().top}})()");
            assert.equal(guest.text,word);
            assert.ok(guest.height>=44&&guest.href==='/settings'&&guest.visible,JSON.stringify(guest));
          }
          await evaluate("window.fixtureHomeLanguage('ru')");
          await capture('mobile-guest-profile-'+state+'-125','ru',390);
          await evaluate("document.documentElement.style.fontSize='17px'");
          await capture('mobile-guest-profile-'+state+'-100','ru',390);
          await evaluate("document.documentElement.style.fontSize='21.25px'");
          await evaluate("document.querySelector('[data-guest-settings]').click()");
          await wait("!!document.querySelector('.settings-mobile-view')");
          await evaluate("window.fixtureHomeMode='signed-in';window.fixtureHomeNav('/profile')");
          await wait("!!document.querySelector('button[aria-label=\"Меню профиля\"]')");
          await evaluate("document.querySelector('button[aria-label=\"Меню профиля\"]').click()");
          await wait("!!document.querySelector('[role=menuitem]')");
          await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.trim()==='Настройки').click()");
          await wait("!!document.querySelector('.settings-mobile-view')");
          await evaluate("window.fixtureHomeMode=undefined;window.fixtureHomeNav('/spieltag');document.documentElement.style.fontSize=''");
          await wait("document.body.innerText.includes('Bochum Cup')");
          console.log('PASS mobile Home/nav/Profile flag '+state+': 3 widths, 2 root font sizes, 6 locales');
        }
        if (onlinePlay) {
          await navigate('play-online');
          const testLayout = `(() => {
            const boxes = [...document.querySelectorAll('[data-online-board],[data-online-round-banner],[data-organizer-online-board]')];
            return document.documentElement.scrollWidth <= innerWidth && boxes.every(box => {
              const span = box.getBoundingClientRect();
              return span.left >= 0 && span.right <= innerWidth && box.scrollWidth <= box.clientWidth + 1;
            });
          })()`;
          for (const width of [390,1366]) {
            await setWidth(width);
            for (const lang of Object.keys(langs)) {
              await select(lang,'Soft Graphite');
              await wait(`document.querySelector('[data-online-round-banner]')?.innerText.includes(window.fixtureWords('onlineBanner'))
                && document.querySelector('[data-online-board="play"]')?.innerText.includes(window.fixtureWords('onlineScore'))
                && document.querySelector('[data-organizer-online-board="live"]')?.innerText === window.fixtureWords('onlineLive')`);
              assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-organizer-online-board]')].map(item =>
                item.dataset.organizerOnlineBoard)`),['scheduled','waiting','live','finished','forfeit']);
              assert.ok(await evaluate(testLayout),lang + ' @ ' + width);
              await capture('online-play',lang,width);
            }
          }
          await setWidth(390);
          for (const theme of await evaluate('window.fixtureThemes')) {
            await select('ru',theme);
            assert.ok(await evaluate(testLayout),theme + ' @ 390');
          }
          await select('en','Soft Graphite');
          const phase = async state => {
            await evaluate('window.fixtureOnlineUpdate(' + JSON.stringify(state) + ')');
            await wait('document.querySelector(' + JSON.stringify('[data-online-board="' + state + '"]') + ')');
          };
          await phase('scheduled');
          await wait(`document.querySelector('[data-online-board]')?.innerText.includes('Round starts in')`);
          await phase('previous');
          await wait(`document.querySelector('[data-online-board]')?.innerText.includes('Opponent is finishing the previous game.')`);
          await phase('finished');
          await wait(`document.querySelector('[data-online-board]')?.innerText.includes('2 : 1')`);
          await phase('play');
          await evaluate(`document.querySelector('[data-online-round-banner] button').click()`);
          await wait(`document.querySelector('[data-online-board="waiting"]')`);
          assert.deepEqual(await evaluate('window.fixtureReadyRequest'), { name:'tournament_board_ready',
            payload:{ matchId:'44444444-4444-4444-8444-444444444444',boardNo:1 } });
          await evaluate('window.fixtureMatchFound()');
          await wait(`document.querySelector('[data-online-test-game]')`);

          await navigate('create');
          await wait('document.querySelector(".team-create-manual-form")');
          const settings = await evaluate(`(() => {
            const form = document.querySelector('.team-create-manual-form');
            return [form.elements.time_control.value, form.elements.round_interval_minutes.value,
              form.elements.round_interval_minutes.required, form.elements.no_show_minutes.value];
          })()`);
          assert.deepEqual(settings,['5+0','15',true,'5']);
          await fill('.team-create-manual-form [name="name"]','Online manual cup');
          await fill('.team-create-manual-form [name="start_time"]','2031-12-20T15:00');
          await evaluate('document.querySelector(".team-create-manual-form").requestSubmit()');
          await wait('window.fixtureCreates.length === 1 && !document.querySelector(".team-create-primary").disabled');
          await fill('.ai-organizer-composer input','Bochum Cup with 90 minutes between rounds');
          await evaluate('document.querySelector(".ai-organizer-composer").requestSubmit()');
          await wait('document.querySelector(".ai-organizer-draft [name=time_control]")?.value === "5+0"');
          await evaluate('document.querySelector(".ai-organizer-primary").click()');
          await wait('window.fixtureCreates.length === 2');
          const [manual, ai] = await evaluate('window.fixtureCreates');
          assert.equal(manual.play_mode,'online');
          assert.equal(manual.time_control,'5+0');
          assert.equal(manual.round_interval_minutes,15);
          assert.equal(manual.no_show_minutes,5);
          assert.equal(ai.time_control,'5+0');
          assert.equal(ai.round_interval_minutes,90);
          continue;
        }
        assert.equal(await evaluate('window.fixtureOnlineRequests'),0);
        assert.equal(await evaluate('!!document.querySelector("[data-online-round-banner]")'),false);
        const themes = tournaments ? await evaluate('window.fixtureThemes') : ['Soft Graphite'];
        for (const [lang, spieltagLabel] of Object.entries(langs)) {
          for (const theme of themes) {
            await select(lang, theme);
            assert.deepEqual(await evaluate('window.fixtureSelection'), [lang, theme]);
            const { width, hasFlag, left, right, links } = await navMetrics();
            const context = '390px / ' + lang + ' / ' + theme;
            const paths = ['/home', '/game', '/chat', '/profile', '/settings'];
            if (enabled) paths.splice(3, 2, '/spieltag', '/profile');
            assert.equal(width, 390, context);
            assert.equal(hasFlag, enabled, context);
            assert.deepEqual(links.map(link => link.path), paths, context);
            if (enabled) {
              assert.equal(links[3].label, spieltagLabel, context);
              assert.equal(links[3].active, 'page', context);
            }
            links.forEach((link, index) => {
              const buttonWidth = link.right - link.left;
              const rows = Object.values(link.lineText);
              const fullLabel = rows.join('') === link.label && (rows.length === 1 || (link.label === 'Schach-Treff' && JSON.stringify(rows) === JSON.stringify(['Schach-','Treff'])));
              const fits = link.left >= left && link.right <= right && link.lines >= 1 && link.lines <= 2 && !link.hidden && fullLabel &&
                link.textOverflow === 'clip' && link.overflowWrap === 'normal' &&
                link.textLeft >= link.left - 1 && link.textRight <= link.right + 1 &&
                buttonWidth >= 44 && link.height >= 44 &&
                (index === 0 || link.left >= links[index - 1].right - 1);
              assert.ok(fits, context + ' ' + JSON.stringify(link));
            });
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
