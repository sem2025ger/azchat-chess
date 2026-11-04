'use strict';
// Deterministic fixture acceptance: never synthesize a board to force a theme.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {positionFacts}=require('./coachPositionFacts');
const positions=require('./scripts/positionFactsReview.positions.json');

const pawnAt=(board,square,color)=>{const p=board.get(square);return p?.type==='p'&&p.color===color;};
const pieceAt=(board,square,type,color)=>{const p=board.get(square);return p?.type===type&&p.color===color;};
const allPieces=side=>side.hanging.undefended;

const criteria={
 'iqp':(f,b)=>f.white.pawns.isolated.includes('d4')&&f.white.pawns.blockaded.includes('d4')&&
   !f.white.pawns.passed.includes('d4')&&pieceAt(b,'d5','n','b'),
 'passed-blockade':(f,b)=>f.white.pawns.passed.includes('e5')&&
   f.white.pawns.blockaded.includes('e5')&&f.white.pawns.passedBlockaded.includes('e5')&&
   pieceAt(b,'e6','q','b'),
 'nonpassed-blockade':(f,b)=>!f.black.pawns.passed.includes('e6')&&
   f.black.pawns.blockaded.includes('e6')&&!f.black.pawns.passedBlockaded.includes('e6')&&
   pieceAt(b,'e5','n','w'),
 'outpost':(f,b)=>f.white.outposts.some(x=>x.square==='d4'&&x.piece==='n')&&
   pieceAt(b,'e3','p','w')&&pieceAt(b,'d4','n','w'),
 'king-file':(f,b)=>f.black.king.castled&&f.black.king.square==='g8'&&
   f.black.king.openFilesNearKing.includes('f')&&f.black.files.halfOpen.includes('f')&&
   !f.black.pawns.isolated.includes('f7'),
 'doubled':(f,b)=>f.black.pawns.doubledFiles.includes('a')&&
   pawnAt(b,'a6','b')&&pawnAt(b,'a4','b'),
 'bishop-pair':(f,b)=>f.material.white.bishopPair&&
   f.white.files.open.includes('c')&&f.white.files.open.includes('e')&&
   f.material.white.b===2,
 'hanging':(f,b)=>allPieces(f.white).some(x=>x.square==='c2'&&x.piece==='q'&&
   x.attackers.includes('b4'))&&pieceAt(b,'b4','n','b')&&pieceAt(b,'c2','q','w'),
 'minority':(f,b)=>pawnAt(b,'a2','w')&&pawnAt(b,'b4','w')&&
   pawnAt(b,'a7','b')&&pawnAt(b,'b7','b')&&pawnAt(b,'c6','b')&&
   f.white.pawns.pawnIslands>=1&&f.black.pawns.pawnIslands>=1,
 'rook-ending':(f,b)=>f.material.white.r>=1&&f.material.black.r>=1&&
   f.material.white.q===0&&f.material.black.q===0&&
   f.material.white.n+f.material.white.b+f.material.black.n+f.material.black.b===0&&
   f.black.pawns.passed.includes('c3')&&pawnAt(b,'c3','b')
};

