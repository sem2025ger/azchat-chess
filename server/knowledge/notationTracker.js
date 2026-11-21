'use strict';
// Follows the move references of one book unit (an example or a game) through its prose.
// Every converted move is a legal chess.js move in a concrete position; anything that
// cannot be placed unambiguously is reported as unresolved and left as printed.
const {Chess}=require('chess.js');
const {resolveDescriptive,findMoveTokens,placementOf}=require('./descriptiveNotation');

const START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Text allowed between two moves of one run: punctuation, move numbers and joining words.
const JOIN_RE=/^(?:[\s,;:]|\d{1,3}\s*\.?\s*(?:\.{2,}|…)?|followed\s+by|and|then)*$/i;
// Wording that places an unnumbered move: an alternative to the last move, or a move now.
const ALTERNATIVE_BEFORE=/\b(?:if|instead of|not|rather than|better (?:was|is)|best (?:move )?(?:was|would have been)|would have been|should have played|could have played|in place of)\s*$/i;
const CURRENT_BEFORE=/\b(?:now|threatening|threatens|threat of|if now|with the threat of)\s*$/i;
const ALTERNATIVE_AFTER=/^[\s,]*(?:(?:is|was|were|would have been|would be|might be|might have been)\s+(?:preferable|better|best|stronger|safer|the (?:right|correct|best|proper) (?:move|reply|continuation))|instead\b|offered the only)/i;
const NUMBER_BEFORE_RE=/(?:^|[^\w.])(\d{1,3})\s*(\.?)\s*(\.{2,}|…)?\s*$/;

function rankArray(row){const out=[];for(const ch of row){if(/\d/.test(ch))for(let i=0;i<Number(ch);i++)out.push('.');else out.push(ch);}return out;}
// Castling is offered only where king and rook stand on their original squares;
// a printed diagram cannot show whether they moved before.
function inferCastling(placement){
 const rows=placement.split('/'),w=rankArray(rows[7]),b=rankArray(rows[0]);let s='';
 if(w[4]==='K'){if(w[7]==='R')s+='K';if(w[0]==='R')s+='Q';}
 if(b[4]==='k'){if(b[7]==='r')s+='k';if(b[0]==='r')s+='q';}
 return s||'-';
}
function fenFor(placement,turn,fullmove){return `${placement} ${turn} ${inferCastling(placement)} - 0 ${fullmove}`;}

class Line{
 constructor(startPly,fen){this.startPly=startPly;this.fens=new Map([[startPly,fen]]);this.sans=new Map();this.end=startPly;}
 fenAt(ply){return this.fens.get(ply)??null;}
 branch(ply){
  const l=new Line(this.startPly,this.fens.get(this.startPly));
  for(let p=this.startPly;p<ply;p++){l.sans.set(p,this.sans.get(p));l.fens.set(p+1,this.fens.get(p+1));}
  l.end=ply;return l;
 }
 push(san,fen){this.sans.set(this.end,san);this.end+=1;this.fens.set(this.end,fen);}
}

