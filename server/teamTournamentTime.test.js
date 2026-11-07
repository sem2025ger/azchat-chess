'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { berlinLocalToIso, validateEventTimes } = require('./teamTournamentTime');

test('Europe/Berlin wall-clock conversion matches summer and winter', () => {
  assert.equal(berlinLocalToIso('2026-07-15T12:30'), '2026-07-15T10:30:00.000Z');
  assert.equal(berlinLocalToIso('2026-01-15T12:30'), '2026-01-15T11:30:00.000Z');
});

test('Berlin clock changes: reject missing and repeated times on both transition days', () => {
  for (const local of ['2026-03-29T02:00', '2026-03-29T02:30', '2026-10-25T02:00', '2026-10-25T02:30']) {
    assert.throws(() => berlinLocalToIso(local), { message: 'invalid_time' }, local);
  }
  assert.equal(berlinLocalToIso('2026-03-29T01:59'), '2026-03-29T00:59:00.000Z');
  assert.equal(berlinLocalToIso('2026-03-29T03:00'), '2026-03-29T01:00:00.000Z');
  assert.equal(berlinLocalToIso('2026-10-25T01:59'), '2026-10-24T23:59:00.000Z');
  assert.equal(berlinLocalToIso('2026-10-25T03:00'), '2026-10-25T02:00:00.000Z');
});

test('reject malformed local time and invalid calendar dates', () => {
  for (const local of ['2026-02-30T12:00', '2026-13-01T12:00', '2026-01-01T24:00',
    '2026-01-01T12:00Z', '2026-01-01T12:00+01:00', null, '', '2026-1-1T1:00']) {
    assert.throws(() => berlinLocalToIso(local), { message: 'invalid_time' });
  }
});

test('deadline must be future and before start, in absolute time', () => {
  const now = Date.parse('2026-07-10T09:00:00Z');
  assert.deepEqual(validateEventTimes('2026-07-12T18:00', '2026-07-11T18:00', now),
    { starts_at: '2026-07-12T16:00:00.000Z', registration_deadline: '2026-07-11T16:00:00.000Z' });
  assert.throws(() => validateEventTimes('2026-07-12T18:00', '2026-07-12T18:00', now));
  assert.throws(() => validateEventTimes('2026-07-12T18:00', '2026-07-10T11:00', now));
  assert.throws(() => validateEventTimes('2026-07-11T18:00', '2026-07-12T18:00', now));
});
