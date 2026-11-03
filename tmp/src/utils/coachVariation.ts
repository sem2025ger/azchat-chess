import {Chess} from 'chess.js';

// A Coach preview is visual-only. Validate the complete line from the unchanged
// search FEN before showing any ply, including castling, checks and promotions.
export function coachVariationFen(baseFen:string,moves:readonly string[],ply:number):string|null{
 if(!Array.isArray(moves)||moves.length<1||moves.length>10||!Number.isInteger(ply)||ply<0||ply>moves.length)return null;
 try{
  const board=new Chess(baseFen);
  const positions=[board.fen()];
  for(const san of moves){
   if(typeof san!=='string'||san.length>16)return null;
   board.move(san,{strict:true});
   positions.push(board.fen());
  }
  return positions[ply]??null;
 }catch{return null;}
}
