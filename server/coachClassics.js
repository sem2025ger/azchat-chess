'use strict';
// Retrieval over the public-domain and verified classics knowledge base (server/knowledge/classics).
// Pure lookup: no network, no model call. Off unless AI_COACH_CLASSICS_ENABLED=true.
const fs=require('fs');
const path=require('path');
const {THEMES,THEME_IDS,materialSignature}=require('./knowledge/classicsThemes');

const CLASSICS_DIR=path.join(__dirname,'knowledge','classics');
const BOOK_FILES=['capablanca-chess-fundamentals.json','alekhine-best-games-1908-1923.json'];
const DEFAULT_LIMIT=3;
const DEFAULT_MAX_CHARS=1400;

function isClassicsEnabled(env=process.env){return String(env.AI_COACH_CLASSICS_ENABLED||'').toLowerCase()==='true';}
function posKey(fen){return String(fen||'').trim().split(/\s+/).slice(0,4).join(' ');}

const RAW_THEME_MAP={
 'attack':'attack-on-king','attack_on_king':'attack-on-king','kingside_attack':'attack-on-king','queenside_attack':'attack-on-king','mating_attack':'attack-on-king','king_safety':'attack-on-king','king_hunt':'attack-on-king','checkmate':'basic-mates',
 'sacrifice':'combinations','queen_sacrifice':'combinations','exchange_sacrifice':'combinations','pawn_sacrifice':'combinations','combination':'combinations','tactics':'combinations','complications':'combinations','counterattack':'combinations','deflection':'combinations','pin':'combinations','fork':'combinations','skewer':'combinations',
 'pawn_structure':'pawn-structure','isolated_pawn':'pawn-structure','doubled_pawns':'pawn-structure','backward_pawn':'pawn-structure','weak_squares':'pawn-structure','pawn_break':'pawn-structure',
 'passed_pawn':'passed-pawn','pawn_majority':'pawn-majority','bishop_pair':'bishop-pair','bishop_exchange':'minor-pieces',
 'rook_endgame':'rook-endings','rook_activity':'rook-endings','rook_lift':'attack-on-king','back_rank':'attack-on-king',
 'endgame':'endgame-technique','king_activity':'king-activity',
 'knight_outpost':'holes-outposts','outpost':'holes-outposts','file_control':'open-files','open_file':'open-files','diagonal':'open-files',
 'center_control':'centre-control','central_advance':'centre-control','central_tension':'centre-control','space':'centre-control',
 'development':'opening-development','opening':'opening-development','theory':'opening-development',
 'piece_activity':'piece-coordination','piece_coordination':'piece-coordination','piece_exchange':'piece-coordination','piece_trap':'combinations','domination':'piece-coordination','restriction':'piece-coordination','prophylaxis':'piece-coordination','quiet_move':'piece-coordination',
 'tempo':'initiative','initiative':'initiative','defence':'defence','planning':'planning','compensation':'piece-values','perpetual_check':'defence','draw':'defence','refutation':'opening-traps','gambit':'opening-traps'
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
 const chunks=[];
 for(const book of books){
  const bookId=book.id||book.bookId;
  for(const unit of book.units){
   const unitThemeSet=expandThemes(unit.themes);
   const unitPosKeys=new Set(Array.isArray(unit.positionKeys)?unit.positionKeys:[]);
   if(unit.startFen)unitPosKeys.add(posKey(unit.startFen));
   if(Array.isArray(unit.diagrams))for(const d of unit.diagrams)if(d.fen)unitPosKeys.add(posKey(d.fen));
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
 cache={books,chunks};
 return cache;
}

// Words a player may use for a theme, in the site's languages. Matched on the question text.
const QUERY_TERMS={
 'opposition':/oppos|оппозиц|opposit|opozisiya|muhalefet/iu,
 'pawn-endings':/pawn ending|bauernendspiel|пешечн\p{L}* (?:эндшпил|оконч)|пішак\p{L}* ендшпіл|piyon oyun sonu/iu,
 'rook-endings':/rook ending|turmendspiel|ладейн\p{L}* (?:эндшпил|оконч)|туров\p{L}* ендшпіл|kale oyun sonu|top oyun sonu/iu,
 'passed-pawn':/passed pawn|freibauer|проходн|прохідн|geçer piyon|keçən piyada|promot|umwandl|превращ|перетвор/iu,
 'pawn-majority':/majority|mehrheit|большинств|більшіст|çoğunluk/iu,
 'king-activity':/active king|aktiv\p{L}* könig|активн\p{L}* корол|активн\p{L}* корол|aktiv şah|aktif şah/iu,
 'basic-mates':/basic mate|elementar\p{L}* matt|элементарн\p{L}* мат|мат (?:ладьей|ферзем|двумя слонами|слоном и конем)|matt mit/iu,
 'queen-vs-rook':/queen (?:vs|against|v) rook|dame gegen turm|ферзь против ладьи|ферзь проти тури/iu,
 'minor-pieces':/knight (?:vs|or|against) bishop|bishop (?:vs|or|against) knight|springer (?:gegen|oder) läufer|läufer (?:gegen|oder) springer|конь против слона|слон против коня|кінь проти слона/iu,
 'bishop-pair':/bishop pair|two bishops|läuferpaar|двух слонов|два слона|пара слонів/iu,
 'piece-values':/value of the pieces|figurenwert|ценност\p{L}* фигур|цінніст\p{L}* фігур|taş değer/iu,
 'opening-development':/develop|entwickl|развити|розвит|inkişaf|gelişim/iu,
 'centre-control':/centre|center|zentrum|центр|merkez|mərkəz/iu,
 'opening-traps':/trap|falle|ловушк|пастк|tuzak/iu,
 'attack-on-king':/king ?attack|attack on the king|königsangriff|атак\p{L}* на корол|атак\p{L}* на корол|şah(?:a)? saldır|şaha hücum/iu,
 'combinations':/combination|sacrific|kombination|opfer|комбинац|жертв|комбінац|kombinasiya|kombinasyon|feda/iu,
 'initiative':/initiative|initiativ|инициатив|ініціатив|təşəbbüs|inisiyatif/iu,
 'threats':/threat|drohung|угроз|загроз|təhdid|tehdit/iu,
 'open-files':/open file|offene linie|открыт\p{L}* (?:лини|вертикал)|відкрит\p{L}* (?:лін|вертикал)|açık hat|seventh rank|siebte reihe|седьм\p{L}* горизонтал/iu,
 'pawn-structure':/pawn structure|bauernstruktur|пешечн\p{L}* структур|пішак\p{L}* структур|isolated|isoliert|изолирован|ізольован|backward|rückständig|отстал|doubled|doppelbauer|сдвоен|здвоєн/iu,
 'holes-outposts':/outpost|vorposten|форпост|hole|loch|дыр|слаб\p{L}* пол/iu,
 'piece-coordination':/coordinat|zusammenspiel|взаимодейств|взаємоді/iu,
 'defence':/defen[cs]e|verteidig|защит|захист|müdafiə|savunma/iu,
 'planning':/\bplan|план|plan(?:ung)?\b/iu,
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

// themes: theme ids from the position facts; question: the player's text; fen: the board.
function findClassicPassages({fen=null,themes=[],question='',limit=DEFAULT_LIMIT,maxChars=DEFAULT_MAX_CHARS}={}){
 const {chunks}=loadClassics();
 const wanted=new Set([...themes.filter(t=>THEMES[t]),...themesFromQuestion(question)]);
 const metaKeys=queryMetaKeywords(question);
 const sig=fen?materialSignature(fen):null;
 const targetKey=fen?posKey(fen):null;
 const scored=[];
 for(const entry of chunks){
  const {unit,unitThemeSet,chunkThemeSet,unitPosKeys,chunkPosKeys,metaHaystack}=entry;
  let score=0;const reasons=[];
  if(targetKey){
   if(chunkPosKeys.has(targetKey)){score+=14;reasons.push('exact position');}
   else if(unitPosKeys.has(targetKey)){score+=6;reasons.push('same game position');}
  }
  if(sig&&unit.materialSignature){
   if(unit.materialSignature.exact===sig.exact){score+=6;reasons.push('same material');}
   else if(sig.phase==='endgame'&&unit.materialSignature.pieces===sig.pieces){score+=4;reasons.push('same pieces');}
  }
  for(const t of wanted){
   if(unitThemeSet.has(t)){score+=3;reasons.push(t);}
   else if(chunkThemeSet.has(t)){score+=1;reasons.push(t);}
  }
  for(const k of metaKeys){
   if(metaHaystack.includes(k)){score+=4;reasons.push('metadata match');}
  }
  if(score>0)scored.push({entry,score,reasons});
 }
 scored.sort((a,b)=>b.score-a.score||a.entry.chunk.id.localeCompare(b.entry.chunk.id));
 const maxResults=Math.max(0,limit);
 const chosen=[],usedUnits=new Set(),deferred=[];
 for(const item of scored){
  if(chosen.length>=maxResults)break;
  if(!usedUnits.has(item.entry.unit.id)){usedUnits.add(item.entry.unit.id);chosen.push(item);}
  else deferred.push(item);
 }
 for(const item of deferred){if(chosen.length>=maxResults)break;chosen.push(item);}
 return chosen.map(({entry:{book,bookId,unit,chunk},score,reasons})=>({
  bookId,unitId:unit.id,chunkId:chunk.id,score,reasons:[...new Set(reasons)],
  citation:citationOf(book,unit),
  startFen:unit.startFen,
  ...(unit.opening?{opening:unit.opening}:{}),
  ...(unit.eco?{eco:unit.eco}:{}),
  text:chunk.text.length>maxChars?chunk.text.slice(0,maxChars).replace(/\s+\S*$/,'')+' …':chunk.text
 }));
}

function resetClassicsCacheForTests(){cache=null;}
module.exports={isClassicsEnabled,loadClassics,findClassicPassages,themesFromQuestion,themesFromPositionFacts,citationOf,posKey,resetClassicsCacheForTests};
