'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Chess}=require('chess.js');
const {replayMove,replayKey}=require('./positionReplay');const {positionHash}=require('./positionIndex');
test('fast replay equals original SAN, normalized key and hash at every ply, including castles, promotions, mate and legal/pinned EP',()=>{
 const cases=[{moves:'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be7 f3 O-O'}, {moves:'e4 a6 e5 d5 exd6 cxd6'}, {moves:'f3 e5 g4 Qh4#'}, {fen:'4k3/P7/8/8/8/8/8/4K3 w - - 0 1',moves:'a8=Q+'},{fen:'4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1',moves:'Nbd2'},{fen:'4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',moves:'O-O-O'},{fen:'8/8/8/r4pPK/8/8/8/4k3 w - f6 0 1',moves:'g6'}];
 let seed=27;for(let i=0;i<40;i++){const g=new Chess(),moves=[];for(let p=0;p<60;p++){const options=g.moves();if(!options.length)break;seed=(Math.imul(seed,1664525)+1013904223)>>>0;moves.push(g.move(options[seed%options.length]).san);}cases.push({moves:moves.join(' ')});}
 for(const c of cases){const old=new Chess(c.fen),fast=new Chess(c.fen);const check=()=>{const key=old.fen().split(' ').slice(0,4).join(' ');assert.equal(replayKey(fast),key);assert.equal(positionHash(replayKey(fast)),positionHash(key));};check();for(const token of c.moves.split(' ')){assert.equal(replayMove(fast,token),old.move(token).san,token);check();}}
});
test('fast replay rejects illegal, ambiguous, pinned moves and castling through check',()=>{for(const [fen,move]of [[undefined,'e5'],[undefined,'notSAN'],['4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1','Nd2'],['k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1','Rd2'],['4kr2/8/8/8/8/8/8/4K2R w K - 0 1','O-O']])assert.throws(()=>replayMove(new Chess(fen),move));});
