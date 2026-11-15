'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {lineFacts}=require('./coachLineFacts');

// Owner QA position (15 Nov 2026): Italian Game after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5,
// with the three server-verified Stockfish 19 lines and scores shown on QA.
const ITALIAN='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const D3='d3 Nf6 Nc3 h6 h3 a6 O-O O-O a3 d6'.split(' ');
const NC3='Nc3 Nf6 d3 h6 Bb3 a5 Nxe5 Nxe5 d4 Bd6'.split(' ');
const C3='c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Nxe4 Bxb4 Nxb4'.split(' ');

test('Italian d3 line: material matches the evaluation, no double attacks, no checks',()=>{
 assert.deepEqual(lineFacts(ITALIAN,D3,{scoreKind:'cp',scoreWhite:12}),{
  materialVsEval:{startWhite:0,endWhite:0,evalWhite:0.12,matchesEval:true},doubleAttacks:[],checks:[]
 });
});

test('Italian Nc3 line: temporary piece sacrifice and the 8. d4 pawn fork',()=>{
 const facts=lineFacts(ITALIAN,NC3,{scoreKind:'cp',scoreWhite:10});
 // White is a knight for a pawn down at the line end while the score is level:
 // the count is not the result of the line (the piece comes back).
 assert.deepEqual(facts.materialVsEval,{startWhite:0,endWhite:-2,evalWhite:0.1,matchesEval:false});
 assert.deepEqual(facts.doubleAttacks,[{ply:9,move:'8. d4',side:'white',attacker:{piece:'pawn',square:'d4'},targets:[
  {square:'c5',piece:'bishop',defended:false},{square:'e5',piece:'knight',defended:false}
 ]}]);
 assert.deepEqual(facts.checks,[]);
});

test('Italian c3 line: 6... Bb4+ wins a pawn only temporarily, so it is not a lasting threat',()=>{
 const facts=lineFacts(ITALIAN,C3,{scoreKind:'cp',scoreWhite:8});
 assert.deepEqual(facts.materialVsEval,{startWhite:0,endWhite:-1,evalWhite:0.08,matchesEval:false});
 assert.deepEqual(facts.doubleAttacks,[]);
 assert.deepEqual(facts.checks,[{ply:6,move:'6... Bb4+',side:'black',legalReplies:7,materialGainForCheckingSide:1}]);
});

test('equal-value defended targets are not a double attack',()=>{
 // 7. Nxe5 attacks the defended knight on c6 and defended pawns only.
 const facts=lineFacts(ITALIAN,NC3.slice(0,7),{scoreKind:'cp',scoreWhite:10});
 assert.equal(facts.doubleAttacks.length,0);
});

test('a knight fork of king and rook is listed; mate scores are not compared with material',()=>{
 // Nb5-c7+ forks the king on e8 and the undefended rook on a8.
 const fen='r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
 const facts=lineFacts(fen,['Nc7+'],{scoreKind:'mate',scoreWhite:12});
 assert.deepEqual(facts.doubleAttacks,[{ply:1,move:'1. Nc7+',side:'white',attacker:{piece:'knight',square:'c7'},targets:[
  {square:'a8',piece:'rook',defended:false},{square:'e8',piece:'king',defended:false}
 ]}]);
 assert.equal(facts.checks.length,1);
 assert.equal(facts.checks[0].materialGainForCheckingSide,0);
 assert.deepEqual(facts.materialVsEval,{startWhite:-2,endWhite:-2,evalWhite:null,matchesEval:null});
});

test('an illegal move throws so the caller can drop the facts',()=>{
 assert.throws(()=>lineFacts(ITALIAN,['O-O','BAD-SAN'],{scoreKind:'cp',scoreWhite:0}));
});
