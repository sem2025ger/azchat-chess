'use strict';
// Retrieval over the public-domain and verified classics knowledge base (server/knowledge/classics).
// Pure lookup: no network, no model call. Off unless AI_COACH_CLASSICS_ENABLED=true.
const fs=require('fs');
const path=require('path');
const {Chess}=require('chess.js');
const {THEMES,THEME_IDS,materialSignature}=require('./knowledge/classicsThemes');

const CLASSICS_DIR=path.join(__dirname,'knowledge','classics');
const BOOK_FILES=['capablanca-chess-fundamentals.json','alekhine-best-games-1908-1923.json'];
const DEFAULT_LIMIT=3;
const DEFAULT_MAX_CHARS=1400;

function isClassicsEnabled(env=process.env){return String(env.AI_COACH_CLASSICS_ENABLED||'').toLowerCase()==='true';}
function posKey(fen){return String(fen||'').trim().split(/\s+/).slice(0,4).join(' ');}

const RAW_THEME_MAP={
 'attack':'attack-on-king','attack_on_king':'attack-on-king','kingside_attack':'attack-on-king','queenside_attack':'attack-on-king','mating_attack':'attack-on-king','king_safety':'attack-on-king','king_hunt':'attack-on-king','king_in_center':'attack-on-king','flank_attack':'attack-on-king','pawn_storm':'attack-on-king','mating_threat':'attack-on-king','battery':'attack-on-king',
 'checkmate':'basic-mates','checkmate_patterns':'basic-mates','smothered_mate':'basic-mates',
 'sacrifice':'combinations','queen_sacrifice':'combinations','exchange_sacrifice':'combinations','pawn_sacrifice':'combinations','double_bishop_sacrifice':'combinations','combination':'combinations','tactics':'combinations','complications':'combinations','counterattack':'combinations','deflection':'combinations','pin':'combinations','fork':'combinations','skewer':'combinations','masked_attack':'combinations','interference':'combinations','zwischenzug':'combinations','calculation':'combinations',
 'pawn_structure':'pawn-structure','isolated_pawn':'pawn-structure','doubled_pawns':'pawn-structure','backward_pawn':'pawn-structure','weak_squares':'pawn-structure','pawn_break':'pawn-structure','bind':'pawn-structure','maroczy_bind':'pawn-structure','queen_side_bind':'pawn-structure','weakness':'pawn-structure','pawn_weakness':'pawn-structure','stonewall':'pawn-structure',
 'passed_pawn':'passed-pawn','promotion':'passed-pawn','pawn_majority':'pawn-majority','queenside_majority':'pawn-majority',
 'bishop_pair':'bishop-pair','bishop_exchange':'minor-pieces','bad_bishop':'minor-pieces','opposite_colored_bishops':'minor-pieces','bishop_maneuver':'minor-pieces','knight_maneuver':'minor-pieces',
 'rook_endgame':'rook-endings','rook_activity':'rook-endings','rook_behind_pawn':'rook-endings','rook_lift':'attack-on-king','back_rank':'attack-on-king',
 'endgame':'endgame-technique','conversion':'endgame-technique','endgame_study':'endgame-technique','queen_endgame':'endgame-technique','zugzwang':'endgame-technique','pawn_endgame':'pawn-endings','king_activity':'king-activity','king_infiltration':'king-activity',
 'knight_outpost':'holes-outposts','outpost':'holes-outposts','dark_squares':'holes-outposts','dark_square_weakness':'holes-outposts','blockade':'holes-outposts',
 'file_control':'open-files','open_file':'open-files','diagonal':'open-files','diagonal_control':'open-files','rook_coordination':'open-files','rook_penetration':'open-files','fifth_rank':'open-files',
 'center_control':'centre-control','center':'centre-control','central_advance':'centre-control','central_break':'centre-control','central_tension':'centre-control','center_tension':'centre-control','centralization':'centre-control','space':'centre-control','space_advantage':'centre-control',
 'development':'opening-development','opening':'opening-development','theory':'opening-development','opening_theory':'opening-development','innovation':'opening-development','hypermodern':'opening-development',
 'piece_activity':'piece-coordination','piece_coordination':'piece-coordination','piece_exchange':'piece-coordination','piece_trap':'combinations','domination':'piece-coordination','restriction':'piece-coordination','prophylaxis':'piece-coordination','quiet_move':'piece-coordination','queen_activity':'piece-coordination','queen_penetration':'piece-coordination','queen_sortie':'piece-coordination','queen_trade':'piece-coordination','exchange':'piece-coordination',
 'tempo':'initiative','initiative':'initiative','timing':'initiative','counterplay':'initiative','breakthrough':'initiative',
 'defence':'defence','defense':'defence','perpetual_check':'defence','draw_perpetual':'defence','draw':'defence',
 'planning':'planning','strategy':'planning','long_plan':'planning','simplification':'planning','queenside_play':'planning','queenside':'planning','queen_side_expansion':'planning',
 'compensation':'piece-values','material':'piece-values','material_gain':'piece-values','queen_vs_pieces':'piece-values','refutation':'opening-traps','gambit':'opening-traps'
};