// "followed by" skips the opponent's unrecorded reply: the move is read with the turn passed.
function passTurn(fen){const f=fen.split(' ');f[1]=f[1]==='w'?'b':'w';f[3]='-';return f.join(' ');}
// Depth-first over the readings of each token: an ambiguous printed move ("B - Kt 5" with
// two bishops able to reach a Kt-file fifth square) is decided by whether the moves that
// follow it are still legal. Ties after the whole sequence stay unresolved.
const SEARCH_BUDGET=4000;
function playRun(fen,tokens){
 let budget=SEARCH_BUDGET,tie=false;
 function dfs(chess,i){
  if(i===tokens.length||budget--<=0)return [];
  const t=tokens[i];
  if(t.nullBefore){
   if(chess.inCheck())return [];
   const passed=new Chess(passTurn(chess.fen()));
   const rest=dfsMove(passed,i);
   return rest.length?[{san:null,fen:passed.fen()},...rest]:[];
  }
  return dfsMove(chess,i);
 }
 function dfsMove(chess,i){
  const r=resolveDescriptive(chess,tokens[i].text);
  const options=r.error?(r.error==='ambiguous'?r.candidates:[]):[r.move];
  let best=null,bestLen=-1,count=0;
  for(const m of options){
   const next=new Chess(chess.fen());next.move(m.san);
   const path=[{san:m.san,fen:next.fen()},...dfs(next,i+1)];
   const len=path.filter(x=>x.san!==null).length;
   if(len>bestLen){best=path;bestLen=len;count=1;}else if(len===bestLen)count++;
  }
  if(!best)return [];
  if(count>1){
   // Several readings survive equally far: keep only the unambiguous prefix.
   if(options.length>1){tie=true;return [];}
  }
  return best;
 }
 const out=dfs(new Chess(fen),0);
 void tie;
 return out;
}
const sameSans=(a,b)=>a.map(x=>x.san).join(' ')===b.map(x=>x.san).join(' ');
const realMoves=played=>played.filter(x=>x.san!==null);

