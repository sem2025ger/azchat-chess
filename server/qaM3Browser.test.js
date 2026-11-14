'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, switchLanguage, waitForPublishedBoard } = require('./scripts/qaM3Browser');

test('captain fixtures have unique logins and reproducible signup ownership per role and run', () => {
  const env = { GITHUB_RUN_ID: '42439357791', QA_SUPABASE_SERVICE_KEY: 'test-service-key' };
  const current = fixture(env);
  const retry = fixture(env);
  const otherRun = fixture({ ...env, GITHUB_RUN_ID: '42439357792' });
  const otherKey = fixture({ ...env, QA_SUPABASE_SERVICE_KEY: 'different-test-key' });
  const roles = ['DC1', 'DC2', 'MC1', 'MC2'];
  assert.equal(new Set(roles.map(current.email)).size, roles.length);
  assert.equal(new Set(roles.map(current.username)).size, roles.length);
  for (const role of roles) {
    assert.match(current.username(role), /^[a-z0-9]{3,30}$/);
    assert.match(current.email(role), /@example\.com$/);
    assert.equal(current.username(role), retry.username(role));
    assert.equal(current.email(role), retry.email(role));
    assert.notEqual(current.username(role), otherRun.username(role));
    assert.notEqual(current.username(role), otherKey.username(role));
  }
});

test('browser publication waits for the localized status, round pairing and board', async () => {
  const visible = [];
  const locator = label => ({
    async waitFor(options) {
      assert.deepEqual(options, { state: 'visible' });
      visible.push(label);
    },
  });
  const page = {
    locator(selector) {
      assert.equal(selector, '.team-tournament-page > header');
      return {
        getByText(text, options) {
          assert.equal(text, 'Veröffentlicht · Runde 1');
          assert.deepEqual(options, { exact: true });
          return locator('published');
        },
      };
    },
  };
  const panel = {
    getByRole(role, { name }) {
      assert.equal(role, 'heading');
      assert.ok(name.test('Runde 1: Club 1 – Club 2'));
      assert.equal(name.test('Mannschaftsaufstellung'), false);
      return locator('round');
    },
    getByText(text) {
      assert.ok(text.test('Brett 1: Captain 1 – Captain 2'));
      assert.equal(text.test('Brett 2: Captain 1 – Captain 2'), false);
      return locator('board');
    },
  };
  await waitForPublishedBoard(page, panel);
  assert.deepEqual(visible, ['published', 'round', 'board']);
});

test('language switching uses the desktop sidebar and mobile Settings controls', async () => {
  for (const [width, lang, name, menu] of [
    [1280, 'en', 'English', null], [1280, 'de', 'Deutsch', null],
    [390, 'en', 'English', 'Sprache ändern DE'], [390, 'de', 'Deutsch', 'Change Language EN'],
  ]) {
    const calls = [];
    const button = scope => (role, options) => {
      assert.equal(role, 'button');
      return { async click() {
        const label = options.name;
        if (scope === 'sidebar') assert.deepEqual(options, { name, exact: true });
        else assert.ok(label.test(calls.length === 1 ? menu : `flag ${name}`));
        calls.push(scope);
      } };
    };
    const page = {
      viewportSize: () => ({ width }),
      getByRole: button('sidebar'),
      locator(selector) {
        if (selector === '.settings-mobile-view') return { getByRole: button('settings') };
        assert.equal(selector, `html[lang="${lang}"]`);
        return { async waitFor(options) {
          assert.deepEqual(options, { state: 'attached' });
          calls.push('lang');
        } };
      },
    };
    await switchLanguage(page, async route => calls.push(route), lang);
    assert.deepEqual(calls, menu ? ['/settings', 'settings', 'settings', 'lang'] : ['sidebar', 'lang']);
  }
});
