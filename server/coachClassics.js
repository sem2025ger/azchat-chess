'use strict';
// Retrieval over the public-domain classics knowledge base (server/knowledge/classics).
// Pure lookup: no network, no model call. Off unless AI_COACH_CLASSICS_ENABLED=true.
const fs=require('fs');
const path=require('path');
const {THEMES,THEME_IDS,materialSignature}=require('./knowledge/classicsThemes');

const CLASSICS_DIR=path.join(__dirname,'knowledge','classics');
const BOOK_FILES=['capablanca-chess-fundamentals.json'];
const DEFAULT_LIMIT=3;
const DEFAULT_MAX_CHARS=1400;

function isClassicsEnabled(env=process.env){return String(env.AI_COACH_CLASSICS_ENABLED||'').toLowerCase()==='true';}

let cache=null;
function loadClassics(){
 if(cache)return cache;
 const books=BOOK_FILES.map(f=>JSON.parse(fs.readFileSync(path.join(CLASSICS_DIR,f),'utf8')));
 const chunks=[];
 for(const book of books)for(const unit of book.units)for(const chunk of unit.chunks)chunks.push({book,unit,chunk});
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

function citationOf(book,unit){
 const pages=unit.pages&&unit.pages.from?(unit.pages.to&&unit.pages.to!==unit.pages.from?`pp. ${unit.pages.from}–${unit.pages.to}`:`p. ${unit.pages.from}`):null;
 return [`${book.author}, ${book.title} (${book.firstPublished})`,unit.section?`§${unit.section.number} ${titleCase(unit.section.title)}`:null,unit.title,pages].filter(Boolean).join(', ');
}
function titleCase(s){return s.toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase());}

// themes: theme ids from the position facts; question: the player's text; fen: the board.
function findClassicPassages({fen=null,themes=[],question='',limit=DEFAULT_LIMIT,maxChars=DEFAULT_MAX_CHARS}={}){
 const {chunks}=loadClassics();
 const wanted=new Set([...themes.filter(t=>THEMES[t]),...themesFromQuestion(question)]);
 const sig=fen?materialSignature(fen):null;
 const scored=[];
 for(const entry of chunks){
  const {unit,chunk}=entry;let score=0;const reasons=[];
  if(sig&&unit.materialSignature){
   if(unit.materialSignature.exact===sig.exact){score+=6;reasons.push('same material');}
   else if(sig.phase==='endgame'&&unit.materialSignature.pieces===sig.pieces){score+=4;reasons.push('same pieces');}
  }
  for(const t of wanted){
   if(unit.themes.includes(t)){score+=3;reasons.push(t);}
   else if(chunk.themes.includes(t)){score+=1;reasons.push(t);}
  }
  if(score>0)scored.push({entry,score,reasons});
 }
 scored.sort((a,b)=>b.score-a.score||a.entry.chunk.id.localeCompare(b.entry.chunk.id));
 return scored.slice(0,Math.max(0,limit)).map(({entry:{book,unit,chunk},score,reasons})=>({
  bookId:book.id,unitId:unit.id,chunkId:chunk.id,score,reasons:[...new Set(reasons)],
  citation:citationOf(book,unit),
  startFen:unit.startFen,
  text:chunk.text.length>maxChars?chunk.text.slice(0,maxChars).replace(/\s+\S*$/,'')+' …':chunk.text
 }));
}

function resetClassicsCacheForTests(){cache=null;}
module.exports={isClassicsEnabled,loadClassics,findClassicPassages,themesFromQuestion,citationOf,resetClassicsCacheForTests};
