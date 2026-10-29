import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('guest profile uses compact Preview-colored panel and preserves authentication actions', () => {
 const src=readFileSync(new URL('../src/screens/ProfileScreen.tsx',import.meta.url),'utf8');
 const guest=src.split('if (!session) {')[1]?.split('// Authentication and the same real profile data')[0];
 assert.ok(guest,'guest form exists');
 for (const part of ['md:w-[620px]','lg:w-[660px]','bg-[#171717]','max-w-[520px]','onSubmit={handleAuth}','handleForgotPassword','handleMagicLink']) {
   assert.ok(guest.includes(part),'guest panel must contain '+part);
 }
 assert.ok(!guest.includes('bg-chess-gold/10 blur-[120px]'),'no gold background glow');
 assert.ok(!guest.includes('panel-glow-cycle'),'guest panel has no glowing border');
 assert.ok(!guest.includes('shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95)]'),'guest panel has no dramatic outer shadow');
 assert.ok(guest.includes('shadow-none'),'guest panel shadow disabled');
});
