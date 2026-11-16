'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {resolveDescriptive,findMoveTokens}=require('./knowledge/descriptiveNotation');
const {UnitTracker,extractRuns}=require('./knowledge/notationTracker');

function after(moves){const c=new Chess();for(const m of moves.split(' '))if(m)c.move(m);return c;}

test('descriptive moves resolve to SAN only in a concrete position',()=>{
 assert.equal(resolveDescriptive(after(''),'P - K 4').san,'e4');
 assert.equal(resolveDescriptive(after('e4'),'P - K 4').san,'e5');
 assert.equal(resolveDescriptive(after('e4 e5'),'Kt - K B 3').san,'Nf3');
 assert.equal(resolveDescriptive(after('e4 e5 Nf3'),'Kt - Q B 3').san,'Nc6');
 assert.equal(resolveDescriptive(after('e4 e5 Nf3 Nc6 Bc4 Bc5'),'O - O').san,'O-O');
 assert.equal(resolveDescriptive(after('e4 e5 Nf3 Nc6 Bc4 Bc5'),'Castles').san,'O-O');
 assert.equal(resolveDescriptive(after('e4 d5'),'P × P').san,'exd5');
 assert.equal(resolveDescriptive(after('e4 d5'),'P X P').san,'exd5');
});

test('an ambiguous printed move is not guessed',()=>{
 // After 1.e4 e5 2.d4 exd4 3.Nf3 Nc6, "B - Kt 5" fits both Bg5 and Bb5, neither a check.
 const r=resolveDescriptive(after('e4 e5 d4 exd4 Nf3 Nc6'),'B - Kt 5');
 assert.equal(r.error,'ambiguous');
 assert.deepEqual(r.candidates.map(m=>m.san).sort(),['Bb5','Bg5']);
 // A full file name decides it.
 assert.equal(resolveDescriptive(after('e4 e5 d4 exd4 Nf3 Nc6'),'B - K Kt 5').san,'Bg5');
 assert.equal(resolveDescriptive(after('e4 e5 d4 exd4 Nf3 Nc6'),'B - Q Kt 5').san,'Bb5');
});

test('printed check and the named rook break ties',()=>{
 const c=new Chess('r1r3k1/p2q1ppp/P1b5/2Qp4/8/2P1PN2/5PPP/RR4K1 b - - 0 21');
 assert.equal(resolveDescriptive(c,'Q R - Kt 1').san,'Rab8');
 // Knights on d4 and e4 can both reach a B6 square; only Nf6 gives check.
 const g=new Chess('6k1/8/8/8/3NN3/8/8/4K3 w - - 0 1');
 assert.equal(resolveDescriptive(g,'Kt - B 6 ch').san,'Nf6+');
 assert.equal(resolveDescriptive(g,'Kt - B 6').san,'Nc6');
});

test('illegal readings are refused',()=>{
 assert.equal(resolveDescriptive(after(''),'Kt - K 5').error,'no_legal_match');
 assert.equal(resolveDescriptive(after(''),'Q - R 5').error,'no_legal_match');
});

test('move tokens are found in prose and score lines',()=>{
 const toks=findMoveTokens('If K - R 2; 2 Q - Kt 6 ch, K - R 1; 3 K - R 6 ! and P × P e.p.').map(t=>t.text);
 assert.deepEqual(toks,['K - R 2','Q - Kt 6 ch','K - R 1','K - R 6 !','P × P e.p.']);
 assert.deepEqual(findMoveTokens('The Queen Bishop and the centre.'),[]);
});

test('a game score is resolved as one sequence, so later moves settle an ambiguity',()=>{
 const text=['        1. P - K 4                P - K 3','        2. P - Q 4                P - Q 4','        3. Kt - Q B 3             Kt - K B 3','        4. B - Kt 5               B - K 2','        5. P - K 5                K Kt - Q 2','        6. B × B                  Q × B'].join('\n');
 const runs=extractRuns(text,{tabularMainline:true});
 const t=new UnitTracker({gameMode:true});t.prepareScore(runs);
 for(const r of runs)t.processRun(r);
 assert.deepEqual(t.mainlineSans(),['e4','e6','d4','d5','Nc3','Nf6','Bg5','Be7','e5','Nfd7','Bxe7','Qxe7']);
});

test('numbered notes branch from the score; "followed by" skips the reply',()=>{
 const text=['        1. P - K 4                P - K 4','        2. Kt - K B 3','','If 2...P - Q 3; 3 P - Q 4, followed by Kt - B 3.'].join('\n');
 const runs=extractRuns(text,{tabularMainline:true});
 const t=new UnitTracker({gameMode:true});t.prepareScore(runs);
 const sans=runs.flatMap(r=>t.processRun(r).map(x=>x.san));
 assert.deepEqual(sans,['e4','e5','Nf3','d6','d4','Nc3']);
 assert.deepEqual(t.mainlineSans(),['e4','e5','Nf3']);
});
