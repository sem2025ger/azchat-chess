'use strict';
const {Chess,validateFen}=require('chess.js');

const FILES='abcdefgh',VALUES={p:1,n:3,b:3,r:5,q:9,k:Infinity};
const ordered=(a,b)=>a.square.localeCompare(b.square);
const opposite=color=>color==='w'?'b':'w';
const sideName=color=>color==='w'?'white':'black';
const square=(f,r)=>FILES[f]+r;

// Static geometric attacks. Pins, x-rays through pieces, and move legality are intentionally excluded.
function attacks(piece,target,grid){
 const df=target.f-piece.f,dr=target.r-piece.r,af=Math.abs(df),ar=Math.abs(dr);
 if(piece.type==='p')return ar===1&&af===1&&dr===(piece.color==='w'?1:-1);
 if(piece.type==='n')return af===1&&ar===2||af===2&&ar===1;
 if(piece.type==='k')return Math.max(af,ar)===1;
 const diagonal=af===ar&&af!==0,straight=(df===0)!==(dr===0);
 if(!((piece.type==='b'&&diagonal)||(piece.type==='r'&&straight)||(piece.type==='q'&&(diagonal||straight))))return false;
 const sf=Math.sign(df),sr=Math.sign(dr);
 for(let f=piece.f+sf,r=piece.r+sr;f!==target.f||r!==target.r;f+=sf,r+=sr)
  if(grid.get(square(f,r)))return false;
 return true;
}