test('position facts review: exactly ten documented themes and replayable games',()=>{
 assert.equal(positions.length,10);
 assert.deepEqual(positions.map(x=>x.id),Object.keys(criteria));
 for(const p of positions)assert.ok(/^https:\/\/github\.com\/|^https:\/\/www\.chessbox\.in\//.test(p.sourceUrl));
});
for(const p of positions)test('master game FEN and position facts: '+p.id,()=>{
 assert.ok(Number.isInteger(p.year)&&p.year>=1850&&p.year<=2026);
 assert.ok(p.white&&p.black&&p.event&&p.move&&p.sourceUrl);
 const board=new Chess();
 const tokens=p.replaySan.split(' ');
 assert.equal(tokens.length,p.afterPly,'replay ply count: '+p.id);
 for(const [i,san] of tokens.entries())assert.doesNotThrow(()=>board.move(san),
   p.id+' invalid move '+String(i+1)+' '+san);
 assert.equal(board.fen(),p.fen,'the source-game moves MUST generate the exact FEN');
 const facts=positionFacts(p.fen);
 assert.ok(facts,'invalid FEN: '+p.id);
 assert.ok(criteria[p.id](facts,board),'claimed chess theme not proven by positionFacts: '+p.id);
 assert.ok(Buffer.byteLength(JSON.stringify(facts),'utf8')<=4096);
 assert.equal(facts.white.pawns.passedBlockaded.every(s=>facts.white.pawns.blockaded.includes(s)),true);
 assert.equal(facts.black.pawns.passedBlockaded.every(s=>facts.black.pawns.blockaded.includes(s)),true);
});

test('offline dry run generates complete ten-position Markdown without network or key',()=>{
 const {spawnSync}=require('node:child_process');
 const fs=require('node:fs');
 const path=require('node:path');
 const output=path.join(__dirname,'position-facts-review.md');
 try{
  const child=spawnSync(process.execPath,['scripts/positionFactsReview.js'],{
   cwd:__dirname,encoding:'utf8',timeout:30000,maxBuffer:512*1024,
   env:{...process.env,OPENAI_API_KEY:'',POSITION_FACTS_REVIEW_DRY_RUN:'1'}
  });
  assert.equal(child.status,0,'offline dry run exit; stderr: '+child.stderr);
  const report=fs.readFileSync(output,'utf8');
  assert.match(report,/DRY RUN: synthetic provider and fake engine/);
  assert.match(report,/## Summary/);
  assert.equal((report.match(/^## \d+\. /gm)||[]).length,10,'all ten positions must be present');
  assert.equal((report.match(/^#### OFF/gm)||[]).length,10);
  assert.equal((report.match(/^#### ON/gm)||[]).length,10);
  assert.equal((report.match(/^\*\*Verified positionFacts JSON:/gm)||[]).length,10);
  assert.equal((report.match(/^\*\*Submitted engine evidence:/gm)||[]).length,20);
  const slices=report.split(/^#### (OFF|ON)\s*$/m);
  for(let i=1;i<slices.length;i+=2){
   if(slices[i]==='ON')assert.match(slices[i+1],/"endFacts"\s*:/,'ON evidence must show endFacts');
   else assert.doesNotMatch(slices[i+1],/"endFacts"\s*:/,'OFF evidence must omit endFacts');
  }
  assert.match(report,/\| iqp \|[^\n]*\| YES \| NO \|/,'dry run same engine core should compare YES');
  assert.ok(report.includes('&#96;')===false,'use real Markdown code fences');
  assert.ok(report.includes(String.fromCharCode(96).repeat(3)+'json'),'Markdown JSON fence expected');
  assert.ok(!report.includes('sk-'),'no API key prefix in report');
  console.log('QA dry-run report excerpt (first section):\n'+
   report.split('\n').slice(0,21).join('\n'));
 }finally{fs.rmSync(output,{force:true});}
});

test('review comparison ignores ON-only endFacts but detects move and score changes',()=>{
 const {comparableEngineEvidence}=require('./scripts/positionFactsReview');
 const base={id:'L1',moves:['O-O','Bxc3','bxc3','O-O','Re1'],scoreKind:'cp',scoreWhite:32,depth:14,wdlWhite:[350,420,230]};
 const off={origin:'server_stockfish_19',engineLines:[base]};
 const on={origin:'server_stockfish_19',engineLines:[{...base,endFacts:{fen:'test-only',plies:5,white:{pawns:{doubledFiles:[]}}}}]};
 assert.equal(comparableEngineEvidence(off,on),true,'endFacts must not make engine lines non-comparable');
 assert.equal(comparableEngineEvidence(off,{...on,engineLines:[{...on.engineLines[0],moves:['O-O','Be6']}]}),false,'different moves');
 assert.equal(comparableEngineEvidence(off,{...on,engineLines:[{...on.engineLines[0],scoreWhite:base.scoreWhite+1}]}),false,'different engine score');
 assert.equal(comparableEngineEvidence(off,{...on,origin:'untrusted_client_legality_checked'}),false,'origin must be server Stockfish');
});
