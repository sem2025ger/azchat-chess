'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {Chess,validateFen}=require('chess.js');
const {build}=require('./knowledge/buildChessFundamentals');
const {build:buildAlekhine}=require('./knowledge/buildAlekhineBestGames');
const {serialize}=require('./scripts/buildClassicsKnowledge.js');
const {THEME_IDS}=require('./knowledge/classicsThemes');
const {isClassicsEnabled,loadClassics,findClassicPassages,themesFromQuestion,themesFromPositionFacts,resetClassicsCacheForTests}=require('./coachClassics');

const FILE=path.join(__dirname,'knowledge','classics','capablanca-chess-fundamentals.json');
const ALEKHINE_FILE=path.join(__dirname,'knowledge','classics','alekhine-best-games-1908-1923.json');
const book=JSON.parse(fs.readFileSync(FILE,'utf8'));
const alekhineBook=JSON.parse(fs.readFileSync(ALEKHINE_FILE,'utf8'));
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

test('committed Alekhine record equals a fresh build and obeys copyright rules',()=>{
 assert.equal(fs.readFileSync(ALEKHINE_FILE,'utf8'),serialize(buildAlekhine()));
 assert.equal(alekhineBook.author,'Alexander Alekhine');
 assert.equal(alekhineBook.rights.translatorPublicDomainEUYear,2037);
 assert.equal(alekhineBook.units.length,100);
 assert.deepEqual(alekhineBook.units.map(u=>u.gameNumber),Array.from({length:100},(_,i)=>i+1));
 assert.equal(alekhineBook.stats.pdfPagesProcessed,292);
 assert.equal(alekhineBook.stats.mainlineMoves,7060);
 assert.equal(alekhineBook.stats.variations,499);
 assert.equal(alekhineBook.stats.variationMoves,3390);
 assert.equal(alekhineBook.stats.totalValidatedMoves,10450);
 assert.equal(alekhineBook.stats.diagrams,295);
 assert.equal(alekhineBook.stats.annotations,547);
 assert.equal(alekhineBook.stats.totalGeneratedFens,11344);
 assert.equal(alekhineBook.stats.uniqueGeneratedFens,9811);
 assert.equal(alekhineBook.errata.length,48);
 for(const e of alekhineBook.errata)assert.ok(typeof e.note==='string'&&e.note.trim().length>0,`erratum note must be descriptive string for game ${e.gameNumber}`);
 // Regression: Games 10 and 21 replay completely (113 and 91 plies), no draft leaks or broken errata FENs in positionKeys.
 assert.equal(alekhineBook.units.find(u=>u.id==='g10').mainline.length,113);
 assert.equal(alekhineBook.units.find(u=>u.id==='g21').mainline.length,91);
 for(const u of alekhineBook.units){
  assert.equal(Object.hasOwn(u,'originalText'),false,u.id);
  for(const d of u.diagrams)if(d.printerErratum)assert.equal(typeof d.printerErratum,'string',`${u.id} diag ${d.index}`);
  for(const a of u.annotations)assert.equal(Object.hasOwn(a,'originalText'),false,u.id);
  for(const c of u.chunks)assert.doesNotMatch(c.text,/\(wait:|20\.dxe5\? no,|Actually 6\. Nh3|18\.fxe6!! Bxd1/,c.id);
 }
});

test('every Alekhine mainline, variation and diagram validates in chess.js',()=>{
 for(const u of alekhineBook.units){
  const c=new Chess(u.startFen);
  for(const san of u.mainline)assert.ok(c.move(san),`${u.id} ${san}`);
  for(const d of u.diagrams)assert.ok(validateFen(d.fen).ok,`${u.id} diag ${d.index}`);
  for(const a of u.annotations){
   for(const v of a.variations||[]){
    const vc=new Chess(v.startFen);
    for(const san of v.moves)assert.ok(vc.move(san),`${u.id} var ${v.label} ${san}`);
   }
  }
 }
});

test('Alekhine position and question retrieval work alongside Capablanca',()=>{
 resetClassicsCacheForTests();
 const g97=alekhineBook.units.find(u=>u.id==='g97');
 const diag20=g97.diagrams[1];
 const byFen=findClassicPassages({fen:diag20.fen,question:'Alekhine sacrifice plan'});
 assert.equal(byFen[0].bookId,'alekhine-best-games-1908-1923');
 assert.equal(byFen[0].unitId,'g97');
 assert.ok(byFen[0].reasons.includes('exact position'));
 assert.match(byFen[0].citation,/Alexander Alekhine, My Best Games of Chess 1908-1923 \(1927\), Game 97:/);

 const byLang=findClassicPassages({question:'Алехин сицилианская жертва ферзя',limit:2});
 assert.ok(byLang.some(h=>h.bookId==='alekhine-best-games-1908-1923'));

 assert.ok(themesFromPositionFacts({white:{pawns:{isolated:['d4']}},black:{pawns:{passed:['e5']}},material:{white:{bishopPair:true}}}).includes('bishop-pair'));

 const capaFen='8/7R/8/2k2P2/1p6/3r4/5PKP/8 w - - 0 1';
 const capaHits=findClassicPassages({fen:capaFen,question:'rook ending'});
 assert.equal(capaHits[0].unitId,'e59');
});

test('QA regressions: exact-game priority, opposition endgame, opening noise, six languages and bookId:unitId dedup',()=>{
 resetClassicsCacheForTests();
 // 1. Game 89 exact board position before 20.Bxh7+! ranks Game 89 #1 despite multi-theme units.
 const g89=alekhineBook.units.find(u=>u.id==='g89');
 const b89=new Chess(g89.startFen);
 for(let i=0;i<38;i++)b89.move(g89.mainline[i]);
 const hits89=findClassicPassages({fen:b89.fen(),themes:['open-files','holes-outposts','passed-pawn','bishop-pair'],question:'Bu mövqedə ağların şaha hücum və feda planı necədir?',limit:2});
 assert.equal(hits89[0].bookId,'alekhine-best-games-1908-1923');
 assert.equal(hits89[0].unitId,'g89');

 // 2. Pure K+P vs K opposition endgame ranks Capablanca pawn-ending lesson #1 ahead of full-game Alekhine units.
 const kpHits=findClassicPassages({fen:'4k3/8/8/4P3/4K3/8/8/8 w - - 0 1',themes:['pawn-structure','passed-pawn','open-files'],question:'Wie gewinnt Weiß dieses Bauernendspiel mit der Opposition und aktivem König?',limit:2});
 assert.equal(kpHits[0].bookId,'capablanca-chess-fundamentals');
 assert.ok(kpHits[0].reasons.includes('opposition'));

 // 3. Generic starting position and early Ruy Lopez 3...a6 do not claim false exact-position matches.
 const startHits=findClassicPassages({fen:new Chess().fen(),question:'opening development',limit:3});
 assert.ok(startHits.every(h=>!h.reasons.includes('exact position')));
 const ruy=new Chess();for(const m of ['e4','e5','Nf3','Nc6','Bb5','a6'])ruy.move(m);
 const ruyHits=findClassicPassages({fen:ruy.fen(),question:'Ruy Lopez plan',limit:3});
 assert.ok(ruyHits.every(h=>!h.reasons.includes('exact position')));

 // 4. Six-language query mapping coverage (EN, DE, RU, UK, AZ, TR).
 assert.ok(themesFromQuestion('How to conduct a kingside attack?').includes('attack-on-king'));
 assert.ok(themesFromQuestion('Best defensive plan here?').includes('defence'));
 assert.ok(themesFromQuestion('Преимущество коня против плохого слона').includes('minor-pieces'));
 assert.ok(themesFromQuestion('Як провести атаку на короля?').includes('attack-on-king'));
 assert.ok(themesFromQuestion('təcrid olunmuş piyada və fil cütü').includes('pawn-structure'));
 assert.ok(themesFromQuestion('təcrid olunmuş piyada və fil cütü').includes('bishop-pair'));
 assert.ok(themesFromQuestion('izole piyon ve fil çifti').includes('pawn-structure'));
 assert.ok(themesFromQuestion('izole piyon ve fil çifti').includes('bishop-pair'));

 // 5. Cross-book g1..g14 unit IDs do not collide in deduplication.
 const bothG5=findClassicPassages({fen:ruy.fen(),question:'Capablanca Alekhine Ruy Lopez',limit:10});
 assert.ok(bothG5.some(h=>h.bookId==='capablanca-chess-fundamentals'));
 assert.ok(bothG5.some(h=>h.bookId==='alekhine-best-games-1908-1923'));
});
