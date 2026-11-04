'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {positionFacts}=require('./coachPositionFacts');

const start=new Chess().fen();
const fixtures=[
 {name:'start position: no exposed structures',fen:start,expect:{
  'material.balanceWhite':0,'material.white.p':8,'material.white.n':2,'material.white.bishopPair':true,
  'white.pawns.isolated':[],'white.pawns.passed':[],'white.pawns.pawnIslands':1,
  'white.files.open':[],'black.files.open':[],'white.hanging.undefended':[],
  'white.king.square':'e1','white.king.castled':false,'white.king.pawnShield':3}},
 {name:'isolated d pawn (IQP)',fen:'4k3/8/8/8/3P4/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.isolated':['d4'],'white.pawns.pawnIslands':1,'white.pawns.passed':['d4'],
  'white.pawns.doubledFiles':[],'white.king.pawnShield':0}},
 {name:'doubled white c pawns',fen:'4k3/8/8/8/8/2P5/2P5/4K3 w - - 0 1',expect:{
  'white.pawns.doubledFiles':['c'],'white.pawns.isolated':['c2','c3'],
  'white.pawns.passed':['c2','c3'],'white.pawns.pawnIslands':1}},
 {name:'passed white pawn',fen:'4k3/8/8/3P4/8/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.passed':['d5'],'white.pawns.passedBlockaded':[]}},
 {name:'passed and blockaded white pawn',fen:'4k3/8/3r4/3P4/8/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.passed':['d5'],'white.pawns.passedBlockaded':['d5']}},
 {name:'enemy pawn prevents passage',fen:'4k3/8/2p5/3P4/8/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.passed':[],'black.pawns.passed':[]}},
 {name:'open and half-open files',fen:'4k3/pp6/8/8/8/8/P7/4K3 w - - 0 1',expect:{
  'white.files.open':['c','d','e','f','g','h'],'black.files.open':['c','d','e','f','g','h'],
  'white.files.halfOpen':['b'],'black.files.halfOpen':[]}},
 {name:'white knight d5 outpost',fen:'4k3/8/8/3N4/2P5/8/8/4K3 w - - 0 1',expect:{
  'white.outposts':[{piece:'n',square:'d5'}],'black.outposts':[]}},
 {name:'black c7 pawn can eventually attack d5',fen:'4k3/2p5/8/3N4/2P5/8/8/4K3 w - - 0 1',expect:{
  'white.outposts':[]}},
 {name:'black knight d4 outpost, black to move',fen:'4k3/8/8/2p5/3n4/8/8/4K3 b - - 0 1',expect:{
  'black.outposts':[{piece:'n',square:'d4'}],'white.outposts':[],'black.pawns.passed':['c5']}},
 {name:'white bishop e5 outpost',fen:'4k3/8/8/4B3/3P4/8/8/4K3 w - - 0 1',expect:{
  'white.outposts':[{piece:'b',square:'e5'}]}},
 {name:'hanging white and black rooks',fen:'7k/8/8/3r4/8/8/3R4/K7 w - - 0 1',expect:{
  'white.hanging.static':true,
  'white.hanging.undefended':[{piece:'r',square:'d2',attackers:['d5']}],
  'black.hanging.undefended':[{piece:'r',square:'d5',attackers:['d2']}]}},
 {name:'rook attacked by cheaper pawn',fen:'7k/8/8/8/2p5/3R4/8/K7 w - - 0 1',expect:{
  'white.hanging.lowerValueAttacked':[{piece:'r',square:'d3',attackers:['c4']}],
  'white.hanging.undefended':[{piece:'r',square:'d3',attackers:['c4']}]}},
 {name:'defended rook is not hanging',fen:'7k/8/8/3r4/8/8/3R4/K2R4 w - - 0 1',expect:{
  'white.hanging.undefended':[]}},
 {name:'castled king with full shield',fen:'6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1',expect:{
  'white.king.square':'g1','white.king.castled':true,'white.king.pawnShield':3,
  'black.king.square':'g8','black.king.castled':true,'black.king.pawnShield':3,
  'white.king.openFilesNearKing':[]}},
 {name:'broken shield and open files near king',fen:'6k1/5p2/8/8/8/8/5P2/6K1 w - - 0 1',expect:{
  'white.king.castled':true,'white.king.pawnShield':1,'white.king.openFilesNearKing':['g','h'],
  'black.king.pawnShield':1,'black.king.openFilesNearKing':['g','h']}},
 {name:'black to move preserves both colours',fen:'6k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',expect:{
  'black.king.castled':true,'white.king.castled':true,'black.king.pawnShield':3}},
 {name:'few-piece endgame',fen:'8/8/8/8/3k4/8/3P4/4K3 w - - 0 1',expect:{
  'white.pawns.passed':['d2'],'white.pawns.pawnIslands':1,'black.pawns.pawnIslands':0,
  'white.material.balanceWhite':undefined,'material.balanceWhite':1}},
 {name:'two white bishops',fen:'4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1',expect:{
  'material.white.b':2,'material.white.bishopPair':true,'material.balanceWhite':6}},
 {name:'three separate pawn islands',fen:'4k3/8/8/8/8/8/P1PP1P2/4K3 w - - 0 1',expect:{
  'white.pawns.pawnIslands':3,'white.pawns.isolated':['a2','f2'],
  'white.king.pawnShield':2}},
 {name:'A: own h-pawn and no enemy h-pawn do not expose white king',fen:'6k1/5pp1/8/8/8/8/5PPP/6K1 w - - 0 1',expect:{
  'white.king.openFilesNearKing':[]}},
 {name:'B: enemy g-pawn on a half-open file exposes white king',fen:'6k1/5ppp/8/8/8/8/5P1P/6K1 w - - 0 1',expect:{
  'white.king.openFilesNearKing':['g']}},
 {name:'C: friendly knight in front of white passed pawn is not a blockade',fen:'4k3/8/3N4/3P4/8/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.passed':['d5'],'white.pawns.blockaded':[],'white.pawns.passedBlockaded':[]}},
 {name:'mirrored black: enemy g-pawn on a half-open file exposes black king',fen:'6k1/5p1p/8/8/8/8/5PPP/6K1 b - - 0 1',expect:{
  'black.king.openFilesNearKing':['g']}},
 {name:'D: black knight blockades a non-passed white pawn',fen:'4k3/4p3/8/3n4/3P4/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.blockaded':['d4'],'white.pawns.passed':[],'white.pawns.passedBlockaded':[]}},
 {name:'E: own knight on stop square is an obstruction, not a blockade',fen:'4k3/8/8/3N4/3P4/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.blockaded':[],'white.pawns.passedBlockaded':[]}},
 {name:'F: enemy pawn directly ahead is a pawn ram, not a piece blockade',fen:'4k3/8/8/3p4/3P4/8/8/4K3 w - - 0 1',expect:{
  'white.pawns.blockaded':[],'black.pawns.blockaded':[]}},
 {name:'G: white bishop blockades black passed pawn',fen:'4k3/8/8/3p4/3B4/8/8/4K3 b - - 0 1',expect:{
  'black.pawns.blockaded':['d5'],'black.pawns.passed':['d5'],'black.pawns.passedBlockaded':['d5']}},
 {name:'doubled black f pawns, black to move',fen:'4k3/5p2/5p2/8/8/8/8/4K3 b - - 0 1',expect:{
  'black.pawns.doubledFiles':['f'],'black.pawns.passed':['f6','f7'],
  'black.pawns.isolated':['f6','f7'],'material.balanceWhite':-2}}
];

