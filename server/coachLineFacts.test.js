'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {lineFacts,settlement}=require('./coachLineFacts');

// Owner QA position (15 Nov 2026): Italian Game after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5,
// with the three server-verified Stockfish 19 lines and scores shown on QA.
const ITALIAN='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const D3='d3 Nf6 Nc3 h6 h3 a6 O-O O-O a3 d6'.split(' ');
const NC3='Nc3 Nf6 d3 h6 Bb3 a5 Nxe5 Nxe5 d4 Bd6'.split(' ');
const C3='c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Nxe4 Bxb4 Nxb4'.split(' ');

test('settlement follows the specified capture AND material/eval gap rule',()=>{
 assert.equal(settlement(ITALIAN,D3,{scoreKind:'cp',scoreWhite:12}).unsettled,false);
 assert.equal(settlement(ITALIAN,NC3,{scoreKind:'cp',scoreWhite:10}).unsettled,true);
 assert.equal(settlement(ITALIAN,[...NC3,'dxe5'],{scoreKind:'cp',scoreWhite:0}).unsettled,true,'gap exactly one pawn still requires settlement');
 assert.equal(settlement(ITALIAN,[...NC3,'dxe5','Bxe5'],{scoreKind:'cp',scoreWhite:10}).unsettled,false);
 assert.equal(settlement(ITALIAN,NC3,{scoreKind:'mate',scoreWhite:3}).unsettled,false,'mate is not a pawn evaluation');
});

test('Italian d3 line: material matches the evaluation, no double attacks, no checks',()=>{
 assert.deepEqual(lineFacts(ITALIAN,D3,{scoreKind:'cp',scoreWhite:12}),{
  materialVsEval:{startWhite:0,endWhite:0,evalWhite:0.12,matchesEval:true},doubleAttacks:[],checks:[]
 });
});

test('Italian Nc3 line: material/eval disagreement and the 8. d4 pawn fork, without a capture',()=>{
 const facts=lineFacts(ITALIAN,NC3,{scoreKind:'cp',scoreWhite:10});
 // White is a knight for a pawn down at the line end while the score is level.
 // This is only a disagreement: the supplied line does not show the recapture.
 assert.deepEqual(facts.materialVsEval,{startWhite:0,endWhite:-2,evalWhite:0.1,matchesEval:false});
 assert.deepEqual(facts.doubleAttacks,[{ply:9,move:'8. d4',side:'white',attacker:{piece:'pawn',square:'d4'},targets:[
  {square:'c5',piece:'bishop',defended:false},{square:'e5',piece:'knight',defended:false}
 ]}]);
 assert.deepEqual(facts.checks,[]);
 // The fork attacks the knight; the line ends with 8... Bd6 and the knight still on e5.
 const end=new Chess(ITALIAN);for(const san of NC3)end.move(san);
 assert.deepEqual(end.get('e5'),{type:'n',color:'b'});
 assert.equal(end.moves().includes('dxe5'),true,'dxe5 is legal after the line');
 assert.equal(JSON.stringify(facts).includes('dxe5'),false,'a legal move after the line is not a line fact');
});

test('Italian c3 line: 6... Bb4+ is listed with the material change to the line end, not as mate',()=>{
 const facts=lineFacts(ITALIAN,C3,{scoreKind:'cp',scoreWhite:8});
 assert.deepEqual(facts.materialVsEval,{startWhite:0,endWhite:-1,evalWhite:0.08,matchesEval:false});
 assert.deepEqual(facts.doubleAttacks,[]);
 assert.deepEqual(facts.checks,[{ply:6,move:'6... Bb4+',side:'black',legalReplies:7,checkmate:false,materialGainForCheckingSide:1}]);
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

test('1.f3 e5 2.g4 Qh4#: checkmate without a capture is listed as a verified mate',()=>{
 const start='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const facts=lineFacts(start,['f3','e5','g4','Qh4#'],{scoreKind:'mate',scoreWhite:-2});
 assert.deepEqual(facts.checks,[{ply:4,move:'2... Qh4#',side:'black',legalReplies:0,checkmate:true,materialGainForCheckingSide:0}]);
 assert.deepEqual(facts.materialVsEval,{startWhite:0,endWhite:0,evalWhite:null,matchesEval:null});
 assert.deepEqual(facts.doubleAttacks,[]);
 // The same mate as a one-move server line from the position before it.
 const before='rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
 assert.deepEqual(lineFacts(before,['Qh4#'],{scoreKind:'mate',scoreWhite:-1}).checks,[{ply:1,move:'2... Qh4#',side:'black',legalReplies:0,checkmate:true,materialGainForCheckingSide:0}]);
});
