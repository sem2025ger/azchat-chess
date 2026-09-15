'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createTimeoutManager } = require('../tmp/src/utils/timeoutManager.ts');

test('TM-1: set schedules a timer and executes callback after delay', async () => {
  const manager = createTimeoutManager();
  let executed = false;

  manager.set('test', () => {
    executed = true;
  }, 20);

  assert.equal(manager.has('test'), true);
  assert.equal(executed, false);

  await new Promise((r) => setTimeout(r, 40));

  assert.equal(executed, true);
  assert.equal(manager.has('test'), false);
});

test('TM-2: set cancels previous timer with same key before scheduling new one', async () => {
  const manager = createTimeoutManager();
  let callCount1 = 0;
  let callCount2 = 0;

  manager.set('myKey', () => {
    callCount1++;
  }, 30);

  // Overwrite immediately
  manager.set('myKey', () => {
    callCount2++;
  }, 40);

  await new Promise((r) => setTimeout(r, 60));

  assert.equal(callCount1, 0, 'First callback must NOT execute');
  assert.equal(callCount2, 1, 'Second callback must execute once');
});

test('TM-3: clear cancels pending timer', async () => {
  const manager = createTimeoutManager();
  let executed = false;

  manager.set('toCancel', () => {
    executed = true;
  }, 20);

  manager.clear('toCancel');
  assert.equal(manager.has('toCancel'), false);

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(executed, false);
});

test('TM-4: clearAll cancels all pending timers completely on unmount', async () => {
  const manager = createTimeoutManager();
  let countA = 0;
  let countB = 0;

  manager.set('timerA', () => { countA++; }, 20);
  manager.set('timerB', () => { countB++; }, 25);

  assert.equal(manager.has('timerA'), true);
  assert.equal(manager.has('timerB'), true);

  manager.clearAll();

  assert.equal(manager.has('timerA'), false);
  assert.equal(manager.has('timerB'), false);

  await new Promise((r) => setTimeout(r, 40));

  assert.equal(countA, 0);
  assert.equal(countB, 0);
});
