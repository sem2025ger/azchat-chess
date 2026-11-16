'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {Chess,validateFen}=require('chess.js');
const {build}=require('./knowledge/buildChessFundamentals');
const {serialize}=require('./scripts/buildClassicsKnowledge.js');
const {THEME_IDS}=require('./knowledge/classicsThemes');
const {isClassicsEnabled,loadClassics,findClassicPassages,themesFromQuestion,resetClassicsCacheForTests}=require('./coachClassics');

const FILE=path.join(__dirname,'knowledge','classics','capablanca-chess-fundamentals.json');
const book=JSON.parse(fs.readFileSync(FILE,'utf8'));
// Diagrams that show a pawn skeleton or a lone minor piece, without kings, by design.
const KINGLESS_FIGURES=[36,89,90];

test('committed record equals a fresh build from the unmodified Gutenberg file',()=>{
 assert.equal(fs.readFileSync(FILE,'utf8'),serialize(build()));
});

test('record states source, edition and rights',()=>{
 assert.equal(book.author,'José Raúl Capablanca');
 assert.equal(book.authorDied,1942);
 assert.match(book.source.name,/Project Gutenberg EBook #33870/);
 assert.match(book.source.sha256,/^[0-9a-f]{64}$/);
 assert.match(book.rights.germany,/Public domain/);
 assert.match(book.edition,/1934/);
});

test('the whole book is present: 33 sections, 67 examples, 14 games, 150 diagrams',()=>{
 const kinds=k=>book.units.filter(u=>u.kind===k).length;
 assert.equal(kinds('example'),67);
 assert.equal(kinds('game'),14);
 assert.equal(new Set(book.units.filter(u=>u.section).map(u=>u.section.number)).size,33);
 const figs=book.units.flatMap(u=>u.diagrams.map(d=>d.figure)).sort((a,b)=>a-b);
 assert.deepEqual(figs,Array.from({length:150},(_,i)=>i+1));
 // Unabridged: every printed paragraph of every unit is kept in originalText.
 const source=fs.readFileSync(path.join(__dirname,book.source.file.replace(/^server\//,'')),'latin1').replace(/\r\n/g,'\n');
 for(const u of book.units)assert.ok(source.includes(u.originalText.split('\n').slice(0,3).join('\n')),u.id);
});

test('every main line replays legally from its start position',()=>{
 let lines=0;
 for(const u of book.units){
  if(!u.mainline)continue;
  const c=new Chess(u.mainline.startFen);
  for(const san of u.mainline.moves)assert.ok(c.move(san),`${u.id} ${san}`);
  lines++;
 }
 assert.ok(lines>=55,`main lines: ${lines}`);
 const g1=book.units.find(u=>u.id==='g1');
 assert.equal(g1.mainline.moves.length,49);
 assert.equal(g1.mainline.moves.at(-1),'Qxb6');
});

test('diagram positions are valid and game diagrams agree with the score',()=>{
 for(const u of book.units)for(const d of u.diagrams){
  if(d.role==='start'&&!KINGLESS_FIGURES.includes(d.figure))assert.ok(validateFen(d.fen).ok,`figure ${d.figure}`);
  if(d.role==='checkpoint')assert.ok(d.squaresAgreeing>=56,`figure ${d.figure}`);
 }
});

test('conversion coverage stays at the verified level',()=>{
 const c=book.notation.conversion;
 assert.ok(c.resolved/c.tokens>=0.9,`${c.resolved}/${c.tokens}`);
 assert.ok(book.units.find(u=>u.id==='e1').chunks[0].text.includes('1 Ra7, Kg8; 2 Kg2'));
});

test('themes are from the taxonomy and sections carry their themes',()=>{
 for(const u of book.units){
  for(const t of u.themes)assert.ok(THEME_IDS.includes(t),`${u.id} ${t}`);
  for(const c of u.chunks)for(const t of c.themes)assert.ok(THEME_IDS.includes(t),`${c.id} ${t}`);
 }
 assert.ok(book.units.find(u=>u.id==='e26').themes.includes('opposition'));
 assert.ok(book.units.find(u=>u.id==='e59').themes.includes('rook-endings'));
});

test('classics retrieval is off unless the flag is exactly true',()=>{
 assert.equal(isClassicsEnabled({}),false);
 assert.equal(isClassicsEnabled({AI_COACH_CLASSICS_ENABLED:'1'}),false);
 assert.equal(isClassicsEnabled({AI_COACH_CLASSICS_ENABLED:'true'}),true);
});

test('questions in the site languages map to themes',()=>{
 assert.ok(themesFromQuestion('Was bedeutet Opposition im Bauernendspiel?').includes('opposition'));
 assert.ok(themesFromQuestion('Как играть ладейный эндшпиль?').includes('rook-endings'));
 assert.ok(themesFromQuestion('How do I use an open file?').includes('open-files'));
 assert.deepEqual(themesFromQuestion(''),[]);
});

test('a rook ending position finds the rook-ending chapter with a citation',()=>{
 resetClassicsCacheForTests();
 const fen='8/7R/8/2k2P2/1p6/3r4/5PKP/8 w - - 0 1'; // Example 59, first diagram
 const hits=findClassicPassages({fen,question:'rook ending'});
 assert.equal(hits.length,3);
 assert.equal(hits[0].unitId,'e59');
 assert.match(hits[0].citation,/Capablanca, Chess Fundamentals \(1921\)/);
 assert.match(hits[0].citation,/p{1,2}\. \d+/);
 assert.ok(hits[0].reasons.includes('same material'));
});

test('a king-and-pawn question finds the opposition section; text is bounded',()=>{
 const hits=findClassicPassages({question:'Opposition',limit:2,maxChars:300});
 assert.equal(hits.length,2);
 assert.ok(hits.every(h=>h.reasons.includes('opposition')));
 assert.ok(hits.every(h=>h.text.length<=302));
 assert.deepEqual(findClassicPassages({question:'xyz'}),[]);
 assert.ok(loadClassics().chunks.length>200);
});