function expandThemes(rawList){
 const out=new Set();
 for(const raw of rawList||[]){
  if(THEMES[raw])out.add(raw);
  const key=String(raw||'').toLowerCase().replace(/-/g,'_');
  if(RAW_THEME_MAP[key])out.add(RAW_THEME_MAP[key]);
  const hyphen=key.replace(/_/g,'-');
  if(THEMES[hyphen])out.add(hyphen);
 }
 return out;
}

const META_ALIASES=[
 [/\balekhin[ae]?|алехин\p{L}*/iu,'alekhine'],
 [/\bcapablanc\p{L}*|капабланк\p{L}*/iu,'capablanca'],
 [/\bsicilian|sizilian\p{L}*|сицилиан\p{L}*|sicilya/iu,'sicilian'],
 [/\bruy lopez|spanisch\p{L}*|испанск\p{L}*|ispanyol|ruy/iu,'ruy lopez'],
 [/\bfrench|französisch\p{L}*|французск\p{L}*|fransız/iu,'french'],
 [/\bqueen'?s gambit|damengambit|ферзев\p{L}* гамбит|vezir gambiti/iu,'queen'],
 [/\bking'?s gambit|königsgambit|королевск\p{L}* гамбит/iu,'king'],
 [/\bscotch|schottisch|шотланд\p{L}*/iu,'scotch'],
 [/\bvienna|wiener|венск\p{L}*/iu,'vienna'],
 [/\benglish opening|englisch|английск\p{L}*/iu,'english'],
 [/\bcarlsbad|карлсбад/iu,'carlsbad'],
 [/\bpistyan|пиштян/iu,'pistyan'],
 [/\bberlin|берлин/iu,'berlin'],
 [/\btarrasch|тарраш/iu,'tarrasch'],
 [/\bsteinitz|стейниц/iu,'steinitz'],
 [/\brubinstein|рубинштейн/iu,'rubinstein'],
 [/\bnimzo|niemzo|нимцович/iu,'nimzo']
];

let cache=null;
function loadClassics(){
 if(cache)return cache;
 const books=BOOK_FILES.map(f=>JSON.parse(fs.readFileSync(path.join(CLASSICS_DIR,f),'utf8')));
 const chunks=[],posKeyFreq=new Map();
 for(const book of books){
  const bookId=book.id||book.bookId;
  for(const unit of book.units){
   const unitThemeSet=expandThemes(unit.themes);
   const unitPosKeys=new Set(Array.isArray(unit.positionKeys)?unit.positionKeys:[]);
   if(unit.startFen)unitPosKeys.add(posKey(unit.startFen));
   if(Array.isArray(unit.diagrams))for(const d of unit.diagrams)if(d.fen&&!d.printerErratum)unitPosKeys.add(posKey(d.fen));
   for(const k of unitPosKeys)posKeyFreq.set(k,(posKeyFreq.get(k)||0)+1);
   const metaHaystack=[book.author,book.title,unit.title,unit.opening,unit.eco,unit.white,unit.black,unit.event,unit.site,unit.year].filter(Boolean).join(' ').toLowerCase();
   const unitChunks=unit.chunks||[];
   for(let i=0;i<unitChunks.length;i++){
    const chunk=unitChunks[i];
    const chunkPosKeys=new Set(Array.isArray(chunk.positionKeys)?chunk.positionKeys:[]);
    if(i===0&&unit.startFen)chunkPosKeys.add(posKey(unit.startFen));
    chunks.push({book,bookId,unit,chunk,unitThemeSet,chunkThemeSet:expandThemes(chunk.themes),unitPosKeys,chunkPosKeys,metaHaystack});
   }
  }
 }
 cache={books,chunks,posKeyFreq};
 return cache;
}

// Words a player may use for a theme, in the site's six languages (DE, EN, AZ, TR, UK/UA, RU).
const QUERY_TERMS={
 'opposition':/oppos|оппозиц|опозиц|opozisiya|muhalefet/iu,
 'pawn-endings':/pawn ending|bauernendspiel|пешечн\p{L}* (?:эндшпил|оконч)|пішак\p{L}* ендшпіл|piyon oyun sonu|piyada oyun sonu/iu,
 'rook-endings':/rook ending|turmendspiel|ладейн\p{L}* (?:эндшпил|оконч)|туров\p{L}* ендшпіл|kale oyun sonu|top oyun sonu/iu,
 'passed-pawn':/passed pawn|freibauer|проходн|прохідн|geçer piyon|keçən piyada|promot|umwandl|превращ|перетвор/iu,
 'pawn-majority':/majority|mehrheit|большинств|більшіст|çoğunluk|çoxluq|piyada çoxlu/iu,
 'king-activity':/active king|king activity|aktiv\p{L}* könig|активн\p{L}* корол|активність корол|aktiv şah|aktif şah/iu,
 'basic-mates':/basic mate|elementar\p{L}* matt|элементарн\p{L}* мат|мат (?:ладьей|ферзем|двумя слонами|слоном и конем)|matt mit|elementar mat|temel mat/iu,
 'queen-vs-rook':/queen (?:vs|against|v) rook|dame gegen turm|ферзь против ладьи|ферзь проти тури|vezir kaleye karşı|vəzir topa qarşı/iu,
 'minor-pieces':/knight (?:vs|or|against) bishop|bishop (?:vs|or|against) knight|bad bishop|good knight|springer (?:gegen|oder) läufer|läufer (?:gegen|oder) springer|schlecht\p{L}* läufer|кон\p{L}* против \p{L}*слон|слон\p{L}* против \p{L}*кон|плох\p{L}* слон|кін\p{L}* проти \p{L}*слон|поган\p{L}* слон|at ve fil|kötü fil|at və fil|pis fil/iu,
 'bishop-pair':/bishop pair|two bishops|läuferpaar|двух слонов|два слона|пара слонів|fil cütü|iki fil|fil çifti/iu,
 'piece-values':/value of the pieces|figurenwert|ценност\p{L}* фигур|цінніст\p{L}* фігур|taş değer|fiqur dəyər/iu,
 'opening-development':/develop|entwickl|развити|розвит|inkişaf|gelişim/iu,
 'centre-control':/centre|center|zentrum|центр|merkez|mərkəz/iu,
 'opening-traps':/trap|falle|ловушк|пастк|tuzak|tələ/iu,
 'attack-on-king':/king'?s?[- ]?side attack|kingside attack|queenside attack|king ?attack|attack on the king|königsangriff|атак\p{L}* на корол|атака на короля|şah(?:a)? saldır|şah kanad|şaha hücum|şah cinah/iu,
 'combinations':/combination|sacrific|kombination|opfer|комбинац|жертв|комбінац|kombinasiya|kombinasyon|feda/iu,
 'initiative':/initiative|initiativ|инициатив|ініціатив|təşəbbüs|inisiyatif/iu,
 'threats':/threat|drohung|угроз|загроз|təhdid|tehdit/iu,
 'open-files':/open file|offene linie|открыт\p{L}* (?:лини|вертикал)|відкрит\p{L}* (?:лін|вертикал)|açık hat|açıq xətt|seventh rank|siebte reihe|седьм\p{L}* горизонтал|yedinci yatay|yeddinci xətt/iu,
 'pawn-structure':/pawn structure|bauernstruktur|пешечн\p{L}* структур|пішак\p{L}* структур|isolated|isoliert|изолирован|ізольован|backward|rückständig|отстал|doubled|doppelbauer|сдвоен|здвоєн|piyada struktur|təcrid olunmuş|qoşa piyada|piyon yapı|izole piyon|duble piyon/iu,
 'holes-outposts':/outpost|weak squares?|vorposten|форпост|hole|loch|дыр|слаб\p{L}* пол|forpost|zəif xan|ileri karakol|zayıf kare/iu,
 'piece-coordination':/coordinat|zusammenspiel|взаимодейств|взаємоді|koordinasiya|koordinasyon/iu,
 'defence':/defen[cs](?:e|ive)|verteidig|защит|захист|müdafiə|savunma/iu,
 'planning':/\bplan|strateg|план|стратег|plan(?:ung)?\b/iu,
 'endgame-technique':/endgame|ending|endspiel|эндшпил|ендшпіл|oyun sonu|oyunun sonu/iu
};

function themesFromQuestion(text){
 if(!text)return [];
 return THEME_IDS.filter(id=>QUERY_TERMS[id]&&QUERY_TERMS[id].test(text));
}

function themesFromPositionFacts(facts){
 if(!facts||typeof facts!=='object')return [];
 const out=new Set();
 for(const s of [facts.white,facts.black]){
  if(!s)continue;
  if(s.pawns?.isolated?.length||s.pawns?.doubledFiles?.length||s.strategy?.minorityAttack)out.add('pawn-structure');
  if(s.pawns?.passed?.length)out.add('passed-pawn');
  if(s.files?.halfOpen?.length)out.add('open-files');
  if(s.outposts?.length)out.add('holes-outposts');
  if(s.strategy?.holes?.length)out.add('holes-outposts');
 }
 if(facts.material?.white?.bishopPair||facts.material?.black?.bishopPair)out.add('bishop-pair');
 return [...out];
}

function queryMetaKeywords(text){
 if(!text)return [];
 const keys=new Set();
 for(const [re,alias] of META_ALIASES)if(re.test(text))keys.add(alias);
 const eco=text.match(/\b[A-E]\d{2}\b/);
 if(eco)keys.add(eco[0].toLowerCase());
 return [...keys];
}

function citationOf(book,unit){
 const pages=unit.pages&&unit.pages.from?(unit.pages.to&&unit.pages.to!==unit.pages.from?`pp. ${unit.pages.from}–${unit.pages.to}`:`p. ${unit.pages.from}`):null;
 const unitLabel=unit.title||(unit.gameNumber?`Game ${unit.gameNumber}: ${unit.white} vs ${unit.black}${unit.event?` (${unit.event}${unit.year?`, ${unit.year}`:''})`:''}`:null);
 return [`${book.author}, ${book.title} (${book.firstPublished})`,unit.section?`§${unit.section.number} ${titleCase(unit.section.title)}`:null,unitLabel,pages].filter(Boolean).join(', ');
}
function titleCase(s){return s.toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase());}

function trimPassage(text,maxChars){
 if(text.length<=maxChars)return text;
 const slice=text.slice(0,maxChars);
 const minKeep=Math.floor(maxChars*0.6);
 const lastNewline=slice.lastIndexOf('\n');
 if(lastNewline>=minKeep)return slice.slice(0,lastNewline).trimEnd()+' …';
 const lastSentence=slice.lastIndexOf('. ');
 if(lastSentence>=minKeep)return slice.slice(0,lastSentence+1).trimEnd()+' …';
 return slice.replace(/\s+\S*$/,'')+' …';
}

// themes: theme ids from the position facts; question: the player's text; fen: the board.
function findClassicPassages({fen=null,themes=[],question='',limit=DEFAULT_LIMIT,maxChars=DEFAULT_MAX_CHARS}={}){
 const {chunks,posKeyFreq}=loadClassics();
 const qThemes=new Set(themesFromQuestion(question));
 const fThemes=new Set(themes.filter(t=>THEMES[t]&&!qThemes.has(t)));
 const metaKeys=queryMetaKeywords(question);
 const sig=fen?materialSignature(fen):null;
 const targetKey=fen?posKey(fen):null;
 const keyFreq=targetKey?(posKeyFreq.get(targetKey)||0):0;
 const scored=[];
 for(const entry of chunks){
  const {unit,unitThemeSet,chunkThemeSet,unitPosKeys,chunkPosKeys,metaHaystack}=entry;
  let score=0,exactHit=false;const reasons=[];
  if(targetKey){
   if(chunkPosKeys.has(targetKey)){
    if(keyFreq<=2){score+=20;exactHit=true;reasons.push('exact position');}
    else if(keyFreq<=5){score+=6;exactHit=true;reasons.push('exact position');}
    else{score+=1;}
   }else if(unitPosKeys.has(targetKey)){
    if(keyFreq<=2){score+=14;exactHit=true;reasons.push('same game position');}
    else if(keyFreq<=5){score+=3;reasons.push('same game position');}
   }
  }
  if(sig&&unit.materialSignature){
   if(unit.materialSignature.exact===sig.exact){
    score+=sig.phase==='endgame'?8:5;
    reasons.push('same material');
   }else if(sig.phase==='endgame'&&unit.materialSignature.pieces===sig.pieces){
    score+=6;reasons.push('same pieces');
   }
  }
  const specificity=Math.min(1,3/Math.max(3,unitThemeSet.size));
  for(const t of qThemes){
   if(chunkThemeSet.has(t)){score+=4;reasons.push(t);}
   else if(unitThemeSet.has(t)){score+=2*specificity;reasons.push(t);}
  }
  for(const t of fThemes){
   if(chunkThemeSet.has(t)){score+=1.5;reasons.push(t);}
   else if(unitThemeSet.has(t)){score+=0.75*specificity;reasons.push(t);}
  }
  for(const k of metaKeys){
   if(metaHaystack.includes(k)){score+=4;reasons.push('metadata match');}
  }
  if(sig?.phase==='endgame'&&!exactHit&&unit.materialSignature&&unit.materialSignature.phase!=='endgame'){
   score*=0.6;
  }
  const hasSignal=exactHit||metaKeys.length>0||reasons.some(r=>qThemes.has(r)||r==='same material'||r==='same pieces');
  if(score>=(hasSignal?1.5:3))scored.push({entry,score:Math.round(score*100)/100,reasons});
 }
 scored.sort((a,b)=>b.score-a.score||`${a.entry.bookId}:${a.entry.chunk.id}`.localeCompare(`${b.entry.bookId}:${b.entry.chunk.id}`));
 const maxResults=Math.max(0,limit);
 const chosen=[],usedUnits=new Set(),deferred=[];
 for(const item of scored){
  if(chosen.length>=maxResults)break;
  const unitKey=`${item.entry.bookId}:${item.entry.unit.id}`;
  if(!usedUnits.has(unitKey)){usedUnits.add(unitKey);chosen.push(item);}
  else deferred.push(item);
 }
 for(const item of deferred){if(chosen.length>=maxResults)break;chosen.push(item);}
 return chosen.map(({entry:{book,bookId,unit,chunk},score,reasons})=>({
  bookId,unitId:unit.id,chunkId:chunk.id,score,reasons:[...new Set(reasons)],
  citation:citationOf(book,unit),
  startFen:unit.startFen,
  ...(unit.opening?{opening:unit.opening}:{}),
  ...(unit.eco?{eco:unit.eco}:{}),
  text:trimPassage(chunk.text,maxChars)
 }));
}

// ---------- Structural retrieval (used by the chat) ----------
// Theme tags alone matched almost any position (benchmark v1: 63% of middlegame hits irrelevant,
// Game 54 returned for 10 of 40 positions). Here a passage is attached only when the book
// contains this exact position, a middlegame with a similar pawn structure, or an ending with
// the same pieces. Otherwise nothing is attached.
const STRUCTURE_MIN_SIMILARITY=0.75;  // Jaccard over coloured pawn squares (middlegames)
const STRUCTURE_MIN_PAWNS=8;          // fewer pawns: pawn overlap is not a meaningful structure signal
const ENDGAME_MIN_SCORE=0.6;

function parseBoard(board){
 const white=new Set(),black=new Set(),count={};
 board.split('/').forEach((row,ri)=>{
  let file=0;
  for(const ch of row){
   if(/\d/.test(ch)){file+=Number(ch);continue;}
   const sq=file+8*(7-ri);
   if(ch==='P')white.add(sq);else if(ch==='p')black.add(sq);else if(ch!=='K'&&ch!=='k')count[ch]=(count[ch]||0)+1;
   file++;
  }
 });
 const side=letters=>[...'QRBN'].map(p=>letters(p).repeat(count[letters(p)]||0)).join('');
 const whitePieces=side(p=>p),blackPieces=side(p=>p.toLowerCase()).toUpperCase();
 return {white,black,pieces:whitePieces+'v'+blackPieces,swapped:blackPieces+'v'+whitePieces,pawns:white.size+black.size};
}
const flipRanks=set=>new Set([...set].map(sq=>(sq%8)+8*(7-Math.floor(sq/8))));
function pawnJaccard(aW,aB,bW,bB){
 let inter=0;
 for(const s of aW)if(bW.has(s))inter++;
 for(const s of aB)if(bB.has(s))inter++;
 const union=aW.size+aB.size+bW.size+bB.size-inter;
 return union?inter/union:0;
}
// Compare as-is and with colours reversed (board flipped, White and Black swapped).
function structureSimilarity(q,k){
 const same=pawnJaccard(q.white,q.black,k.white,k.black);
 const reversed=pawnJaccard(q.white,q.black,flipRanks(k.black),flipRanks(k.white));
 return reversed>same?{similarity:reversed,coloursReversed:true}:{similarity:same,coloursReversed:false};
}

// Every book position is indexed on the chunk that comments on it. Positions known only at unit
// level (Capablanca start/diagrams, Alekhine plies outside every chunk's key list) go to the chunk
// whose main-line ply range covers them, else to the unit's first chunk.
function mainlinePlyKeys(unit){
 if(!unit.startFen||!Array.isArray(unit.mainline))return [];
 try{
  const board=new Chess(unit.startFen),keys=[posKey(board.fen())];
  for(const san of unit.mainline){board.move(san,{strict:true});keys.push(posKey(board.fen()));}
  return keys;
 }catch{return [];}
}
function structuralIndex(){
 const store=loadClassics();
 if(store.structural)return store.structural;
 const byUnit=new Map();
 store.chunks.forEach((entry,chunkIndex)=>{
  const k=`${entry.bookId}:${entry.unit.id}`;
  if(!byUnit.has(k))byUnit.set(k,[]);
  byUnit.get(k).push(chunkIndex);
 });
 const assigned=new Map(); // chunkIndex -> Set(keys)
 const add=(chunkIndex,key)=>{if(!assigned.has(chunkIndex))assigned.set(chunkIndex,new Set());assigned.get(chunkIndex).add(key);};
 for(const chunkIdxs of byUnit.values()){
  const unit=store.chunks[chunkIdxs[0]].unit;
  const plyKeys=mainlinePlyKeys(unit),plyOf=new Map();
  plyKeys.forEach((k,i)=>{if(!plyOf.has(k))plyOf.set(k,i);});
  const ranges=chunkIdxs.map(ci=>{
   const plies=[...store.chunks[ci].chunkPosKeys].map(k=>plyOf.get(k)).filter(n=>n!==undefined);
   return {ci,min:plies.length?Math.min(...plies):Infinity,max:plies.length?Math.max(...plies):-Infinity};
  });
  const inChunk=new Set();
  for(const ci of chunkIdxs)for(const k of store.chunks[ci].chunkPosKeys){add(ci,k);inChunk.add(k);}
  for(const k of store.chunks[chunkIdxs[0]].unitPosKeys){
   if(inChunk.has(k))continue;
   const ply=plyOf.get(k);
   const covering=ply===undefined?null:ranges.filter(r=>r.min<=ply&&ply<=r.max).sort((a,b)=>(a.max-a.min)-(b.max-b.min))[0];
   add(covering?covering.ci:chunkIdxs[0],k);
  }
 }
 const positions=[];
 for(const [chunkIndex,keys] of assigned){
  for(const key of keys){
   positions.push({chunkIndex,key,board:parseBoard(key.split(' ')[0]),phase:materialSignature(key+' 0 1').phase});
  }
 }
 store.structural={positions};
 return store.structural;
}

function findStructuralPassages({fen,question='',limit=2,maxChars=DEFAULT_MAX_CHARS}={}){
 if(!fen)return [];
 const {chunks,posKeyFreq}=loadClassics();
 const {positions}=structuralIndex();
 const targetKey=posKey(fen),keyFreq=posKeyFreq.get(targetKey)||0;
 const q=parseBoard(fen.split(' ')[0]),phase=materialSignature(fen).phase;
 const qThemes=new Set(themesFromQuestion(question));
 const best=new Map(); // chunkIndex -> candidate
 const consider=(chunkIndex,cand)=>{const cur=best.get(chunkIndex);if(!cur||cand.score>cur.score)best.set(chunkIndex,cand);};
 for(const p of positions){
  if(p.key===targetKey&&keyFreq<=5){consider(p.chunkIndex,{score:100,match:{kind:'exact-position',similarity:1,coloursReversed:false},reasons:['exact position']});continue;}
  if(phase==='endgame'){
   if(p.phase!=='endgame')continue;
   const reversedPieces=p.board.pieces===q.swapped&&p.board.pieces!==q.pieces;
   if(p.board.pieces!==q.pieces&&!reversedPieces)continue;
   const maxDiff=q.pawns>=4?2:1;
   if(Math.abs(p.board.pawns-q.pawns)>maxDiff)continue;
   const s=structureSimilarity(q,p.board);
   const score=ENDGAME_MIN_SCORE+0.4*s.similarity;
   consider(p.chunkIndex,{score,match:{kind:'endgame-material',similarity:Math.round(s.similarity*100)/100,coloursReversed:reversedPieces||s.coloursReversed},reasons:['same endgame material']});
  }else{
   if(q.pawns<STRUCTURE_MIN_PAWNS||p.phase==='endgame'||p.board.pawns<STRUCTURE_MIN_PAWNS)continue;
   const s=structureSimilarity(q,p.board);
   if(s.similarity<STRUCTURE_MIN_SIMILARITY)continue;
   // Tie-break among equal structures: same minor/major pieces on both sides.
   const samePieces=p.board.pieces===(s.coloursReversed?q.swapped:q.pieces);
   consider(p.chunkIndex,{score:s.similarity+(samePieces?0.05:0),match:{kind:'pawn-structure',similarity:Math.round(s.similarity*100)/100,coloursReversed:s.coloursReversed},reasons:['similar pawn structure']});
  }
 }
 let scored=[...best.entries()].map(([chunkIndex,c])=>{
  const entry=chunks[chunkIndex];
  const themeHits=[...qThemes].filter(t=>entry.chunkThemeSet.has(t));
  return {entry,...c,rank:c.score+0.01*themeHits.length,reasons:[...c.reasons,...themeHits]};
 });
 const exact=scored.filter(c=>c.match.kind==='exact-position');
 if(exact.length)scored=scored.filter(c=>c.match.kind==='exact-position'||c.rank>=STRUCTURE_MIN_SIMILARITY);
 scored.sort((a,b)=>b.rank-a.rank||`${a.entry.bookId}:${a.entry.chunk.id}`.localeCompare(`${b.entry.bookId}:${b.entry.chunk.id}`));
 const chosen=[],usedUnits=new Set();
 for(const c of scored){
  if(chosen.length>=Math.max(0,limit))break;
  const unitKey=`${c.entry.bookId}:${c.entry.unit.id}`;
  if(usedUnits.has(unitKey))continue;
  usedUnits.add(unitKey);chosen.push(c);
 }
 return chosen.map(({entry:{book,bookId,unit,chunk},rank,match,reasons})=>({
  bookId,unitId:unit.id,chunkId:chunk.id,score:Math.round(rank*100)/100,reasons:[...new Set(reasons)],match,
  citation:citationOf(book,unit),
  startFen:unit.startFen,
  ...(unit.opening?{opening:unit.opening}:{}),
  ...(unit.eco?{eco:unit.eco}:{}),
  text:trimPassage(chunk.text,maxChars)
 }));
}

function resetClassicsCacheForTests(){cache=null;}
module.exports={isClassicsEnabled,loadClassics,findClassicPassages,findStructuralPassages,themesFromQuestion,themesFromPositionFacts,citationOf,posKey,resetClassicsCacheForTests};
