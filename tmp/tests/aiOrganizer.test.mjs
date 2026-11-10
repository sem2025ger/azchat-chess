import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createAiOrganizerApi } from '../src/services/teamTournaments.ts';
import { tournamentCopy } from '../src/components/teamTournaments/copy.ts';

const languages = ['de', 'en', 'az', 'tr', 'ua', 'ru'];
const draft = {
  name: 'Fixture Cup', start_time: '2026-12-20T15:00',
  registration_deadline: '2026-12-20T14:00',
  boards_per_team: 4, min_teams: 2, max_teams: 4,
};
const signal = new AbortController().signal;
function findElement(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findElement(item, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!tree || !tree.props) return null;
  return predicate(tree) ? tree : findElement(tree.props.children, predicate);
}
async function withAiComponent(component, check, api = {}) {
  const path = '/src/components/teamTournaments/' + component + '.tsx';
  const fixture = '/__ai_organizer_hooks.ts';
  const vite = await createServer({
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    define: { 'import.meta.env.VITE_AI_ORGANIZER_ENABLED': '"true"' },
    plugins: [{
      name: 'ai-organizer-hooks', enforce: 'pre',
      resolveId(id, importer) {
        if (id === fixture) return fixture;
        if (importer?.endsWith(path) && [
          '../../context/LanguageContext',
          '../../services/teamTournaments',
          './AiOrganizerPanel',
        ].includes(id)) return fixture;
      },
      transform(code, id) {
        if (id.endsWith(path)) return code.replace("from 'react'", "from '" + fixture + "'");
      },
      load(id) {
        if (id !== fixture) return;
        return [
          'const state = [], effects = [], cleanups = [], dependencies = [];',
          'let cursor = 0, api = {};',
          'export const setApi = value => { api = value; };',
          "export const useLanguage = () => ({ language: 'en' });",
          "export const useId = () => 'fixture-id';",
          'export const useState = initial => {',
          '  const index = cursor++;',
          "  if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;",
          "  return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];",
          '};',
          'export const useRef = initial => useState({ current: initial })[0];',
          'export const useEffect = (fn, deps) => {',
          ' const index = cursor++;',
          ' if (!dependencies[index] || deps.some((value, index2) => !Object.is(value, dependencies[index][index2]))) {',
          '   dependencies[index] = deps;',
          '   effects.push(() => { cleanups[index]?.(); cleanups[index] = fn(); });',
          ' }',
          '};',
          'export const createAiOrganizerApi = () => api;',
          'export const createTournamentM3Api = () => api;',
          'export const createTournamentApi = () => api;',
          "export const tournamentErrorMessage = () => 'not available';",
          'export const AiOrganizerPanel = () => null;',
          'export function render(fn) { cursor = 0; return fn(); }',
          'export function runEffects() { for (const effect of effects.splice(0)) effect(); }',
        ].join('\n');
      },
    }],
  });
  try {
    const hooks = await vite.ssrLoadModule(fixture);
    hooks.setApi(api);
    await check(await vite.ssrLoadModule(path), hooks);
  } finally { await vite.close(); }
}

