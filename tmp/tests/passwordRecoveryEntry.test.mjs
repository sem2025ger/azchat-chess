import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('recovery fallback routes before React initializes; maintenance still blocks unrelated routes', () => {
  const main = read('../src/main.tsx');
  const app = read('../src/App.tsx');
  assert.ok(main.indexOf("incomingFragment.get('type') === 'recovery'") < main.indexOf("function render("));
  assert.match(main, /history\.replaceState\(null, '', '\/update-password'/);
  assert.match(app, /window\.location\.pathname === '\/update-password'/);
  assert.match(app, /VITE_MAINTENANCE_MODE === 'true' && !isRecoveryRoute/);
});

test('password change requires recovery session and always shows error when link invalid', () => {
  const s = read('../src/screens/UpdatePasswordScreen.tsx');
  assert.match(s, /event === 'PASSWORD_RECOVERY'/);
  assert.match(s, /hasPasswordRecoveryIntent\(\)/);
  assert.match(s, /supabase\.auth\.getUser\(\)/);
  assert.match(s, /clearPasswordRecoveryIntent\(\)/);
  assert.match(s, /navigate\(backTo, \{ replace: true \}\)/);
  assert.match(s, /if \(recoveryStatus !== 'ready'\)/);
  assert.match(s, /disabled=\{loading \|\| !!successMsg \|\| recoveryStatus !== 'ready'\}/);
  assert.match(s, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(s, /max-md:p-4 max-md:rounded-2xl/);
});