class UnitTracker{
 constructor({fen=START_FEN,startPly=0,gameMode=false}={}){
  // gameMode: the main line comes only from the printed score, never from notes.
  this.gameMode=gameMode;this.main=new Line(startPly,fen);this.lines=[this.main];this.current=this.main;
  this.stats={tokens:0,resolved:0,unresolved:0,mainline:0};
  this.score=null;
 }
 // The printed game score is resolved as one sequence, so an ambiguous move is decided by
 // all later score moves, not only by the rest of its own line of print.
 prepareScore(runs){
  const tokens=[];let ply=this.main.end;
  for(const r of runs){if(!r.mainline)continue;if(r.explicitPly!==null&&r.explicitPly!==ply)break;tokens.push(...r.tokens);ply+=r.tokens.length;}
  this.score=playRun(this.main.fenAt(this.main.end),tokens).filter(x=>x.san!==null).map(x=>x.san);
 }
 static diagramStart(placement,{turn,fullmove}){
  return {fen:fenFor(placement,turn,fullmove),startPly:2*(fullmove-1)+(turn==='b'?1:0)};
 }
 bases(run){
  const p=run.explicitPly,out=[];
  if(run.mainline&&(p===null||p===this.main.end)){out.push({line:this.main,ply:this.main.end});return out;}
  // A score printed again from an earlier move ("Let us go back …") is a new line.
  if(run.mainline&&p!==null&&this.current!==this.main&&this.current.end===p){out.push({line:this.current,ply:p});}
  if(p===null){
   // Unnumbered: the next move on the current line, or an alternative to its last move.
   const c=this.current;
   if(run.hint!=='alternative')out.push({line:c,ply:c.end});
   if(run.hint!=='current'&&c.end-1>=c.startPly)out.push({line:c,ply:c.end-1});
   return out;
  }
  const order=[];
  if(this.current!==this.main&&this.current.end===p)order.push(this.current);
  order.push(this.main);
  if(this.current!==this.main)order.push(this.current);
  for(const l of [...this.lines].reverse())if(!order.includes(l))order.push(l);
  for(const line of order)if(line.fenAt(p))out.push({line,ply:p});
  return out;
 }
 processRun(run){
  const n=run.tokens.length;
  if(run.mainline&&this.score&&(run.explicitPly===null||run.explicitPly===this.main.end)){
   this.stats.tokens+=n;
   const offset=this.main.end-this.main.startPly,sans=this.score.slice(offset,offset+n),out=[];
   const chess=new Chess(this.main.fenAt(this.main.end));
   for(let i=0;i<sans.length;i++){chess.move(sans[i]);this.main.push(sans[i],chess.fen());out.push({...run.tokens[i],san:sans[i]});}
   this.current=this.main;this.stats.mainline+=out.length;this.stats.resolved+=out.length;this.stats.unresolved+=n-out.length;
   return out;
  }
  this.stats.tokens+=n;
  const bases=this.bases(run).map(b=>{const played=playRun(b.line.fenAt(b.ply),run.tokens);return {...b,played,moves:realMoves(played).length};});
  let best=null;
  if(run.explicitPly===null&&!run.mainline){
   const full=bases.filter(b=>b.moves===n);
   // Both readings legal but different: the printed reference is genuinely ambiguous.
   if(full.length===2&&!sameSans(full[0].played,full[1].played))best=null;
   else best=full[0]||null;
  }else{
   for(const b of bases){if(!best||b.moves>best.moves)best=b;if(b.moves===n)break;}
  }
  if(!best||!best.moves){this.stats.unresolved+=n;return [];}
  const onMain=best.line===this.main;
  const extend=best.ply===best.line.end&&(onMain?(run.mainline&&best.ply===this.main.end&&(run.explicitPly===null||run.explicitPly===this.main.end)):run.explicitPly!==null||run.mainline)&&!(onMain&&!run.mainline&&this.gameMode);
  let line=best.line;
  if(!extend){line=best.line.branch(best.ply);this.lines.push(line);}
  for(const step of best.played)line.push(step.san??'--',step.fen);
  this.current=line;
  const moves=realMoves(best.played);
  if(run.mainline&&line===this.main)this.stats.mainline+=moves.length;
  this.stats.resolved+=moves.length;this.stats.unresolved+=n-moves.length;
  // An unnumbered move is read in the nearest known position; its check/mate mark could
  // belong to a different position, so the printed wording ("mates") is left to speak.
  const plain=run.explicitPly===null&&!run.mainline;
  return run.tokens.slice(0,moves.length).map((t,i)=>({...t,san:plain?moves[i].san.replace(/[+#]$/,''):moves[i].san}));
 }
 // A printed diagram inside a unit is checked against the current main-line position.
 checkpoint(placement){
  const fen=this.main.fenAt(this.main.end);
  return {matchesMainline:!!fen&&placementOf(fen)===placement,mainlineFen:fen};
 }
 mainlineSans(){const out=[];for(let p=this.main.startPly;p<this.main.end;p++)out.push(this.main.sans.get(p));return out;}
}

// Split a passage into runs of consecutive moves. Score lines ("  7. B - Q 3   Kt × Kt")
// are the game record and always extend the main line.
function extractRuns(text,{tabularMainline=false}={}){
 const runs=[];let prevEnd=0,run=null;
 for(const t of findMoveTokens(text)){
  const gap=text.slice(prevEnd,t.index);
  const lineStart=text.lastIndexOf('\n',t.index)+1;
  const tabular=tabularMainline&&/^\s{4,}\d{1,3}\.?\s/.test(text.slice(lineStart,t.index+1));
  const num=gap.match(NUMBER_BEFORE_RE);
  const ply=num&&Number(num[1])>=1&&Number(num[1])<=200?2*(Number(num[1])-1)+(num[3]?1:0):null;
  const nullBefore=/followed\s+by/i.test(gap);
  const step=nullBefore?2:1;
  const continues=run&&run.mainline===tabular&&JOIN_RE.test(gap)&&(ply===null?true:run.lastPly!==null&&ply===run.lastPly+step);
  if(continues){
   const p=run.lastPly===null?null:run.lastPly+step;
   run.tokens.push({...t,ply:p,nullBefore});run.lastPly=p;
  }else{
   run={tokens:[{...t,ply}],explicitPly:ply,lastPly:ply,mainline:tabular,hint:null};
   if(ply===null){
    const before=text.slice(Math.max(0,t.index-60),t.index);
    if(ALTERNATIVE_BEFORE.test(before))run.hint='alternative';
    else if(CURRENT_BEFORE.test(before))run.hint='current';
   }
   runs.push(run);
  }
  prevEnd=t.index+t.text.length;
  if(run.explicitPly===null&&run.hint===null&&ALTERNATIVE_AFTER.test(text.slice(prevEnd,prevEnd+60)))run.hint='alternative';
 }
 return runs;
}

module.exports={UnitTracker,extractRuns,START_FEN,inferCastling,fenFor};
