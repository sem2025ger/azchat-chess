'use strict';
// English descriptive notation (e.g. "Kt - K B 3", "P × P", "Castles") → SAN, resolved
// only against the legal moves of a concrete chess.js position. A move is converted
// only when exactly one legal move fits the description; otherwise it stays unresolved.
const {Chess}=require('chess.js');

const FILE_LETTERS='abcdefgh';
// Descriptive file names, from White's side: QR QKt QB Q K KB KKt KR.
const FILE_NAMES=['QR','QKt','QB','Q','K','KB','KKt','KR'];
const PIECE_LETTER={K:'k',Q:'q',R:'r',B:'b',Kt:'n',N:'n',P:'p'};
const WING_FILES={Q:'abcd',K:'efgh'};

// One descriptive move token. Spaces are optional between designator parts.
const P='(?:Kt|K|Q|R|B|N|P)';
const SIDE='(?:(?:K|Q)\\s?)';
const PAWN_FILE='(?:(?:K|Q)\\s?(?:Kt|R|B)\\s?|(?:K|Q|Kt|R|B)\\s?)';
const PIECE=`(?:${PAWN_FILE}P|${SIDE}?(?:Kt|R|B)|K|Q|P)`;
const SQUARE=`(?:${SIDE}?(?:Kt|R|B)\\s?[1-8]|(?:K|Q)\\s?[1-8])`;
const SUFFIX='(?:\\s*(?:\\((?:Q|R|B|Kt)\\)|=\\s?(?:Q|R|B|Kt)|dis\\.?\\s?ch|dbl\\.?\\s?ch|ch\\b|mate\\b|e\\.\\s?p\\.?|[!?]{1,2}))*';
const MOVE_SOURCE=`(?:Castles(?:\\s?\\((?:K|Q)\\s?R\\))?(?:\\s?(?:K|Q)\\s?R\\b)?|O\\s?-\\s?O(?:\\s?-\\s?O)?|${PIECE}(?:\\s?\\(${SQUARE}\\))?\\s?-\\s?${SQUARE}|${PIECE}(?:\\s?\\(${SQUARE}\\))?\\s?[×xX]\\s?${PIECE}(?:\\s?\\(${SQUARE}\\))?)${SUFFIX}`;
const MOVE_RE=new RegExp(`(?<![A-Za-z])${MOVE_SOURCE}(?![A-Za-z0-9])`,'g');

const squeeze=s=>s.replace(/\s+/g,'');

function parsePiece(text){
 const t=squeeze(text);
 if(t==='K'||t==='Q')return {type:PIECE_LETTER[t]};
 if(t.endsWith('P')){
  const q=t.slice(0,-1);
  if(!q)return {type:'p'};
  return {type:'p',fileQualifier:q};
 }
 const m=t.match(/^(K|Q)?(Kt|R|B|N)$/);
 if(m)return {type:PIECE_LETTER[m[2]],wing:m[1]||null};
 return null;
}
function parseSquare(text){
 const t=squeeze(text),m=t.match(/^(K|Q)?(Kt|R|B)?([1-8])$/);
 if(!m)return null;
 const [,side,piece,rank]=m;
 let files;
 if(piece)files=side?[FILE_NAMES.indexOf(side+piece)]:[FILE_NAMES.indexOf('Q'+piece),FILE_NAMES.indexOf('K'+piece)];
 else files=[FILE_NAMES.indexOf(side)];
 return {files,rank:Number(rank)};
}
// Files a pawn qualifier allows: "QB" → c, "B" → c or f, "K" → e, "Kt" → b or g.
function qualifierFiles(q){
 if(FILE_NAMES.includes(q))return [FILE_NAMES.indexOf(q)];
 if(['Kt','R','B'].includes(q))return [FILE_NAMES.indexOf('Q'+q),FILE_NAMES.indexOf('K'+q)];
 return null;
}
function relativeRank(square,color){const r=Number(square[1]);return color==='w'?r:9-r;}
function fileIndex(square){return FILE_LETTERS.indexOf(square[0]);}
function squareMatches(square,spec,color){return spec.files.includes(fileIndex(square))&&relativeRank(square,color)===spec.rank;}

