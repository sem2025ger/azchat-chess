'use strict';

// Real hosted UI acceptance. Auth Admin/SQL are fixture setup and read-only
// assertions only; every tournament command is submitted by Chromium through UI.
const { mkdirSync, writeFileSync, appendFileSync } = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash, createHmac } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { browserTarget, healthGuard, frontendGuard, networkDecision, guardBrowserRequest, closeGuardedContext } = require('./qaM3BrowserGuard');
const { connect, fixtureUsers, cleanupEvents, verifyUserCleanup, inviteStorage } = require('./qaM3PilotDb');
const { berlinLocal, berlinLocalToIso } = require('../teamTournamentTime');
const labels = ['Organizer creates event and copies two UI links', 'Captain 1 exact login return and redemption',
  'Captain 2 exact login return and redemption', 'Board 1, consent and submitted lineups',
  'Deadline publishes pairings exactly once', 'Home result, opponent confirmation, board and standings',
  'Second event dispute, organizer reason and audit', 'English and German system labels',
  'Viewport and overflow (including invitation and Home)', 'No invite tokens in third-party URLs or stored fixture rows'];
const roles = ['DO','DC1','DC2','DD1','DD2','MO','MC1','MC2','MD1','MD2'];
const signupRoles = roles.filter(role => /^[DM]C[12]$/.test(role));
const signupEmail = 'delivered@resend.dev';
const root = path.resolve('m3-browser-artifacts');
const status = { desktop: labels.map(() => 'NOT RUN'), mobile: labels.map(() => 'NOT RUN') };
const tokens = [];
let cleanupStatus = 'NOT RUN';
class AcceptanceFailure extends Error {}
function check(ok, message) { if (!ok) throw new AcceptanceFailure(message); }
function mask(value) {
  if (process.env.GITHUB_ACTIONS === 'true') process.stdout.write(`::add-mask::${value.replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D')}\n`);
}
async function request(origin, route, headers, body, method = 'POST') {
  const result = await fetch(origin + route, { method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { ...headers, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  check(result.ok || (method === 'DELETE' && result.status === 404), 'Fixture Auth operation failed');
  return result.status === 204 ? null : result.json();
}
function fixture(env) {
  const tag = 'QA-M3-BROWSER-' + env.GITHUB_RUN_ID;
  const proof = role => createHmac('sha256', env.QA_SUPABASE_SERVICE_KEY).update(`${tag}:${role}`).digest('hex');
  const email = role => signupRoles.includes(role)
    ? `m3ui-${env.GITHUB_RUN_ID}-${role.toLowerCase()}-${proof(role).slice(0, 24)}@example.com`
    : tag.toLowerCase() + '-' + role.toLowerCase() + '@example.com';
  // The signup address is shared. A private per-run username proves ownership
  // if signup is interrupted before Auth Admin tags the account.
  const username = role => signupRoles.includes(role)
    ? 'm3b' + proof(role).slice(24, 40)
    : 'm3b' + BigInt(env.GITHUB_RUN_ID).toString(36) + role.toLowerCase();
  return { tag, email, username };
}
async function cleanup(db, target, serviceKey, tag, email, username) {
  const tagged = await fixtureUsers(db, tag, [...roles.map(email), signupEmail]);
  const { rows: pending } = await db.query(`
    SELECT id, email FROM auth.users
    WHERE email = $1 AND raw_user_meta_data->>'username' = ANY($2::text[])
      AND raw_app_meta_data->>'chessaz_m3_pilot' IS NULL`,
  [signupEmail, signupRoles.map(username)]);
  const users = [...tagged, ...pending];
  await cleanupEvents(db, tag, users.filter(u => [email('DO'), email('MO')].includes(u.email)).map(u => u.id));
  let failed = false;
  for (const user of users) {
    try { await request(target.supabase, '/auth/v1/admin/users/' + user.id,
      { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }, undefined, 'DELETE'); }
    catch { failed = true; }
  }
  await verifyUserCleanup(db, users.map(u => u.id), roles.map(email));
  check(!failed, 'Fixture Auth cleanup was not acknowledged');
}
async function storageProof(db, eventIds, userIds, eventTokens) {
  const rows = [];
  for (const id of eventIds) rows.push(...await inviteStorage(db, id));
  const eventTables = ['team_tournament_m3_action_audit','team_tournament_result_audit',
    'team_tournament_board_results','team_tournament_matches','team_tournament_rounds',
    'team_tournament_roles','team_tournament_teams','team_tournament_rulesets'];
  for (const table of eventTables) rows.push(...(await db.query(`SELECT to_jsonb(r) AS data FROM public.${table} r WHERE tournament_id=ANY($1::uuid[])`, [eventIds])).rows);
  for (const table of ['team_tournament_m3_board_reports','team_tournament_m3_board_states']) {
    rows.push(...(await db.query(`SELECT to_jsonb(r) AS data FROM public.${table} r WHERE match_id IN (SELECT id FROM public.team_tournament_matches WHERE tournament_id=ANY($1::uuid[]))`, [eventIds])).rows);
  }
  rows.push(...(await db.query(`SELECT to_jsonb(r) AS data FROM public.team_tournament_m3_lineups r WHERE entry_id IN (SELECT id FROM public.team_tournament_m3_entries WHERE tournament_id=ANY($1::uuid[]))`, [eventIds])).rows);
  for (const [table,key] of [['auth.users','id'],['auth.sessions','user_id'],['public.profiles','id'],['public.team_tournament_organizers','user_id']]) {
    rows.push(...(await db.query(`SELECT to_jsonb(r) AS data FROM ${table} r WHERE ${key}=ANY($1::uuid[])`, [userIds])).rows);
  }
  const serialized = JSON.stringify(rows);
  check(eventTokens.every(token => !serialized.includes(token)), 'Raw invite token persisted in fixture graph');
  for (const token of eventTokens) check(rows.some(r => r.data?.token_hash === createHash('sha256').update(token).digest('hex')), 'Missing invitation digest');
}
async function waitForPublishedBoard(page, panel) {
  await page.locator('.team-tournament-page > header').getByText('Veröffentlicht · Runde 1', { exact:true }).waitFor({ state:'visible' });
  await panel.getByRole('heading', { name:/^Runde 1: / }).waitFor({ state:'visible' });
  await panel.getByText(/^Brett 1: /).waitFor({ state:'visible' });
}
async function switchLanguage(page, goto, lang) {
  const name = lang === 'en' ? 'English' : 'Deutsch';
  if (page.viewportSize().width >= 1024) {
    await page.getByRole('button', { name, exact: true }).click();
  } else {
    await goto('/settings');
    const settings = page.locator('.settings-mobile-view');
    const menu = lang === 'en' ? /Sprache ändern/ : /Change Language/;
    await settings.getByRole('button', { name: menu }).click();
    await settings.getByRole('button', { name: new RegExp(name) }).click();
  }
  await page.locator(`html[lang="${lang}"]`).waitFor({ state: 'attached' });
}
async function runViewport(browser, target, db, users, tag, viewportName, signal, serviceKey) {
  const mobile = viewportName === 'mobile';
  const prefix = mobile ? 'M' : 'D';
  const viewport = mobile ? { width:390,height:844 } : { width:1280,height:900 };
  const folder = path.join(root, viewportName);
  mkdirSync(folder, { recursive:true });
  const context = await browser.newContext({ viewport, locale:'de-DE', timezoneId:'Europe/Berlin',
    serviceWorkers:'block' });
  let violation = false;
  let page;
  const eventIds = [];
  const firstToken = tokens.length;
  const overflow = [];
  // Screenshots exclude browser chrome. Hide secret-bearing fields even when
  // React inserts an invitation input after the page has loaded.
  await context.addInitScript(() => {
    if (!localStorage.getItem('app-language')) localStorage.setItem('app-language','de');
    const install = () => {
      if (!document.documentElement) return;
      const style = document.createElement('style');
      style.textContent = 'input[readonly],input[type=email],input[type=password]{color:transparent!important;text-shadow:none!important;-webkit-text-security:disc!important}';
      document.documentElement.appendChild(style);
    };
    install();
    if (!document.documentElement) new MutationObserver((_, observer) => {
      if (document.documentElement) { install(); observer.disconnect(); }
    }).observe(document, { childList:true });
  });
  await context.route('**/*', route => guardBrowserRequest(route, target, tokens, () => { violation = true; }));
  await context.routeWebSocket('**/*', socket => {
    if (networkDecision(socket.url(), {}, target, tokens) === 'allow') socket.connectToServer();
    else { violation = true; socket.close(); }
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(45000);
  const button = (name, scope = page) => scope.getByRole('button', { name, exact:true });
  const panel = () => page.getByRole('region', { name:'Vereinsturnier anlegen', exact:true });
  const goto = route => page.goto(target.preview + route, { waitUntil:'domcontentloaded' });
  async function shot(number, suffix = 'step') {
    const sensitiveText = [signupEmail, ...Object.values(users).map(user => user.email), ...tokens]
      .map(value => page.getByText(value, { exact:false }));
    await page.screenshot({ path:path.join(folder, String(number).padStart(2,'0') + '-' + suffix + '.png'),
      mask:[page.locator('input[readonly]'),page.locator('input[type=email]'),page.locator('input[type=password]'),...sensitiveText] });
  }
  async function fits(label) {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);
    overflow.push({ label, fits }); check(fits, 'Horizontal overflow: ' + label);
  }
  async function step(number, action) {
    signal.throwIfAborted();
    try {
      await action(); check(!violation, 'Forbidden browser network target or invite leak');
      await shot(number); status[viewportName][number-1] = 'PASS';
      console.log(`${viewportName} ${String(number).padStart(2,'0')} PASS ${labels[number-1]}`);
    } catch (error) {
      status[viewportName][number-1] = 'FAIL';
      await shot(number).catch(() => {});
      console.log(`${viewportName} ${String(number).padStart(2,'0')} FAIL ${labels[number-1]}`);
      throw error;
    }
  }
  async function signOut() {
    await goto('/profile');
    // A fresh signed-out browser state; credentials are never injected as JWTs.
    await context.clearCookies();
    await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('sb-')) localStorage.removeItem(key); sessionStorage.clear(); });
  }
  async function signIn(role, link, loginEmail = users[role].email) {
    await signOut();
    if (link) {
      await page.goto(link, { waitUntil:'domcontentloaded' });
      await page.locator('.team-tournament-page').getByRole('link', { name:'Anmelden',exact:true }).click();
    } else await goto('/profile');
    await page.locator('input[type=email]').fill(loginEmail);
    await page.locator('input[type=password]').fill(users[role].password);
    await page.locator('form').filter({ has:page.locator('input[type=password]') }).locator('button[type=submit]').click();
    if (link) {
      await page.waitForURL(url => url.href === link);
      check(page.url() === link, 'Login did not preserve the exact invitation URL');
      await button('Einladung annehmen').waitFor({ state:'visible' });
      await fits('signed-in invite');
    } else {
      await page.locator('input[type=password]').waitFor({ state:'hidden' });
    }
  }
  async function registerCaptain(role) {
    const account = users[prefix+role];
    const occupied = await db.query('SELECT 1 FROM auth.users WHERE email = $1', [signupEmail]);
    check(occupied.rowCount === 0, 'QA signup address is already in use');
    await signOut();
    // The confirmation email must not carry a live invitation token.
    await goto('/profile');
    check(page.url() === target.preview + '/profile', 'QA signup must start without an invitation URL');
    await button('Registrieren').click();
    const form = page.locator('form').filter({ has:page.locator('input[type=password]') });
    await form.locator('input[type=text]').fill(account.username);
    await form.locator('input[type=email]').fill(signupEmail);
    await form.locator('input[type=password]').fill(account.password);
    const [response] = await Promise.all([
      page.waitForResponse(r => {
        const url = new URL(r.url());
        return url.origin === target.supabase && url.pathname === '/auth/v1/signup' && r.request().method() === 'POST';
      }),
      form.locator('button[type=submit]').click(),
    ]);
    check(response.ok(), `QA UI signup failed (HTTP ${response.status()}).`);
    const signup = await response.json();
    const created = signup.user ?? signup;
    check(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(created.id || '') && created.email === signupEmail && !signup.access_token,
      'QA signup did not return the expected signed-out fixture.');
    const createdFixture = await db.query(`SELECT 1 FROM auth.users
      WHERE id = $1 AND email = $2 AND raw_user_meta_data->>'username' = $3
        AND raw_app_meta_data->>'chessaz_m3_pilot' IS NULL AND last_sign_in_at IS NULL`,
    [created.id, signupEmail, account.username]);
    check(createdFixture.rowCount === 1, 'QA signup could not be matched to a new fixture.');
    const confirmed = await request(target.supabase, '/auth/v1/admin/users/' + created.id,
      { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
      { email_confirm: true, app_metadata: { chessaz_m3_pilot: tag } }, 'PUT');
    check(confirmed.id === created.id && !!confirmed.email_confirmed_at && !confirmed.last_sign_in_at,
      'QA fixture confirmation did not preserve first sign-in.');
    account.id = created.id;
  }
  async function command(click, ending) {
    const responsePromise = page.waitForResponse(r => r.url().startsWith(target.api + '/api/team-tournaments/') && r.url().endsWith(ending) && r.request().method() === 'POST');
    const [response] = await Promise.all([responsePromise, click()]);
    check(response.ok(), 'UI tournament command failed');
    return response.json();
  }
  async function create(label) {
    await signIn(prefix+'O'); await goto('/spieltag?tab=turniere');
    const deadline = Math.ceil((Date.now()+3*60000)/60000)*60000;
    const wall = berlinLocal(deadline);
    check(Date.parse(berlinLocalToIso(wall)) === deadline, 'Ambiguous Berlin deadline');
    const form = page.locator('form').filter({ has:page.locator('input[name=registration_deadline]') });
    const name = `[${tag}] ${viewportName} ${label}`;
    for (const [key,value] of Object.entries({name,start_time:berlinLocal(deadline+3600000),registration_deadline:wall,boards_per_team:'1',min_teams:'2',max_teams:'2'})) await form.locator(`[name=${key}]`).fill(value);
    const created = await command(() => button('Vereinsturnier anlegen',form).click(), '/self-service');
    check(created.id, 'Event creation returned no ID'); eventIds.push(created.id);
    await panel().getByRole('heading', { name, exact:true }).waitFor();
    const links = [];
    for (let i=1;i<=2;i++) {
      await panel().getByLabel('Vereinsname', {exact:true}).fill(`${tag} ${viewportName} ${label} Club ${i}`);
      const invited = await command(() => button('Einladungslink erzeugen',panel()).click(), '/invites');
      check(/^[a-f0-9]{64}$/.test(invited.token), 'Invalid invite token');
      tokens.push(invited.token); mask(invited.token);
      const field = panel().getByRole('textbox', {name:'Einladungslink erzeugen', exact:true});
      await field.waitFor();
      // Copy the actual UI field, not the HTTP response's token.
      await page.waitForFunction(({id,token}) => Array.from(document.querySelectorAll('input[readonly]')).some(input => input.value.includes(id) && input.value.endsWith(token)), {id:created.id,token:invited.token});
      const link = await field.inputValue();
      check(link === target.preview + '/spieltag?tab=turniere&tournament=' + created.id + '&invite=' + invited.token, 'Incorrect UI invitation link');
      links.push(link);
    }
    return {id:created.id, name, links, deadline};
  }
  async function redeem(event, role, index, loginEmail) {
    await signIn(prefix+role, event.links[index], loginEmail);
    await command(() => button('Einladung annehmen',panel()).click(), '/redeem');
    await panel().getByRole('heading', { name:/Mannschaftsaufstellung/ }).waitFor();
  }
  async function registerAndRedeem(event, role, index) {
    await registerCaptain(role);
    await redeem(event, role, index, signupEmail);
    // Free the provider's single delivery simulator after the exact first login.
    const account = users[prefix+role];
    const moved = await request(target.supabase, '/auth/v1/admin/users/' + account.id,
      { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
      { email: account.email, email_confirm: true }, 'PUT');
    check(moved.id === account.id && moved.email === account.email && !!moved.email_confirmed_at &&
      moved.app_metadata?.chessaz_m3_pilot === tag, 'QA fixture did not retain its identity after email change');
  }
  async function lineup(event, role, addMyself = false) {
    await signIn(prefix+role); await goto('/spieltag?tab=turniere&tournament='+event.id);
    await panel().getByRole('textbox', {name:'Spielername suchen',exact:true}).fill(users[prefix+role].username);
    await button('Spielername suchen',panel()).click();
    const result = button('Aufstellen: '+users[prefix+role].username,panel());
    if (addMyself) {
      await result.waitFor({ state:'visible' });
      await panel().getByText('Dein Spielername: '+users[prefix+role].username, { exact:true }).waitFor();
      await button('Mich aufstellen',panel()).click();
    } else await result.click();
    await command(() => button('Entwurf speichern',panel()).click(), '/lineup');
    await command(() => panel().getByRole('button', {name:/^Teilnahme und Veröffentlichung zustimmen/}).click(), '/lineup/consent');
    await command(() => button('Aufstellung verbindlich anmelden',panel()).click(), '/lineup/submit');
    await panel().getByText('Angemeldet',{exact:true}).waitFor();
  }
  async function publish(event) {
    while (Date.now() < event.deadline+1200) {
      signal.throwIfAborted();
      await sleep(Math.min(15000,event.deadline+1200-Date.now()),undefined,{signal});
    }
    await goto('/spieltag?tab=turniere&tournament='+event.id);
    await waitForPublishedBoard(page, panel());
    const query = `SELECT t.published_at,t.status,
      (SELECT count(*)::int FROM public.team_tournament_rounds WHERE tournament_id=t.id) AS rounds,
      (SELECT count(*)::int FROM public.team_tournament_matches WHERE tournament_id=t.id) AS matches,
      (SELECT count(*)::int FROM public.team_tournament_board_results WHERE tournament_id=t.id) AS boards
      FROM public.team_tournaments t WHERE id=$1`;
    const before = (await db.query(query,[event.id])).rows[0];
    check(before?.status==='published' && before.published_at && before.rounds===1 && before.matches===1 && before.boards===1,'Pairing counts incorrect');
    await page.reload({waitUntil:'domcontentloaded'});
    await waitForPublishedBoard(page, panel());
    check(JSON.stringify((await db.query(query,[event.id])).rows[0])===JSON.stringify(before),'Duplicate publication');
  }
  async function home(role, opponent, event) {
    await signIn(prefix+role); await goto('/');
    const card = page.getByRole('region',{name:'Mein Turnier',exact:true});
    await card.getByText(new RegExp(event.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))).waitFor();
    const text = await card.innerText();
    check(text.includes('Runde 1') && text.includes('Brett 1') && text.includes(users[prefix+opponent].username) && /Du spielst: (Weiß|Schwarz)/.test(text),'Home board/opponent/colour incorrect');
    for (const [name,value] of [['Sieg','1'],['Remis','½'],['Niederlage','0']]) check((await button(name,card).innerText()).trim()===value,'Missing Home result control');
    await fits('Home controls');
    return card;
  }
  async function confirmed(event, expected) {
    const result = await db.query('SELECT result,confirmed,source FROM public.team_tournament_board_results WHERE tournament_id=$1',[event.id]);
    check(result.rows.length===1 && result.rows[0].confirmed && result.rows[0].result===expected,'Confirmed board incorrect');
    await goto('/spieltag?tab=turniere&tournament='+event.id);
    const standings = page.getByRole('region',{name:'Offizielle Tabelle',exact:true}).last();
    await standings.waitFor();
    const rows = await standings.locator('tbody tr').allTextContents();
    check(rows.length===2,'Missing standings teams');
    const cells = await standings.locator('tbody tr').evaluateAll(rows => rows.map(r=>Array.from(r.querySelectorAll('td,th')).map(c=>c.textContent.trim())));
    // Standings columns: rank, team, MP, BP, Berlin.
    if (expected==='1/2-1/2') check(cells.every(row=>row[2]==='1' && row[3]==='½'),'Draw standings incorrect');
    else check(cells.some(row=>row[2]==='2' && row[3]==='1') && cells.some(row=>row[2]==='0' && row[3]==='0'),'Win standings incorrect');
    await fits('standings');
  }
  try {
    await goto('/');
    await frontendGuard(page, process.env.M3_QA_EXPECTED_SHA);
    check(!violation, 'Forbidden browser network target during frontend version proof');
    let event;
    await step(1,async()=>{event=await create('Main');});
    await step(2,()=>registerAndRedeem(event,'C1',0));
    await step(3,()=>registerAndRedeem(event,'C2',1));
    await step(4,async()=>{await lineup(event,'C1');await lineup(event,'C2',true);});
    await step(5,()=>publish(event));
    await step(6,async()=>{
      let card=await home('C1','C2',event);
      const expected=(await card.innerText()).includes('Du spielst: Weiß')?'1-0':'0-1';
      const reported=await command(()=>button('Sieg',card).click(),'/report');
      check(reported.status==='reported','Result was not reported');
      await shot(6,'home-report');
      card=await home('C2','C1',event);
      await command(()=>button('Bestätigen',card).click(),'/confirm');
      const row=(await db.query('SELECT result FROM public.team_tournament_board_results WHERE tournament_id=$1',[event.id])).rows[0];
      check(row.result===expected,'Reported win does not match the player colour');
      await confirmed(event,row.result);
      const winner=page.getByRole('region',{name:'Offizielle Tabelle',exact:true}).last().locator('tbody tr').filter({hasText:tag+' '+viewportName+' Main Club 1'});
      const winnerCells=await winner.locator('td').allTextContents();
      check(winnerCells[1]==='2' && winnerCells[2]==='1','Wrong team received the win');
    });
    await step(7,async()=>{
      const dispute=await create('Dispute');
      await redeem(dispute,'D1',0);await redeem(dispute,'D2',1);
      await lineup(dispute,'D1');await lineup(dispute,'D2');await publish(dispute);
      let card=await home('D1','D2',dispute);
      await command(()=>button('Sieg',card).click(),'/report');
      card=await home('D2','D1',dispute);
      const conflict=await command(()=>button('Sieg',card).click(),'/report');
      check(conflict.status==='disputed','Conflicting reports did not dispute board');
      await signIn(prefix+'O');await goto('/spieltag?tab=turniere&tournament='+dispute.id);
      await panel().getByText('Weiß: 1-0 (Gespielt)',{exact:true}).waitFor();
      await panel().getByText('Schwarz: 0-1 (Gespielt)',{exact:true}).waitFor();
      await shot(7,'conflicting-reports');
      await panel().locator('select').selectOption('1/2-1/2');
      const reason='Synthetic scoresheets reviewed in hosted UI';
      await panel().getByPlaceholder('Begründung',{exact:true}).fill(reason);
      await command(()=>button('Ergebnis entscheiden',panel()).click(),'/decide');
      const audit=(await db.query("SELECT * FROM public.team_tournament_m3_action_audit WHERE tournament_id=$1 ORDER BY id",[dispute.id])).rows;
      const last=audit.at(-1);
      check(audit.length===3 && last.action==='decide' && last.actor_id===users[prefix+'O'].id && last.actor_role==='organizer' && last.reason===reason && last.old_value.status==='disputed' && last.new_value.board_result==='1/2-1/2','Dispute audit incorrect');
      await confirmed(dispute,'1/2-1/2');
    });
    await step(8,async()=>{
      await switchLanguage(page, goto, 'en');
      check(await page.locator('html').getAttribute('lang')==='en','English locale not active');
      await goto('/spieltag?tab=turniere&tournament='+event.id);
      await button('All tournaments').waitFor();
      await page.getByRole('region',{name:'Create club tournament',exact:true}).getByRole('heading',{name:event.name,exact:true}).waitFor();
      await shot(8,'english');
      await switchLanguage(page, goto, 'de');
      check(await page.locator('html').getAttribute('lang')==='de','German locale not active');
      await goto('/spieltag?tab=turniere&tournament='+event.id);await button('Alle Turniere').waitFor();
      await panel().getByRole('heading',{name:event.name,exact:true}).waitFor();
    });
    await step(9,async()=>{check(overflow.length>=4 && overflow.every(item=>item.fits),'Missing invitation/Home overflow checks');await fits('final tournament');check(page.viewportSize().width===viewport.width,'Wrong viewport');});
    await step(10,async()=>{await storageProof(db,eventIds,Object.values(users).filter(u=>u.id).map(u=>u.id),tokens.slice(firstToken));check(!violation,'Invite token leak or forbidden network');});
  } finally {
    await closeGuardedContext(context);
  }
  check(!violation, 'Forbidden browser network target or invite leak during shutdown');
}
function summary() {
  const lines=['# Hosted M3 browser acceptance', '', `HEAD: ${process.env.M3_QA_EXPECTED_SHA || 'not supplied'}`, '', '| Step | Coverage | Desktop | Mobile |','| --- | --- | --- | --- |'];
  labels.forEach((label,i)=>lines.push(`| ${i+1} | ${label} | ${status.desktop[i]} | ${status.mobile[i]} |`));
  lines.push('',`Cleanup: **${cleanupStatus}**. PASS means zero fixture event graph rows, Auth users, sessions, profiles and organizer grants.`, '',
    'Each viewport runs the complete scenario. Step 9 includes the invitation and Home overflow checks performed in steps 2/3/6.',
    'Screenshots contain page content only, without an address bar. Secret input fields are masked. No trace, HAR, console messages, request URLs or auth state are exported.',
    'Storage proof covers the complete run-owned tournament graph, audit, fixture profiles, Auth users and sessions. It is not a scan of unrelated QA data.');
  const text=lines.join('\n')+'\n';mkdirSync(root,{recursive:true});writeFileSync(path.join(root,'summary.md'),text);
  if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
}
async function main() {
  const env=process.env; const cleanupOnly=process.argv[2]==='--cleanup';
  let db, target, browser, connected=false, cleanupNeeded=false, exit=0;
  const {tag,email,username}=fixture(env);
  const controller=new AbortController();
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>controller.abort());
  try {
    target=browserTarget(env);
    const {QA_SUPABASE_SERVICE_KEY:serviceKey,QA_SUPABASE_ANON_KEY:anonKey,QA_DATABASE_URL:databaseUrl}=env;
    check(serviceKey && anonKey && serviceKey!==anonKey && databaseUrl,'Missing QA credentials');
    for(const value of [serviceKey,anonKey,databaseUrl]) mask(value);
    if(!cleanupOnly) {
      await healthGuard(target,env.M3_QA_EXPECTED_SHA);
      const {chromium}=require('playwright');browser=await chromium.launch({headless:true});
      const context=await browser.newContext({serviceWorkers:'block'});
      let violation=false;
      await context.route('**/*',route=>guardBrowserRequest(route,target,tokens,()=>{violation=true;}));
      await context.routeWebSocket('**/*',socket=>{
        if(networkDecision(socket.url(),{},target,tokens)==='allow') socket.connectToServer();
        else {violation=true;socket.close();}
      });
      try {
        const page=await context.newPage();
        await page.goto(target.preview,{waitUntil:'domcontentloaded',timeout:45000});
        await frontendGuard(page,env.M3_QA_EXPECTED_SHA);
      } finally {await closeGuardedContext(context);}
      check(!violation,'Forbidden browser network target during frontend version proof');
    }
    db=connect(databaseUrl);await db.connect();connected=true;
    await cleanup(db,target,serviceKey,tag,email,username);cleanupStatus='PASS';
    if(!cleanupOnly) {
      const due=await db.query("SELECT 1 FROM public.team_tournament_m3_config c JOIN public.team_tournaments t ON t.id=c.tournament_id WHERE t.status='registration' AND c.registration_deadline < clock_timestamp()+interval '35 minutes' LIMIT 1");
      check(due.rowCount===0,'Another registration could advance during browser acceptance');
      if(env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT,'fixture_cleanup_needed=true\n');
      cleanupNeeded=true;cleanupStatus='PENDING';
      const users={};
      for(const role of roles) {
        const password=randomBytes(32).toString('base64url')+'!a1';mask(password);
        users[role]={email:email(role),password,username:username(role)};
        mask(users[role].email);
        if(signupRoles.includes(role)) continue;
        const user=await request(target.supabase,'/auth/v1/admin/users',{apikey:serviceKey,Authorization:'Bearer '+serviceKey},
          {email:email(role),password,email_confirm:true,user_metadata:{username:username(role)},app_metadata:{chessaz_m3_pilot:tag}});
        check(user.id && user.email===email(role),'Wrong fixture user');
        users[role].id=user.id;
      }
      check((await fixtureUsers(db,tag,roles.map(email))).length===roles.length-signupRoles.length,'SQL does not see prepared QA Auth fixtures');
      await db.query('INSERT INTO public.team_tournament_organizers(user_id) VALUES ($1),($2)',[users.DO.id,users.MO.id]);
      for(const viewport of ['desktop','mobile']) await runViewport(browser,target,db,users,tag,viewport,controller.signal,serviceKey);
      check((await fixtureUsers(db,tag,roles.map(email))).length===roles.length,'SQL does not see QA Auth fixtures');
      check(Object.values(status).flat().every(s=>s==='PASS'),'Incomplete browser acceptance');
    }
  } catch(error) {
    exit=1;
    // Playwright errors can embed complete invite URLs or input values.
    console.error(error instanceof AcceptanceFailure ? error.message : 'Browser/guard operation failed; sensitive diagnostics withheld.');
  } finally {
    if(browser) await browser.close().catch(()=>{exit=1;});
    if(connected && cleanupNeeded) {
      try {await cleanup(db,target,env.QA_SUPABASE_SERVICE_KEY,tag,email,username);cleanupStatus='PASS';}
      catch {cleanupStatus='FAIL';exit=1;}
    }
    if(db) await db.end().catch(()=>{exit=1;});
    console.log('Cleanup '+cleanupStatus+(cleanupStatus==='PASS'?' · zero fixture rows':''));
    // Cleanup retry supplements, but must not overwrite the failed run's table.
    if(cleanupOnly) {
      const line='Browser cleanup retry '+cleanupStatus+' · zero rows proof required\n';
      mkdirSync(root,{recursive:true});appendFileSync(path.join(root,'cleanup-retry.md'),line);
      if(env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY,line);
    } else summary();
  }
  return exit;
}
if(require.main===module) main().then(code=>{process.exitCode=code;}).catch(()=>{console.error('Browser acceptance could not finish safely');process.exitCode=1;});
module.exports={main,waitForPublishedBoard,switchLanguage,fixture};
