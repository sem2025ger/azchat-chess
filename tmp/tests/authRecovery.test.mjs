import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { observePasswordRecovery } from '../src/utils/authRecovery.ts';

const session = id => ({ user: { id } });
function authFixture() {
  const listeners = new Set();
  return {
    onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    emit: (event, value) => { for (const callback of listeners) callback(event, value); },
  };
}

test('early recovery survives delayed UI mount; ordinary sessions cannot unlock reset', () => {
  const auth = authFixture();
  const tracker = observePasswordRecovery(auth);
  auth.emit('INITIAL_SESSION', session('a'));
  assert.equal(tracker.isVerified(session('a')), false);
  auth.emit('PASSWORD_RECOVERY', session('a'));
  auth.emit('INITIAL_SESSION', session('a'));
  assert.equal(tracker.isVerified(session('a')), true);
  assert.equal(tracker.isVerified(session('b')), false);
  auth.emit('TOKEN_REFRESHED', session('a'));
  assert.equal(tracker.isVerified(session('a')), true);
  auth.emit('SIGNED_IN', session('a'));
  assert.equal(tracker.isVerified(session('a')), false);
  tracker.dispose();
});

test('password update, logout, different user and disposal invalidate recovery proof', () => {
  for (const [event, next] of [['USER_UPDATED', session('a')], ['SIGNED_OUT', null], ['TOKEN_REFRESHED', session('b')]]) {
    const auth = authFixture();
    const tracker = observePasswordRecovery(auth);
    auth.emit('PASSWORD_RECOVERY', session('a'));
    auth.emit(event, next);
    assert.equal(tracker.isVerified(session('a')), false);
    tracker.dispose();
    auth.emit('PASSWORD_RECOVERY', session('a'));
    assert.equal(tracker.isVerified(session('a')), false);
  }
});

test('real Supabase SDK consumes recovery URL before late React subscription, early observer retains proof', async () => {
  const originals = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const location = new URL('https://qa.invalid/update-password#access_token=test-access&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location, history: { state: null, replaceState: () => {} }, addEventListener: () => {}, removeEventListener: () => {},
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {},
  } });
  let tracker;
  let lateSubscription;
  let client;
  try {
    client = createClient('https://qa.invalid', 'test-public-key', {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: true },
      global: { fetch: async url => {
        assert.equal(String(url), 'https://qa.invalid/auth/v1/user');
        return new Response(JSON.stringify({ id: 'qa-recovery-user', aud: 'authenticated', app_metadata: {}, user_metadata: {} }), { headers: { 'Content-Type': 'application/json' } });
      } },
    });
    tracker = observePasswordRecovery(client.auth);
    await client.auth.initialize();
    // Wait for the real SDK's scheduled PASSWORD_RECOVERY emission before UI mount.
    await new Promise(done => setTimeout(done, 20));
    const lateEvents = [];
    lateSubscription = client.auth.onAuthStateChange(event => { lateEvents.push(event); }).data.subscription;
    const { data, error } = await client.auth.getSession();
    assert.equal(error, null);
    assert.equal(location.hash, '', 'SDK should have removed the credentials from the URL');
    assert.equal(lateEvents.includes('PASSWORD_RECOVERY'), false, 'A late UI subscription cannot replay the recovery event');
    assert.equal(tracker.isVerified(data.session), true, 'Verified event must remain available when React mounts');
  } finally {
    lateSubscription?.unsubscribe();
    tracker?.dispose();
    await client?.auth.stopAutoRefresh();
    for (const key of Object.keys(originals)) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]); else delete globalThis[key];
    }
  }
});