test('planning client sends signed draft requests and returns typed response', async () => {
  const requests = [];
  const response = { draft, missing: [], question: null, assistant_text: 'Ready', ready: true };
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), ...options });
    return new Response(JSON.stringify(response), { status: 200 });
  };
  const client = createAiOrganizerApi('https://qa.chessaz.example', 'fixture-token', fetchImpl);
  const result = await client.plan('en', [{ role: 'user', text: 'create a cup' }], undefined, signal);
  assert.deepEqual(result, response);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://qa.chessaz.example/api/ai-organizer/plan');
  assert.equal(requests[0].headers.Authorization, 'Bearer fixture-token');
  assert.equal(JSON.parse(requests[0].body).messages[0].text, 'create a cup');
});
test('every new chat copy key is complete in six locales', () => {
  const source = readFileSync(new URL('../src/components/teamTournaments/copy.ts', import.meta.url), 'utf8');
  const keys = [...source.matchAll(/^\s*(aiOrganizer[A-Za-z]+):\s*\[/gm)].map(match => match[1]);
  assert.ok(keys.length >= 20);
  for (const key of keys) {
    for (const language of languages) {
      const value = tournamentCopy(language)(key);
      assert.equal(typeof value, 'string');
      assert.ok(value.trim().length > 0, language + ' missing ' + key);
    }
  }
});
test('chat is gated by flag and existing can_create authorization; form is reused', () => {
  const panel = readFileSync(new URL('../src/components/teamTournaments/TeamTournamentsM3Panel.tsx', import.meta.url), 'utf8');
  const tab = readFileSync(new URL('../src/components/teamTournaments/TeamTournamentsTab.tsx', import.meta.url), 'utf8');
  assert.match(panel, /VITE_AI_ORGANIZER_ENABLED\s*===\s*'true'/);
  assert.match(panel, /aiEnabled\s*&&\s*<AiOrganizerPanel/);
  assert.match(tab, /token\s*&&\s*list\.can_create\s*&&\s*[\r\n\s]*<M3Create/);
  assert.match(panel, /formRef\.current\.requestSubmit\(\)/);
  assert.equal(panel.match(/createTournamentM3Api\([^\n]*\)\.create\(/g)?.length, 1);
});
test('missing draft fields highlighted; cannot create before completion', async () => {
  await withAiComponent('AiOrganizerPanel', async ({ AiOrganizerPanel }, hooks) => {
    const tr = tournamentCopy('en');
    const render = () => hooks.render(() => AiOrganizerPanel({
      tr, token: 'fixture-token', onApply() {}, onCreate() {}, creating: false,
    }));
    render();
    hooks.runEffects();
    findElement(render(), item => item.type === 'input' &&
      item.props.placeholder === tr('aiOrganizerPrompt'))
      .props.onChange({ target: { value: 'Cup without start' } });
    findElement(render(), item => item.type === 'form').props.onSubmit({ preventDefault() {} });
    await new Promise(setImmediate);
    const result = render();
    assert.ok(findElement(result, item => item.props.className === 'ai-organizer-field-missing'));
    const create = findElement(result, item => item.type === 'button' &&
      item.props.children === tr('aiOrganizerCreate'));
    assert.equal(create.props.disabled, true);
    assert.equal(findElement(result, item => item.props.name === 'name').props.value, 'Fixture Cup');
  }, {
    async plan() {
      return { draft: { ...draft, start_time: null }, missing: ['start_time'],
        question: 'When is the start?', assistant_text: 'One field is missing.', ready: false };
    },
  });
});
test('Use this draft fills existing M3 form; Create triggers existing submit', async () => {
  const OriginalInput = globalThis.HTMLInputElement;
  class MockInput { value = ''; }
  globalThis.HTMLInputElement = MockInput;
  try {
    await withAiComponent('TeamTournamentsM3Panel', async ({ M3Create }, hooks) => {
      const tr = tournamentCopy('en');
      const render = () => hooks.render(() => M3Create({ tr, token: 'fixture-token', onCreated() {} }));
      const element = render();
      const embedded = findElement(element, value => value.type === hooks.AiOrganizerPanel);
      assert.ok(embedded);
      const form = findElement(element, value => value.type === 'form');
      assert.ok(form);
      const fields = Object.fromEntries(Object.keys(draft).map(key => [key, new MockInput()]));
      let submitted = 0;
      const elementForm = { elements: { namedItem: name => fields[name] }, requestSubmit() { submitted++; } };
      form.props.ref.current = elementForm;
      embedded.props.onApply(draft);
      for (const [key, value] of Object.entries(draft)) assert.equal(fields[key].value, String(value));
      embedded.props.onCreate({ ...draft, max_teams: 6 });
      assert.equal(fields.max_teams.value, '6');
      assert.equal(submitted, 1);
      assert.equal(render().type, 'section');
    });
  } finally { globalThis.HTMLInputElement = OriginalInput; }
});