function parseToken(raw){
 let text=raw.trim();
 const promo=text.match(/\((Q|R|B|Kt)\)|=\s?(Q|R|B|Kt)/);
 const suffix={check:/\bch\b/.test(text),mate:/\bmate\b/.test(text),enPassant:/e\.\s?p/.test(text),promotion:promo?PIECE_LETTER[promo[1]||promo[2]]:null};
 text=text.replace(new RegExp(SUFFIX+'$'),'').trim();
 if(/^Castles/.test(text)){
  const queen=/Q\s?R/.test(text);
  return {kind:'castle',side:queen?'q':'k',explicit:/R/.test(text),suffix};
 }
 if(/^O\s?-\s?O/.test(text))return {kind:'castle',side:/O\s?-\s?O\s?-\s?O/.test(text)?'q':'k',explicit:true,suffix};
 const cap=text.match(new RegExp(`^(${PIECE})(?:\\s?\\((${SQUARE})\\))?\\s?[×xX]\\s?(${PIECE})(?:\\s?\\((${SQUARE})\\))?$`));
 if(cap){
  const mover=parsePiece(cap[1]),target=parsePiece(cap[3]);
  if(!mover||!target)return null;
  return {kind:'capture',mover,from:cap[2]?parseSquare(cap[2]):null,target,to:cap[4]?parseSquare(cap[4]):null,suffix};
 }
 const mv=text.match(new RegExp(`^(${PIECE})(?:\\s?\\((${SQUARE})\\))?\\s?-\\s?(${SQUARE})$`));
 if(mv){
  const mover=parsePiece(mv[1]),to=parseSquare(mv[3]);
  if(!mover||!to)return null;
  return {kind:'move',mover,from:mv[2]?parseSquare(mv[2]):null,to,suffix};
 }
 return null;
}

function moverFits(move,mover,from,color){
 if(move.piece!==mover.type)return false;
 if(mover.type==='p'&&mover.fileQualifier){
  const files=qualifierFiles(mover.fileQualifier);
  if(!files||!files.includes(fileIndex(move.from)))return false;
 }
 if(from&&!squareMatches(move.from,from,color))return false;
 return true;
}
// "K Kt" / "Q R" only names the wing a piece belongs to; used to break ties, never alone.
function wingFits(move,mover){return !mover.wing||WING_FILES[mover.wing].includes(move.from[0]);}
// The original file of a named piece ("Q R" → a, "K Kt" → g); the nearest piece is taken
// to be the named one when two of the same kind fit the move.
function originalFile(mover){return mover.wing?FILE_NAMES.indexOf(mover.wing+({r:'R',n:'Kt',b:'B'})[mover.type]):-1;}

function candidates(chess,parsed){
 const color=chess.turn(),legal=chess.moves({verbose:true});
 if(parsed.kind==='castle')return legal.filter(m=>m.flags.includes(parsed.side));
 let list;
 if(parsed.kind==='move'){
  list=legal.filter(m=>!m.captured&&moverFits(m,parsed.mover,parsed.from,color)&&squareMatches(m.to,parsed.to,color));
 }else{
  list=legal.filter(m=>{
   if(!m.captured||!moverFits(m,parsed.mover,parsed.from,color))return false;
   if(m.captured!==parsed.target.type)return false;
   if(parsed.target.type==='p'&&parsed.target.fileQualifier){
    const files=qualifierFiles(parsed.target.fileQualifier);
    if(!files||!files.includes(fileIndex(m.to)))return false;
   }
   if(parsed.to&&!squareMatches(m.to,parsed.to,color))return false;
   return true;
  });
 }
 if(list.length>1){
  const byWing=list.filter(m=>wingFits(m,parsed.mover)&&(parsed.kind!=='capture'||wingFits({from:m.to},parsed.target)));
  if(byWing.length>=1)list=byWing;
  const home=originalFile(parsed.mover);
  if(list.length>1&&home>=0){
   const d=m=>Math.abs(fileIndex(m.from)-home),min=Math.min(...list.map(d));
   if(list.filter(m=>d(m)===min).length===1)list=list.filter(m=>d(m)===min);
  }
 }
 // A printed "ch" picks the checking move; without it, a quiet move is preferred.
 if(list.length>1){
  const checking=list.filter(m=>/[+#]/.test(m.san)),quiet=list.filter(m=>!/[+#]/.test(m.san));
  if(parsed.suffix.check||parsed.suffix.mate){if(checking.length)list=checking;}
  else if(quiet.length)list=quiet;
 }
 // Promotion: an explicit piece wins; otherwise a bare pawn move to the last rank is a queen.
 if(list.some(m=>m.promotion)){
  const want=parsed.suffix.promotion||'q';
  list=list.filter(m=>!m.promotion||m.promotion===want);
 }
 return list;
}

// Returns {san, move} for a unique match, or {error, count} otherwise.
function resolveDescriptive(chess,raw){
 const parsed=parseToken(raw);
 if(!parsed)return {error:'unparsed',count:0};
 const list=candidates(chess,parsed);
 if(list.length!==1)return {error:list.length?'ambiguous':'no_legal_match',count:list.length,parsed,candidates:list};
 return {san:list[0].san,move:list[0],parsed};
}
function findMoveTokens(text){
 const out=[];MOVE_RE.lastIndex=0;let m;
 while((m=MOVE_RE.exec(text)))out.push({index:m.index,text:m[0]});
 return out;
}
function placementOf(fen){return fen.split(' ')[0];}
function newPosition(fen){return new Chess(fen);}
module.exports={resolveDescriptive,findMoveTokens,parseToken,placementOf,newPosition,MOVE_SOURCE};
