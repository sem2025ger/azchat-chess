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


/**
 * Mechanisms visible in an exact, legal SAN sequence. These are board events,
 * not Stockfish's explanation of a move or proof that a plan is best.
 * No speculative follow-up move is generated here.
 */
function lineMechanisms(fen,moves){
 const board=new Chess(fen),freed=new Map(),lastMoveByPieceSquare=new Map();
 const facts={pawnControls:[],freedSquaresUsed:[],blockedPawnSteps:[],pieceRoutes:[]};
 const files='abcdefgh';
 for(let i=0;i<moves.length;i++){
  const number=board.moveNumber();
  const move=board.move(moves[i],{strict:true});
  const side=SIDE[move.color],label=number+(move.color==='w'?'. ':'... ')+move.san;
  const freedBy=freed.get(move.color+':'+move.to);
  // A pawn's advance actually vacated the square later used by this piece.
  if(freedBy?.piece==='pawn'&&move.piece!=='p')facts.freedSquaresUsed.push({
   square:move.to,side,freedBy:freedBy.move,usedBy:label,piece:NAME[move.piece]
  });
  if(move.piece==='p'){
   // Geometric pawn control after the push; it is not an engine-approved attack.
   const file=files.indexOf(move.to[0]),rank=Number(move.to[1])+(move.color==='w'?1:-1);
   if(rank>=1&&rank<=8)facts.pawnControls.push({
    ply:i+1,move:label,side,pawn:move.to,
    squares:[file-1,file+1].filter(f=>f>=0&&f<8).map(f=>files[f]+rank)
   });
  }else{
   // A piece occupies the square immediately in front of an unmoved own pawn.
   // This obstructs that pawn's NEXT step only; it does not forbid a future plan.
   const stepRank=move.color==='w'?'3':'6',homeRank=move.color==='w'?'2':'7';
   if(move.to[1]===stepRank){
    const pawnSquare=move.to[0]+homeRank,pawn=board.get(pawnSquare);
    if(pawn?.color===move.color&&pawn.type==='p')facts.blockedPawnSteps.push({
     ply:i+1,move:label,side,piece:NAME[move.piece],pawn:pawnSquare,blockedSquare:move.to
    });
   }
   const previous=lastMoveByPieceSquare.get(move.color+':'+move.from);
   if(previous?.piece===move.piece)facts.pieceRoutes.push({
    side,piece:NAME[move.piece],from:previous.from,via:move.from,to:move.to,
    firstMove:previous.move,nextMove:label
   });
  }
  lastMoveByPieceSquare.delete(move.color+':'+move.from);
  lastMoveByPieceSquare.set(move.color+':'+move.to,{piece:move.piece,from:move.from,move:label});
  freed.set(move.color+':'+move.from,{piece:NAME[move.piece],move:label});
 }
 return Object.fromEntries(Object.entries(facts).filter(([,events])=>events.length));
}

module.exports={lineFacts,lineMechanisms,settlement};
