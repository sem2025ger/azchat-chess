import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css=readFileSync('src/screens/RegionOverview.css','utf8');
const layout=readFileSync('src/components/Layout.tsx','utf8');
const site=readFileSync('src/index.css','utf8');
const home=readFileSync('src/screens/HomeScreen.tsx','utf8');
const board=readFileSync('src/components/ChessBoard.tsx','utf8');

test('NRW uses cool, light metallic bronze only within the region shell',()=>{
 assert.match(css,/\.nrw-shell\s*\{\s*--nrw-metal:#C7BBA8/);
 assert.match(css,/\.nrw-shell \.nrw-card-head h2/);
 assert.match(css,/background-image:var\(--nrw-metallic-gradient\)/);
 assert.match(css,/\.nrw-shell \.nrw-items strong\{color:#E8EAEB/);
 assert.match(css,/\.nrw-shell :is\(\.nrw-header p,\.nrw-muted,\.nrw-card-subtitle/);
});
test('only Schach-Treff and NRW desktop sidebar labels receive metallic treatment',()=>{
 const highlighted=[...layout.matchAll(/<NavItem[^\n]*bronzeLabel/g)].map(m=>m[0]);
 assert.equal(highlighted.length,2);
 assert.ok(highlighted.some(m=>m.includes('label="Schach-Treff"')));
 assert.ok(highlighted.some(m=>m.includes('label="NRW – Schach"')));
 assert.match(site,/aside \.site-nav-link \.site-nav-label--bronze/);
});
test('desktop Home board remains in its visual plane beside balanced Arena panels',()=>{
 assert.match(site,/grid-template-columns:minmax\(0,1\.2fr\) minmax\(320px,\.8fr\)/);
 assert.match(site,/max-width:min\(634px,calc\(100dvh - 100px\)\)/);
 assert.match(site,/\.home-board-column\{[^}]*perspective:1400px/);
 assert.match(site,/\.home-dashboard-column\{[^}]*max-width:420px/);
 assert.doesNotMatch(site.slice(0,site.indexOf('/* Native route scroll only')),/translateZ\(|scale\(/);
});

test('desktop Home board sits closer to the frame without altering mobile or the 8x8 grid',()=>{
 assert.match(home,/overrideBoardTheme="Classic Wood" homeBlackInk homeChessComPalette=\{homeChessComPieces\} className="!border-none !p-1 md:!p-3 xl:!p-0"/);
 assert.match(board,/grid grid-cols-8 grid-rows-8 w-full h-full/);
 assert.match(home,/home-board-frame max-md:hidden/);
});

test('desktop Home board has a flat square grid in a responsive fitted frame, without 3D skew',()=>{
 assert.match(home,/relative w-full aspect-square/);
 assert.match(home,/board-perspective home-board home-board-frame max-md:hidden/);
 assert.doesNotMatch(home,/xl:rotate-[xy]-\[|hover:rotate-[xy]-/);
 assert.match(site,/\.home-board-column\{[^}]*max-width:min\(634px,calc\(100dvh - 100px\)\)/);
 assert.match(board,/grid grid-cols-8 grid-rows-8 w-full h-full/);
});

test('desktop Home board fits its rounded frame without external ring overflow',()=>{
 assert.match(home,/relative w-full aspect-square rounded-\[1rem\] md:rounded-\[2rem\] xl:p-3 overflow-hidden/);
 assert.match(home,/ring-2 ring-white\/10 xl:ring-0/);
 assert.match(home,/homeBlackInk homeChessComPalette=\{homeChessComPieces\} className="!border-none !p-1 md:!p-3 xl:!p-0"/);
 assert.match(board,/className="aspect-square w-full rounded-sm overflow-hidden/);
});
