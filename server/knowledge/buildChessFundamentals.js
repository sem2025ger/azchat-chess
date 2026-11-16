'use strict';
// Builds the Chessy knowledge record for Capablanca, "Chess Fundamentals" from the
// unmodified Project Gutenberg file. Deterministic: same inputs → byte-identical output.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {UnitTracker,extractRuns,START_FEN}=require('./notationTracker');
const {placementOf}=require('./descriptiveNotation');
const {validateFen}=require('chess.js');
const {tagThemes,materialSignature}=require('./classicsThemes');

const SOURCE_DIR=path.join(__dirname,'classics','sources','capablanca-chess-fundamentals');
const SOURCE_FILE='gutenberg-33870-8.txt';
const SOURCE_SHA256='18256bb515c846caf1608a9a35332eeb23b906ab3aabfd65f5cbe6abe7946939';
const CHUNK_LIMIT=1400;
const CHECKPOINT_MIN_SQUARES=56;

const SECTION_RE=/^(\d{1,2})\. ([A-Z][A-Z0-9 ,:;'"_.\-v]+)$/;
const EXAMPLE_RE=/^EXAMPLE (\d{1,2})\.?/;
const GAME_RE=/^GAME (\d{1,2})\. (.+)$/;
const CHAPTER_RE=/^CHAPTER ([IVX]+)$/;
const PART_RE=/^PART (I{1,2})$/;
const PAGE_RE=/\{(\d{1,3})\}/g;

// Printing/transcription slips that block a legal reading. Applied to the converted text
// only; originalText keeps the Gutenberg wording.
const ERRATA=[
 {unit:'g3',from:'30. P K 4 !',to:'30. P - K 4 !',reason:'dash missing between piece and square'},
];
// Gutenberg marks a few score fragments printed in-line as /* … */; they are set out as
// score lines so the moves continue the game record.
function normalizeScoreMarkup(text){
 return text.replace(/\/\*([\s\S]*?)\*\//g,(_,body)=>'\n'+body.replace(/\s+/g,' ').trim().split(/(?=\b\d{1,3}\. )/).map(l=>'        '+l.trim()).join('\n')+'\n');
}
function prepareText(unit){
 let text=normalizeScoreMarkup(unit.text);
 for(const e of ERRATA)if(e.unit===unit.id){if(!text.includes(e.from))throw new Error('erratum not found: '+e.from);text=text.replace(e.from,e.to);}
 return text;
}

function readSource(){
 const buf=fs.readFileSync(path.join(SOURCE_DIR,SOURCE_FILE));
 const sha=crypto.createHash('sha256').update(buf).digest('hex');
 if(sha!==SOURCE_SHA256)throw new Error('source file changed: '+sha);
 const text=buf.toString('latin1').replace(/\r\n/g,'\n');
 const start=text.indexOf('\n',text.indexOf('*** START OF THIS PROJECT GUTENBERG EBOOK'))+1;
 const end=text.indexOf('*** END OF THIS PROJECT GUTENBERG EBOOK');
 return text.slice(start,end);
}

// Split the book body into units: section introductions, examples and games.
function segment(body){
 const lines=body.split('\n'),units=[];
 let part=null,chapter=null,chapterTitle=null,section=null,unit=null,inBody=false,lastPage=null,pendingChapterTitle=false;
 const open=(kind,props)=>{unit={kind,part,chapter,chapterTitle,section:section&&{...section},...props,lines:[],firstPage:lastPage};units.push(unit);};
 for(const line of lines){
  const trimmed=line.trim();
  if(!inBody){if(trimmed==='CHESS FUNDAMENTALS')inBody=true;continue;}
  let m;
  if((m=trimmed.match(PART_RE))){part=m[1];unit=null;continue;}
  if((m=trimmed.match(CHAPTER_RE))){chapter=m[1];pendingChapterTitle=true;unit=null;continue;}
  if(pendingChapterTitle&&trimmed){chapterTitle=trimmed;pendingChapterTitle=false;continue;}
  if(line===trimmed&&(m=trimmed.match(SECTION_RE))&&!/ - /.test(trimmed)){
   section={number:Number(m[1]),title:m[2].replace(/_/g,'').trim()};
   open('section',{id:`s${m[1]}`,title:section.title});continue;
  }
  const head=trimmed.replace(/^\{(\d+)\}\s*/,(_,n)=>{lastPage=Number(n);return '';});
  if((m=head.match(EXAMPLE_RE))&&line===trimmed){open('example',{id:`e${m[1]}`,title:`Example ${m[1]}`});unit.lines.push(line);continue;}
  if((m=trimmed.match(GAME_RE))&&line===trimmed){section=null;open('game',{id:`g${m[1]}`,title:`Game ${m[1]}. ${m[2]}`});continue;}
  for(const p of line.matchAll(PAGE_RE))lastPage=Number(p[1]);
  if(unit)unit.lines.push(line);
 }
 return units.map(u=>({...u,text:u.lines.join('\n').replace(/^\n+|\s+$/g,'')})).map(({lines,...u})=>u).filter(u=>u.text||u.kind!=='section');
}


// Converts one unit. Diagrams either start a position (examples) or are checked against
// the game score (games and examples that start from the opening position).
const sameSquares=(a,b)=>{const ex=p=>p.split('/').map(r=>r.replace(/\d/g,d=>'.'.repeat(Number(d)))).join('');const x=ex(a),y=ex(b);let n=0;for(let i=0;i<64;i++)if(x[i]===y[i])n++;return n;};
function opensFromStart(run){
 if(!run||run.explicitPly!==0)return false;
 // The first moves must be legal from the opening position; a later ambiguity is fine.
 const t=new UnitTracker();return t.processRun(run).length>=Math.min(run.tokens.length,4);
}
// Converts one unit. A diagram either starts a position (endings, middle-game examples) or,
// in a unit that begins from the opening position, is checked against the game score.
function convertUnit(unit,diagramQueue,diagrams,above){
 const text=prepareText(unit);
 const marks=[...text.matchAll(/\[Illustration\]/g)].map(m=>m.index);
 const runs=extractRuns(text,{tabularMainline:true});
 const gameMode=runs.some(r=>r.mainline);
 const firstMark=marks[0]??Infinity;
 const fromOpening=runs.length>0&&runs[0].tokens[0].index<firstMark&&opensFromStart(runs[0]);
 const trackers=[],unitDiagrams=[],replacements=[],stats={tokens:0,resolved:0,unresolved:0};
 let tracker=null;
 const finish=()=>{if(tracker){for(const k of Object.keys(stats))stats[k]+=tracker.stats[k];trackers.push(tracker);}tracker=null;};
 const startAt=(placement,fromIndex)=>{
  const later=runs.filter(r=>r.tokens[0].index>fromIndex);
  const nextMark=marks.find(i=>i>fromIndex)??Infinity;
  const ply=later.find(r=>r.explicitPly!==null)?.explicitPly??null;
  const turn=ply===null?'w':(ply%2?'b':'w');
  const start=UnitTracker.diagramStart(placement,{turn,fullmove:ply===null?1:Math.floor(ply/2)+1});
  finish();
  if(!validateFen(start.fen).ok)return {fen:start.fen,invalid:validateFen(start.fen).error};
  tracker=new UnitTracker({fen:start.fen,startPly:start.startPly,gameMode});
  tracker.prepareScore(later.filter(r=>r.tokens[0].index<nextMark));
  return {fen:start.fen};
 };
 if(fromOpening){tracker=new UnitTracker({gameMode});tracker.prepareScore(runs);}
 else if(runs.length&&runs[0].tokens[0].index<firstMark&&above)startAt(above,-1); // "In the above position …"
 const events=[...runs.map(r=>({at:r.tokens[0].index,run:r})),...marks.map((at,i)=>({at,mark:i}))].sort((a,b)=>a.at-b.at);
 for(const ev of events){
  if(ev.run){
   if(!tracker){const n=ev.run.tokens.length;stats.tokens+=n;stats.unresolved+=n;continue;}
   for(const t of tracker.processRun(ev.run))replacements.push({index:t.index,length:t.text.length,san:t.san});
   continue;
  }
  const figure=diagramQueue.shift(),d=diagrams[figure];
  const entry={figure:Number(figure),placement:d.placement,method:d.method};
  let best={score:-1,ply:null};
  if(fromOpening&&tracker){
   const main=tracker.main;
   for(let p=Math.max(main.startPly,main.end-2);p<=main.end;p++){const sc=sameSquares(d.placement,placementOf(main.fenAt(p)));if(sc>best.score)best={score:sc,ply:p};}
  }
  // A diagram that is (nearly) the game position is a checkpoint; anything else is a new,
  // hypothetical position ("… some such position as shown in the following diagram").
  if(best.score>=CHECKPOINT_MIN_SQUARES){
   const main=tracker.main;
   entry.role='checkpoint';entry.fen=main.fenAt(main.end);
   entry.matchesScore=best.score===64&&best.ply===main.end;
   entry.squaresAgreeing=best.score;entry.scorePlacement=placementOf(main.fenAt(best.ply));
  }else{
   entry.role='start';
   Object.assign(entry,startAt(d.placement,ev.at));
  }
  unitDiagrams.push(entry);
 }
 finish();
 let modern='',pos=0;
 for(const r of replacements.sort((a,b)=>a.index-b.index)){modern+=text.slice(pos,r.index)+r.san;pos=r.index+r.length;}
 modern+=text.slice(pos);
 const main=trackers[0];
 return {modern,diagrams:unitDiagrams,stats,
  mainline:main?{startFen:main.main.fenAt(main.main.startPly),moves:main.mainlineSans()}:null};
}

function cleanText(text,diagrams){
 let i=0;
 return text.replace(/\[Illustration\]/g,()=>`[Diagram ${diagrams[i++]?.figure??'?'}]`)
  .replace(PAGE_RE,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function pagesOf(text,firstPage){
 const pages=[...text.matchAll(PAGE_RE)].map(m=>Number(m[1]));
 const from=firstPage??pages[0]??null;
 return {from,to:pages.length?Math.max(...pages):from};
}
function chunkUnit(unit,modernClean,originalText){
 const paras=modernClean.split(/\n\n+/),chunks=[];let buf=[];
 const flush=()=>{if(buf.length){chunks.push(buf.join('\n\n'));buf=[];}};
 for(const p of paras){if(buf.length&&buf.join('\n\n').length+p.length>CHUNK_LIMIT)flush();buf.push(p);}
 flush();
 const pages=pagesOf(originalText,unit.firstPage);
 return chunks.map((text,i)=>({id:`${unit.id}-${i+1}`,text}))
  .map(c=>({...c,pages}));
}

function build(){
 const body=readSource();
 const diagrams=JSON.parse(fs.readFileSync(path.join(SOURCE_DIR,'diagrams.json'),'utf8'));
 const sectionThemes=JSON.parse(fs.readFileSync(path.join(SOURCE_DIR,'sectionThemes.json'),'utf8'));
 const queue=Object.keys(diagrams.figures).sort((a,b)=>Number(a)-Number(b));
 const markerCount=(body.match(/\[Illustration\]/g)||[]).length;
 if(markerCount!==queue.length)throw new Error(`diagram count mismatch: text ${markerCount}, figures ${queue.length}`);
 const units=segment(body),out=[],totals={tokens:0,resolved:0,unresolved:0};
 let above=null;
 for(const unit of units){
  const conv=convertUnit(unit,queue,diagrams.figures,above);
  const lastStart=[...conv.diagrams].reverse().find(d=>d.role==='start');
  if(lastStart)above=lastStart.placement;else if(unit.kind!=='section')above=null;
  for(const k of Object.keys(totals))totals[k]+=conv.stats[k];
  const modernClean=cleanText(conv.modern,conv.diagrams);
  const baseThemes=sectionThemes[unit.kind==='game'?unit.id:unit.section?`s${unit.section.number}`:unit.id]||[];
  const startFen=conv.mainline?.startFen||conv.diagrams.find(d=>d.role==='start'&&!d.invalid)?.fen||null;
  const signature=startFen?materialSignature(startFen):null;
  const chunks=chunkUnit(unit,modernClean,unit.text).map(c=>({...c,themes:tagThemes(c.text,baseThemes)}));
  out.push({
   id:unit.id,kind:unit.kind,title:unit.title,part:unit.part,chapter:unit.chapter,chapterTitle:unit.chapterTitle,
   section:unit.section,pages:pagesOf(unit.text,unit.firstPage),themes:baseThemes,
   startFen,materialSignature:signature,
   mainline:conv.mainline&&conv.mainline.moves.length?conv.mainline:null,
   diagrams:conv.diagrams,conversion:conv.stats,
   originalText:unit.text,chunks
  });
 }
 return {
  schemaVersion:1,
  id:'capablanca-chess-fundamentals',
  author:'José Raúl Capablanca',authorDied:1942,
  title:'Chess Fundamentals',firstPublished:1921,
  edition:'Harcourt, Brace & World, New York; G. Bell and Sons, London — revised edition with the author\'s preface of 1 September 1934 (seventeenth printing), as transcribed by Project Gutenberg',
  source:{name:'Project Gutenberg EBook #33870',url:'https://www.gutenberg.org/ebooks/33870',mirror:'https://github.com/GITenberg/Chess-Fundamentals_33870',file:`server/knowledge/classics/sources/capablanca-chess-fundamentals/${SOURCE_FILE}`,sha256:SOURCE_SHA256,producedBy:'Suzanne Lybarger, Suzanne Shell, Jana Srna, Keith Edkins and the Online Distributed Proofreading Team at http://www.pgdp.net'},
  rights:{germany:'Public domain: author died 1942, protection ended 31 December 2012 (§ 64 UrhG, 70 years post mortem auctoris).',usa:'Public domain in the USA (Project Gutenberg).',notes:'Text taken unabridged from the Project Gutenberg transcription; the original Gutenberg file with its licence is kept unmodified next to this record. Moves were converted by ChessAZ from English descriptive notation to SAN; diagram positions were transcribed by ChessAZ.'},
  errata:ERRATA,
  notation:{original:'English descriptive',modern:'SAN (English piece letters), every converted move checked for legality with chess.js',conversion:totals},
  units:out
 };
}
module.exports={build,segment,readSource,prepareText};
