import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('guest profile uses compact Preview-colored panel and preserves authentication actions', () => {
 const src=readFileSync(new URL('../src/screens/ProfileScreen.tsx',import.meta.url),'utf8');
 const guest=src.split('if (!session) {')[1]?.split('// Authentication and the same real profile data')[0];
 assert.ok(guest,'guest form exists');
 for (const part of ['md:w-[660px]','lg:w-[700px]','bg-[#171717]','max-w-[520px]','onSubmit={handleAuth}','handleForgotPassword','handleMagicLink']) {
   assert.ok(guest.includes(part),'guest panel must contain '+part);
 }
 assert.ok(!guest.includes('bg-chess-gold/10 blur-[120px]'),'no gold background glow');
});