function readPath(data,path){return path.split('.').reduce((value,key)=>value?.[key],data);}
for(const fixture of fixtures)test('fixed FEN: '+fixture.name,()=>{
 const result=positionFacts(fixture.fen);
 assert.ok(result,'fixture should be valid: '+fixture.fen);
 for(const [path,expected] of Object.entries(fixture.expect))
  assert.deepEqual(readPath(result,path),expected,fixture.name+' / '+path);
 assert.ok(Buffer.byteLength(JSON.stringify(result),'utf8')<=6144,'position facts must fit within 6KB');
 for(const side of ['white','black']){
  assert.equal(result[side].hanging.static,true);
  assert.deepEqual(result[side].pawns.passedBlockaded,
   result[side].pawns.blockaded.filter(square=>result[side].pawns.passed.includes(square)),
   'passedBlockaded must equal blockaded ∩ passed for '+fixture.name+' / '+side);
  for(const key of ['isolated','passed','blockaded','passedBlockaded'])assert.deepEqual(
   result[side].pawns[key],[...result[side].pawns[key]].sort(),'stable square ordering');
  for(const key of ['open','halfOpen'])assert.deepEqual(
   result[side].files[key],[...result[side].files[key]].sort(),'stable file ordering');
 }
});
test('invalid FEN and invalid inputs return null without throwing',()=>{
 for(const invalid of ['not a fen','8/8/8/8/8/8/8/8 w - - 0 1',null,undefined,123,{},''])assert.equal(positionFacts(invalid),null);
});
test('identical FEN always yields identical JSON and size stays bounded',()=>{
 for(const fixture of fixtures){const first=positionFacts(fixture.fen),second=positionFacts(fixture.fen);
  assert.deepEqual(first,second);assert.equal(JSON.stringify(first),JSON.stringify(second));
  assert.ok(Buffer.byteLength(JSON.stringify(first),'utf8')<=6144);
 }
});


