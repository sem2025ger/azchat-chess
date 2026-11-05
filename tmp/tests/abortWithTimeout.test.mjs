import test from 'node:test';
import assert from 'node:assert/strict';
import { abortWithTimeout } from '../src/lib/abortWithTimeout.ts';
import { createSpieltagApi } from '../src/services/spieltag.ts';
import { createVorbereitungApi } from '../src/services/vorbereitung.ts';

function removeStaticMethod(t, name) {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, name);
  delete AbortSignal[name];
  t.after(() => Object.defineProperty(AbortSignal, name, descriptor));
}

for (const missingMethod of [null, 'any', 'timeout']) {
  const mode = missingMethod ? 'without AbortSignal.' + missingMethod : 'native';
  test(mode + ' propagates caller abort and an already aborted caller', t => {
    if (missingMethod) removeStaticMethod(t, missingMethod);
    const caller = new AbortController();
    const reason = new Error('caller cancelled');
    const pending = abortWithTimeout(caller.signal, 500);
    try {
      assert.equal(pending.signal.aborted, false);
      caller.abort(reason);
      assert.equal(pending.signal.aborted, true);
      assert.equal(pending.signal.reason, reason);
      const alreadyAborted = abortWithTimeout(caller.signal, 500);
      assert.equal(alreadyAborted.signal.aborted, true);
      assert.equal(alreadyAborted.signal.reason, reason);
      alreadyAborted.cancel();
    } finally {
      pending.cancel();
    }
  });

  test(mode + ' aborts on timeout', async t => {
    if (missingMethod) removeStaticMethod(t, missingMethod);
    const caller = new AbortController();
    const pending = abortWithTimeout(caller.signal, 5);
    try {
      await new Promise((resolve, reject) => {
        const guard = setTimeout(() => reject(new Error('timeout did not abort')), 500);
        pending.signal.addEventListener('abort', () => { clearTimeout(guard); resolve(); }, { once: true });
      });
      assert.equal(pending.signal.aborted, true);
      assert.equal(pending.signal.reason.name, 'TimeoutError');
      assert.equal(caller.signal.aborted, false);
    } finally {
      pending.cancel();
    }
  });

  if (missingMethod) {
    test(mode + ' cancel clears the timer and detaches the listener', t => {
      removeStaticMethod(t, missingMethod);
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const caller = new AbortController();
      const pending = abortWithTimeout(caller.signal, 10);
      pending.cancel();
      pending.cancel();
      t.mock.timers.tick(20);
      caller.abort();
      assert.equal(pending.signal.aborted, false);
    });
  }
}

test('all three service reads clean up fallback signals after success or failure', async t => {
  removeStaticMethod(t, 'any');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controllers = [], signals = [];
  const outcomes = [
    [false, () => new Response(JSON.stringify({ teams: [], games: [], nickname: 'fixture', rejected: 0 }))],
    [true, () => { throw new Error('network failed'); }],
    [true, () => ({ ok: true, json: async () => { throw new Error('invalid json'); } })],
    [true, () => new Response(JSON.stringify({ code: 'provider_unavailable' }), { status: 503 })],
  ];
  for (const [rejects, respond] of outcomes) {
    const fetchImpl = async (_url, { signal }) => { signals.push(signal); return respond(); };
    const spieltag = createSpieltagApi('https://qa.example', 'fixture', fetchImpl);
    const preparation = createVorbereitungApi('https://qa.example', fetchImpl);
    for (const read of [
      signal => spieltag.teams(signal),
      signal => preparation.named({ name: 'Fixture' }, 'fixture', signal),
      signal => preparation.load('fixture', 'fixture', signal),
    ]) {
      const caller = new AbortController();
      controllers.push(caller);
      const request = read(caller.signal);
      if (rejects) await assert.rejects(request);
      else await request;
    }
  }
  t.mock.timers.tick(30000);
  controllers.forEach(caller => caller.abort());
  assert.equal(signals.length, 12);
  assert.ok(signals.every(signal => !signal.aborted), 'finally cancels each fallback timer and listener');
});
