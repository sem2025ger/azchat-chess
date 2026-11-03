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
 assert.ok(Buffer.byteLength(JSON.stringify(result),'utf8')<=4096,'position facts must fit within 4KB');
 for(const side of ['white','black']){
  assert.equal(result[side].hanging.static,true);
  for(const key of ['isolated','passed','passedBlockaded'])assert.deepEqual(
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
  assert.ok(Buffer.byteLength(JSON.stringify(first),'utf8')<=4096);
 }
});