// V2 strategy fixtures use hand-specified, independently inspectable FENs.
const v2Cases=[
 {name:'black bad light bishop French-type fixed e6 d5',fen:'2b1k3/8/4p1p1/3pP3/3P4/8/8/4K3 w - - 0 1',
  verify:f=>{const b=f.black.strategy.bishops.find(x=>x.square==='c8');assert.deepEqual(b,{square:'c8',squareColor:'light',sameColorPawns:['d5','e6','g6'],fixedSameColorPawns:['d5','e6'],bad:true});}},
 {name:'black bishop no longer bad with only one fixed pawn',fen:'2b1k3/8/4p1p1/3pP3/8/8/8/4K3 w - - 0 1',
  verify:f=>{const b=f.black.strategy.bishops.find(x=>x.square==='c8');assert.equal(b.sameColorPawns.length,3);assert.deepEqual(b.fixedSameColorPawns,['e6']);assert.equal(b.bad,false);}},
 {name:'white dark bishop fixed d4 e3 bad',fen:'4k3/8/8/3p4/3Pp3/4P1P1/8/2B1K3 w - - 0 1',
  verify:f=>{const b=f.white.strategy.bishops.find(x=>x.square==='c1');assert.deepEqual(b,{square:'c1',squareColor:'dark',sameColorPawns:['d4','e3','g3'],fixedSameColorPawns:['d4','e3'],bad:true});}},
 {name:'white dark bishop only one fixed pawn not bad',fen:'4k3/8/8/3p4/3P4/4P1P1/8/2B1K3 w - - 0 1',
  verify:f=>{const b=f.white.strategy.bishops.find(x=>x.square==='c1');assert.equal(b.bad,false);assert.deepEqual(b.fixedSameColorPawns,['d4']);}},
 {name:'black hole d5 is occupied by enemy white knight',fen:'6k1/8/8/2pNp3/8/8/8/6K1 w - - 0 1',
  verify:f=>{assert.ok(f.black.strategy.holes.includes('d5'));assert.ok(f.black.strategy.holesOccupiedByEnemyPiece.includes('d5'));}},
 {name:'black hole d5 is empty',fen:'6k1/8/8/2p1p3/8/8/8/6K1 w - - 0 1',
  verify:f=>{assert.ok(f.black.strategy.holes.includes('d5'));assert.ok(!f.black.strategy.holesOccupiedByEnemyPiece.includes('d5'));}},
 {name:'white hole d4 occupied by enemy black knight',fen:'6k1/8/8/2P1P3/3n4/8/8/6K1 w - - 0 1',
  verify:f=>{assert.ok(f.white.strategy.holes.includes('d4'));assert.ok(f.white.strategy.holesOccupiedByEnemyPiece.includes('d4'));}},
 {name:'white pawn c2 can advance to protect d4: not a hole',fen:'6k1/8/8/4P3/8/8/2P5/6K1 w - - 0 1',
  verify:f=>{assert.ok(!f.white.strategy.holes.includes('d4'));}},
 {name:'black f6 and h6 are not holes if f7 and h7 pawns can occupy them',fen:'6k1/5p1p/6p1/8/8/8/5PPP/6K1 w - - 0 1',
  verify:f=>{assert.ok(!f.black.strategy.holes.includes('f6'));assert.ok(!f.black.strategy.holes.includes('h6'));}},
 {name:'black h6 remains a hole without a same-file h-pawn',fen:'6k1/5p2/6p1/8/8/8/5PPP/6K1 w - - 0 1',
  verify:f=>{assert.ok(!f.black.strategy.holes.includes('f6'));assert.ok(f.black.strategy.holes.includes('h6'));}},
 {name:'queenside white majority 3 versus 2',fen:'4k3/pp6/8/8/8/8/PPP5/4K3 w - - 0 1',
  verify:f=>{assert.deepEqual(f.majorities.queenside,{white:3,black:2,majority:'white'});assert.equal(f.majorities.centre.majority,null);assert.equal(f.majorities.kingside.majority,null);}},
 {name:'queenside black majority 3 versus 2',fen:'4k3/ppp5/8/8/8/8/PP6/4K3 w - - 0 1',
  verify:f=>{assert.deepEqual(f.majorities.queenside,{white:2,black:3,majority:'black'});}},
 {name:'black queenside minority 2 versus 3 and d-file ram',fen:'4k3/pp6/8/3p4/3P4/8/PPP5/4K3 w - - 0 1',
  verify:f=>{assert.equal(f.black.strategy.minorityAttack,true);assert.equal(f.white.strategy.minorityAttack,false);}},
 {name:'black queenside minority without d-file ram is false',fen:'4k3/pp6/8/3p4/8/8/PPP5/4K3 w - - 0 1',
  verify:f=>{assert.equal(f.black.strategy.minorityAttack,false);}},
 {name:'queenside minority false when equal pawn counts despite d-file ram',fen:'4k3/ppp5/8/3p4/3P4/8/PPP5/4K3 w - - 0 1',
  verify:f=>{assert.equal(f.white.strategy.minorityAttack,false);assert.equal(f.black.strategy.minorityAttack,false);}}
];
for(const sample of v2Cases)test('V2 fixed FEN: '+sample.name,()=>{
 const f=positionFacts(sample.fen);assert.ok(f,'invalid or oversized V2 FEN: '+sample.fen);sample.verify(f);
 assert.ok(Buffer.byteLength(JSON.stringify(f),'utf8')<=6144);
});
test('V2 start: no bad bishops, no holes, no minority attack and equal majorities',()=>{
 const f=positionFacts(start);
 for(const color of ['white','black']){
  assert.equal(f[color].strategy.bishops.length,2);
  assert.equal(f[color].strategy.bishops.every(x=>x.bad===false),true);
  assert.deepEqual(f[color].strategy.holes,[]);
  assert.deepEqual(f[color].strategy.holesOccupiedByEnemyPiece,[]);
  assert.equal(f[color].strategy.minorityAttack,false);
 }
 for(const wing of Object.values(f.majorities))assert.deepEqual(wing,{white:wing.white,black:wing.black,majority:null});
});
test('V2 review minority Capablanca–Golombek has white 2-vs-3 with d-file ram',()=>{
 const fen='r2qrnk1/pp2bpn1/2p3pp/3pNb2/1P1P4/2NBP2P/P1Q2PPB/1R3RK1 w - - 1 18';
 const f=positionFacts(fen);assert.ok(f);
 assert.deepEqual(f.majorities.queenside,{white:2,black:3,majority:'black'});
 assert.equal(f.white.strategy.minorityAttack,true);
 assert.equal(f.black.strategy.minorityAttack,false);
});
test('V2 facts stay under 6144 UTF-8 bytes for old, new and all 10 review fixtures',()=>{
 const review=require('./scripts/positionFactsReview.positions.json');
 const all=[...fixtures.map(x=>({name:x.name,fen:x.fen})),...v2Cases.map(x=>({name:x.name,fen:x.fen})),...review.map(x=>({name:x.id,fen:x.fen}))];
 let largest={name:'',bytes:0};
 for(const item of all){
  const facts=positionFacts(item.fen);assert.ok(facts,'facts must be non-null for '+item.name);
  const bytes=Buffer.byteLength(JSON.stringify(facts),'utf8');
  if(bytes>largest.bytes)largest={name:item.name,bytes};
  assert.ok(bytes<=6144,item.name+' uses '+bytes+' bytes');
 }
 console.log('V2 facts max size: '+JSON.stringify({...largest,positions:all.length}));
});
