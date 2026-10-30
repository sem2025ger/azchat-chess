import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewConfig,reviewBindings,reviewCsp} from '../scripts/buildReview.mjs';

test('visual review never inherits environment files or VITE service credentials',()=>{
 const c=reviewConfig();assert.equal(c.envDir,false);assert.notEqual(c.envPrefix,'VITE_');
 for(const key of ['VITE_SERVER_URL','VITE_SUPABASE_URL'])assert.equal(new URL(reviewBindings[key]).hostname,'chessaz-review.invalid');
 assert.equal(reviewBindings.VITE_SUPABASE_ANON_KEY,'visual-review-no-credentials');
 assert.equal(reviewBindings.VITE_SENTRY_DSN,'');assert.equal(reviewBindings.VITE_MAINTENANCE_MODE,'false');
 assert.equal(c.build.outDir,'dist-review');assert.equal(reviewBindings.VITE_AI_COACH_ENABLED,'true');
});
test('visual review CSP blocks remote APIs while retaining same-origin WASM workers',()=>{
 assert.ok(reviewCsp.includes("connect-src 'self';"));assert.ok(reviewCsp.includes("worker-src 'self' blob:;"));
 assert.ok(reviewCsp.includes("'wasm-unsafe-eval'"));assert.ok(reviewCsp.includes("form-action 'none'"));
 const plugin=reviewConfig().plugins.find(p=>p.name==='isolated-review-policy');
 const meta=plugin.transformIndexHtml();assert.equal(meta.find(m=>m.attrs['http-equiv']==='Content-Security-Policy').attrs.content,reviewCsp);
 assert.equal(meta.find(m=>m.attrs.name==='robots').attrs.content,'noindex,nofollow');
});
