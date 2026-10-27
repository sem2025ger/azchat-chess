import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('guest profile panel matches Preview neutral surface and is moderately compact',()=>{
 const src=readFileSync(new URL('../src/screens/ProfileScreen.tsx',import.meta.url),'utf8');
 const guest=src.split('if (!session) {')[1]?.split('// Authentication and the same real profile data')[0];
 assert.ok(guest,'guest form exists');
 assert.match(guest,/md:w-\\[660px\\] lg:w-\\[700px\\]/);
 assert.match(guest,/bg-\\[#171717\\]/);
 assert.doesNotMatch(guest,/bg-chess-gold\\/10 blur-\\[120px\\]/);
 assert.match(guest,/max-w-\\[520px\\]/);
 assert.match(guest,/onSubmit=\\{handleAuth\\}/);
 assert.match(guest,/handleForgotPassword/);
 assert.match(guest,/handleMagicLink/);
});