function positionFacts(fen){
 try{
  if(typeof fen!=='string'||fen.length>200||!validateFen(fen).ok)return null;
  const board=new Chess(fen),grid=new Map(),pieces={w:[],b:[]};
  for(const row of board.board())for(const cell of row)if(cell){
   const obj={square:cell.square,type:cell.type,color:cell.color,f:FILES.indexOf(cell.square[0]),r:Number(cell.square[1])};
   grid.set(obj.square,obj);pieces[obj.color].push(obj);
  }
  for(const color of ['w','b'])pieces[color].sort(ordered);
  const pawns={w:pieces.w.filter(x=>x.type==='p'),b:pieces.b.filter(x=>x.type==='p')};
  const occupiedFiles={w:new Set(pawns.w.map(x=>x.f)),b:new Set(pawns.b.map(x=>x.f))};
  const counts=color=>{
   const count={p:0,n:0,b:0,r:0,q:0};
   for(const piece of pieces[color])if(piece.type!=='k')count[piece.type]++;
   return {...count,bishopPair:count.b>=2};
  };
  const whiteMaterial=counts('w'),blackMaterial=counts('b');
  const balanceWhite=['p','n','b','r','q'].reduce((sum,t)=>sum+(whiteMaterial[t]-blackMaterial[t])*VALUES[t],0);
  const openFiles=[...FILES].filter((_,f)=>!occupiedFiles.w.has(f)&&!occupiedFiles.b.has(f));
  const result={material:{white:whiteMaterial,black:blackMaterial,balanceWhite},white:null,black:null};
  for(const color of ['w','b']){
   const enemy=opposite(color),ownPawns=pawns[color],enemyPawns=pawns[enemy],files=occupiedFiles[color];
   const side=sideName(color),opp=sideName(enemy),direction=color==='w'?1:-1;
   const isolated=ownPawns.filter(p=>![p.f-1,p.f+1].some(f=>files.has(f))).map(p=>p.square);
   const doubledFiles=[...FILES].filter((_,f)=>ownPawns.filter(p=>p.f===f).length>=2);
   const passed=ownPawns.filter(p=>!enemyPawns.some(e=>Math.abs(e.f-p.f)<=1&&(e.r-p.r)*direction>0)).map(p=>p.square);
   const blockaded=ownPawns.filter(p=>{const stop=grid.get(square(p.f,p.r+direction));return stop&&stop.color===enemy&&stop.type!=='p';}).map(p=>p.square);
   const passedBlockaded=passed.filter(s=>blockaded.includes(s));
   let islands=0,last=-2;
   for(const f of [...files].sort((a,b)=>a-b)){if(f!==last+1)islands++;last=f;}
   const halfOpen=[...FILES].filter((_,f)=>!files.has(f)&&occupiedFiles[enemy].has(f));
   const outposts=pieces[color].filter(p=>{
    if(!['n','b'].includes(p.type)||(color==='w'?(p.r<4||p.r>6):(p.r<3||p.r>5)))return false;
    if(!ownPawns.some(s=>Math.abs(s.f-p.f)===1&&s.r===p.r-direction))return false;
    return !enemyPawns.some(e=>Math.abs(e.f-p.f)===1&&(e.r-p.r)*direction>0);
   }).map(p=>({piece:p.type,square:p.square}));
   const undefended=[],lowerValueAttacked=[];
   for(const p of pieces[color])if(p.type!=='k'){
    const attackers=pieces[enemy].filter(x=>attacks(x,p,grid)).map(x=>x.square);
    if(!attackers.length)continue;
    const defenders=pieces[color].some(x=>x.square!==p.square&&attacks(x,p,grid));
    if(!defenders)undefended.push({piece:p.type,square:p.square,attackers});
    const cheaper=pieces[enemy].filter(x=>VALUES[x.type]<VALUES[p.type]&&attacks(x,p,grid)).map(x=>x.square);
    if(cheaper.length)lowerValueAttacked.push({piece:p.type,square:p.square,attackers:cheaper});
   }
   const king=pieces[color].find(x=>x.type==='k');
   const nearby=[king.f-1,king.f,king.f+1].filter(f=>f>=0&&f<8);
   const pawnShield=ownPawns.filter(p=>nearby.includes(p.f)&&(p.r-king.r)*direction>=1&&(p.r-king.r)*direction<=2).length;
   const openFilesNearKing=nearby.filter(f=>openFiles.includes(FILES[f])||(!files.has(f)&&occupiedFiles[enemy].has(f))).map(f=>FILES[f]);
   // V2 deterministic geometric descriptors. No engine, game history or move search.
   const bishops=pieces[color].filter(p=>p.type==='b').map(b=>{
    const squareColor=(b.f+b.r)%2===0?'light':'dark';
    const same=ownPawns.filter(p=>((p.f+p.r)%2===0)===(squareColor==='light'));
    const fixed=same.filter(p=>{const stop=grid.get(square(p.f,p.r+direction));return stop?.color===enemy&&stop.type==='p';});
    return {square:b.square,squareColor,sameColorPawns:same.map(p=>p.square),
     fixedSameColorPawns:fixed.map(p=>p.square),bad:same.length>=3&&fixed.length>=2};
   });
   const holes=[];
   for(let f=0;f<8;f++)for(const r of (color==='w'?[3,4]:[5,6])){
    const target=square(f,r),occupant=grid.get(target);
    if(occupant?.color===color&&occupant.type==='p')continue;
    // A pawn can attack this target only from the preceding rank on an adjacent file.
    // Pawns already level with the target cannot turn back to attack it.
    if(ownPawns.some(p=>Math.abs(p.f-f)===1&&(r-p.r)*direction>=1))continue;
    holes.push(target);
   }
   const holesOccupiedByEnemyPiece=holes.filter(s=>{
    const p=grid.get(s);return p?.color===enemy&&['n','b'].includes(p.type);
   });
   const minorityAttack=ownPawns.filter(p=>p.f<=2).length===2&&enemyPawns.filter(p=>p.f<=2).length===3&&
    ownPawns.some(p=>p.f===3&&enemyPawns.some(e=>e.f===3&&e.r===p.r+direction));
   result[side]={
    pawns:{isolated,doubledFiles,passed,blockaded,passedBlockaded,pawnIslands:islands},
    files:{open:openFiles,halfOpen},
    outposts,
    hanging:{static:true,undefended,lowerValueAttacked},
    king:{square:king.square,castled:(color==='w'?['g1','c1','b1']:['g8','c8','b8']).includes(king.square),pawnShield,openFilesNearKing},
    strategy:{bishops,holes,holesOccupiedByEnemyPiece,minorityAttack}
   };
  }
  const wing=(from,to)=>{
   const white=pawns.w.filter(p=>p.f>=from&&p.f<=to).length;
   const black=pawns.b.filter(p=>p.f>=from&&p.f<=to).length;
   return {white,black,majority:white===black?null:white>black?'white':'black'};
  };
  result.majorities={queenside:wing(0,2),centre:wing(3,4),kingside:wing(5,7)};
  return Buffer.byteLength(JSON.stringify(result),'utf8')<=6144?result:null;
 }catch{return null;}
}
module.exports={positionFacts};
