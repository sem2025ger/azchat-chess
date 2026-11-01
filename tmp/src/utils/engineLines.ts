import {Chess} from 'chess.js';

// Server-verified Stockfish lines (`engineLines` in the AI Coach chat response).
// The server already validated them; the client re-checks shape and legality from the
// exact FEN before rendering, and never trusts a malformed or foreign-position line.
export type EngineScore={kind:'cp'|'mate';white:number};
export type ServerEngineLine={moves:string[];score:EngineScore};

const MAX_LINES=3,MAX_PLIES=10,MAX_CP=100000;

export function serverEngineLines(value:unknown,fen:string):ServerEngineLine[]|null{
 if(!Array.isArray(value)||value.length<1||value.length>MAX_LINES)return null;
 const lines:ServerEngineLine[]=[];
 for(const line of value){
  if(!line||typeof line!=='object')return null;
  const {moves,scoreKind,scoreWhite}=line as {moves?:unknown;scoreKind?:unknown;scoreWhite?:unknown};
  if(!Array.isArray(moves)||moves.length<1||moves.length>MAX_PLIES)return null;
  if(scoreKind!=='cp'&&scoreKind!=='mate')return null;
  if(typeof scoreWhite!=='number'||!Number.isInteger(scoreWhite)||Math.abs(scoreWhite)>MAX_CP)return null;
  if(scoreKind==='mate'&&scoreWhite===0)return null;
  try{
   const board=new Chess(fen),san:string[]=[];
   for(const move of moves){if(typeof move!=='string'||move.length>16)return null;san.push(board.move(move,{strict:true}).san);}
   lines.push({moves:san,score:{kind:scoreKind,white:scoreWhite}});
  }catch{return null;}
 }
 return lines;
}

// Evaluation from White's point of view, in the usual chess notation:
// +0.43 / −0.43 / 0.00 for centipawns, #3 / #−3 for mate (negative: Black mates).
export function formatEngineScore(score:EngineScore):string{
 const minus='−';
 if(score.kind==='mate')return '#'+(score.white<0?minus:'')+Math.abs(score.white);
 const pawns=Math.abs(score.white)/100;
 if(score.white===0)return '0.00';
 return (score.white>0?'+':minus)+pawns.toFixed(2);
}
