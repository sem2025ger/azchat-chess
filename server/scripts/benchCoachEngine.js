'use strict';
// Manual benchmark for the server-side AI Coach engine (not part of npm test).
// Usage: node scripts/benchCoachEngine.js [movetimeMs]
// Reports cold start, p50/p95 over 20 positions, reached depth, and memory:
// parent (Express process) RSS delta and the engine child process peak RSS (VmHWM).
const {readFileSync}=require('node:fs');
const {createCoachEngine}=require('../coachEngine');

const POSITIONS=[
 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5',
 'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 4 5',
 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/2PP4/2N1PN2/PP1BBPPP/R2QK2R w KQ - 2 8',
 'r2q1rk1/1b1nbppp/p2ppn2/1p6/3NPP2/1BN1B3/PPPQ2PP/2KR3R w - - 2 12',
 'r1bqr1k1/pp1nbppp/2p2n2/3p4/3P4/2NBPN2/PPQ2PPP/R3K2R w KQ - 4 10',
 '2rq1rk1/pb2bppp/1p2pn2/n2p4/2PP4/P1NBPN2/1B3PPP/R2Q1RK1 w - - 1 13',
 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
 '2r2rk1/pp3ppp/2n1pn2/q2p4/3P4/P1PBPN2/5PPP/R2Q1RK1 w - - 1 15',
 'r3k2r/pp1n1ppp/2p1pn2/q7/2PP4/2N2N2/PP3PPP/R2QKB1R w KQkq - 2 11',
 '8/5pk1/6p1/3P3p/2p4P/2P3P1/5PK1/8 w - - 0 40',
 '8/8/4k3/8/2KP4/8/8/8 w - - 0 50',
 '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
 '8/8/8/3k4/8/3K4/3P4/8 w - - 0 60',
 '4r1k1/pp3ppp/2p5/8/2P5/1P3qP1/P4P1P/R2Q2K1 w - - 0 25',
 'r1b2rk1/2q1bppp/p2p1n2/np2p3/3PP3/5N1P/PPBN1PP1/R1BQR1K1 w - - 2 13',
 'rn1qkb1r/pp3ppp/2p1pn2/5b2/PpBP4/2N1PN2/1P3PPP/R1BQK2R w KQkq - 0 8'
];
const rss=()=>process.memoryUsage().rss;
const mb=(bytes)=>Math.round(bytes/1048576);
function childPeakKb(pid){try{return Number(readFileSync('/proc/'+pid+'/status','utf8').match(/VmHWM:\s+(\d+)/)[1]);}catch{return null;}}
const pct=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)];

(async()=>{
 const movetimeMs=Number(process.argv[2]||900);
 global.gc?.();const before=rss();
 const engine=createCoachEngine({movetimeMs});
 let t=Date.now();const first=await engine.analyze(POSITIONS[0]);const cold=Date.now()-t;
 const pid=engine.status().pid,times=[],depths=[];
 for(const fen of POSITIONS.slice(1).concat(POSITIONS[0].replace(/ 1$/,' 2'))){
  t=Date.now();const r=await engine.analyze(fen);times.push(Date.now()-t);depths.push(...r.lines.map(l=>l.depth));
 }
 depths.push(...first.lines.map(l=>l.depth));
 global.gc?.();const after=rss(),peakKb=childPeakKb(pid);
 times.sort((a,b)=>a-b);depths.sort((a,b)=>a-b);
 console.log(JSON.stringify({engine:first.engine,nnue:first.nnue,movetimeMs,positions:POSITIONS.length,coldStartMs:cold,
  p50Ms:pct(times,0.5),p95Ms:pct(times,0.95),depthMin:depths[0],depthMedian:depths[Math.floor(depths.length/2)],
  parentRssBeforeMb:mb(before),parentRssAfterMb:mb(after),parentDeltaMb:mb(after-before),engineChildPeakRssMb:peakKb===null?null:Math.round(peakKb/1024)}));
 engine.close();
})().catch((e)=>{console.error(e.code||e.message);process.exit(1);});
