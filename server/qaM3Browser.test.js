'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForPublishedBoard } = require('./scripts/qaM3Browser');

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
