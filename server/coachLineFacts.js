'use strict';
// Deterministic facts about the MOVES of one server-verified Stockfish line:
// material at the line end compared with the engine score, double attacks made by
// the moved piece, and every check (verified checkmate included) with the material
// change from that check to the line end.
// Static attack rules only (no pins, no search); model evidence, never browser output.
const {Chess}=require('chess.js');

const VALUE={p:1,n:3,b:3,r:5,q:9,k:100};
const NAME={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const SIDE={w:'white',b:'black'};
// A material count this far from the evaluation is not the outcome of the line.
const MATERIAL_EVAL_GAP=1;

function materialWhite(board){
 let total=0;
 for(const row of board.board())for(const sq of row)if(sq&&sq.type!=='k')total+=(sq.color==='w'?1:-1)*VALUE[sq.type];
 return total;
}

// The moved piece attacks two or more enemy pieces, each the king, more valuable
// than the attacker, or undefended.
function doubleAttack(board,move){
 const by=move.color,enemy=by==='w'?'b':'w',piece=board.get(move.to);
 const targets=[];
 for(const row of board.board())for(const sq of row){
  if(!sq||sq.color!==enemy||!board.attackers(sq.square,by).includes(move.to))continue;
  const defended=sq.type!=='k'&&board.attackers(sq.square,enemy).length>0;
  if(sq.type==='k'||VALUE[sq.type]>VALUE[piece.type]||!defended)targets.push({square:sq.square,piece:NAME[sq.type],defended});
 }
 return targets.length>=2?{attacker:{piece:NAME[piece.type],square:move.to},targets}:null;
}

// "Unsettled" is an evidence limit, never an error or a refutation of a sacrifice.
function settlement(fen,moves,{scoreKind,scoreWhite}={}){
 const board=new Chess(fen);let last=null;
 for(const san of moves)last=board.move(san,{strict:true});
 const material=materialWhite(board),evalWhite=scoreKind==='cp'&&Number.isFinite(scoreWhite)?scoreWhite/100:null;
 const gap=evalWhite===null?null:Math.abs(material-evalWhite);
 const captureAvailable=board.moves({verbose:true}).some(move=>{
  if(!move.captured)return false;
  board.move(move.san,{strict:true});const changed=materialWhite(board)!==material;board.undo();return changed;
 });
 return {fen:board.fen(),unsettled:gap!==null&&gap>=MATERIAL_EVAL_GAP&&(!!last?.captured||captureAvailable)};
}

function lineFacts(fen,moves,{scoreKind,scoreWhite}={}){
 const board=new Chess(fen);
 const startWhite=materialWhite(board),doubleAttacks=[],checks=[];
 moves.forEach((san,i)=>{
  const number=board.moveNumber(),before=materialWhite(board);
  const move=board.move(san,{strict:true});
  const label=number+(move.color==='w'?'. ':'... ')+move.san,side=SIDE[move.color];
  const attack=doubleAttack(board,move);
  if(attack)doubleAttacks.push({ply:i+1,move:label,side,...attack});
  if(board.inCheck())checks.push({ply:i+1,move:label,side,legalReplies:board.moves().length,checkmate:board.isCheckmate(),before});
 });
 const endWhite=materialWhite(board);
 const evalWhite=scoreKind==='cp'&&Number.isFinite(scoreWhite)?scoreWhite/100:null;
 return {
  materialVsEval:{startWhite,endWhite,evalWhite,matchesEval:evalWhite===null?null:Math.abs(endWhite-evalWhite)<MATERIAL_EVAL_GAP},
  doubleAttacks,
  // ||0 normalises -0 for Black checks without material change.
  checks:checks.map(({before,...check})=>({...check,materialGainForCheckingSide:((endWhite-before)*(check.side==='white'?1:-1))||0}))
 };
}

module.exports={lineFacts,settlement};
