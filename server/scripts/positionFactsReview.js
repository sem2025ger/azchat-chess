'use strict';
// Manual, database-free QA review. No model retries and no environment flag changes.
const fs=require('node:fs');
const path=require('node:path');
const {Chess}=require('chess.js');
const {groundedChat}=require('../aiCoachChat');
const {positionFacts}=require('../coachPositionFacts');
const {createCoachEngine}=require('../coachEngine');
const positions=require('./positionFactsReview.positions.json');

const OUTPUT=path.resolve(process.cwd(),'position-facts-review.md');
const DRY_RUN=process.env.POSITION_FACTS_REVIEW_DRY_RUN==='1';
const MODEL=process.env.POSITION_FACTS_REVIEW_MODEL||'gpt-6-sol';
const MOVETIME=Number(process.env.POSITION_FACTS_REVIEW_MOVETIME_MS||'900');
const escapeCell=v=>String(v??'—').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
const safeError=e=>String(e?.code||'provider_or_engine_error').replace(/[^a-z0-9_-]/gi,'').slice(0,80);
const quote=v=>String(v??'—').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;').split(/\r?\n/).map(x=>'> '+x).join('\n');

function factSquares(f){
 const result=new Set();
 for(const side of ['white','black']){
  for(const key of ['isolated','passed','blockaded','passedBlockaded'])
   for(const square of f[side].pawns[key])result.add(square);
  for(const item of f[side].outposts)result.add(item.square);
  for(const key of ['undefended','lowerValueAttacked'])
   for(const item of f[side].hanging[key]){result.add(item.square);for(const a of item.attackers)result.add(a);}
  result.add(f[side].king.square);
 }
 return result;
}
function squareChecks(answer,f,engineLines,fen){
 if(!answer)return [];
 const stated=[...new Set((answer.match(/[a-h][1-8]/gi)||[]).map(x=>x.toLowerCase()))];
 const engineSquares=new Set((JSON.stringify(engineLines||[]).match(/[a-h][1-8]/gi)||[]).map(x=>x.toLowerCase()));
 const board=new Chess(fen),occupied=new Set(board.board().flat().filter(Boolean).map(x=>x.square));
 const inFacts=factSquares(f);
 return stated.map(square=>({square,source:inFacts.has(square)?'in facts':engineSquares.has(square)?'in engine lines':occupied.has(square)?'occupied in FEN':'NONE OF THESE'}));
}
const ungrounded=checks=>checks.filter(x=>x.source==='NONE OF THESE').length;
function stubEngine(movetimeMs){
 return {
  analyze:async(fen)=>{
   const board=new Chess(fen);
   const first=board.moves()[0];
   if(!first)throw Object.assign(new Error('terminal'),{code:'terminal_position'});
   return {engine:'dry-run-stub-NOT-Stockfish',budget:{movetimeMs},lines:[{
    sanPv:[first],scoreKind:'cp',scoreWhite:0,depth:0,wdlWhite:null
   }]};
  },
  close:()=>{}
 };
}
const fakeFetch=async(_url,options)=>{
 // Verify the real provider code constructed a valid request. No network.
 const body=JSON.parse(options.body),payload=JSON.parse(body.input);
 if(!Array.isArray(payload.legalMoves)||!payload.position)throw Error('bad_stub_request');
 const answer=payload.evidence.positionFacts
  ?'DRY RUN: позиционные факты переданы в запрос; модель не вызывалась.'
  :'DRY RUN: позиционные факты отсутствуют; модель не вызывалась.';
 return Response.json({status:'completed',output:[{type:'message',role:'assistant',
  content:[{type:'output_text',text:JSON.stringify({answer})}]}]});
};

async function run(){
 if(!Number.isInteger(MOVETIME)||MOVETIME<100||MOVETIME>5000)throw Error('invalid_movetime_ms');
 if(!/^gpt-[a-z0-9.-]{2,64}$/.test(MODEL))throw Error('invalid_model_name');
 if(!DRY_RUN&&!process.env.OPENAI_API_KEY)throw Error('Missing OPENAI_API_KEY (workflow secret name: QA_OPENAI_API_KEY)');
 if(positions.length!==10)throw Error('expected_ten_positions');
 const engine=DRY_RUN?stubEngine(MOVETIME):createCoachEngine({movetimeMs:MOVETIME,log:()=>{}});
 const sections=[],summary=[];
 try{
  for(const [i,p] of positions.entries()){
   const facts=positionFacts(p.fen);
   if(!facts)throw Error('invalid_fixture_'+p.id);
   const board=new Chess(p.fen),question=board.turn()==='w'?'Какой план здесь у белых?':'Какой план здесь у чёрных?';
   const runs={};
   for(const [label,enabled] of [['OFF',false],['ON',true]]){
    let submittedEvidence=null,response=null,error=null;
    // Capture exactly the candidate lines submitted to the model, not a guess
    // from a separate engine run. Never copy Authorization headers or secrets.
    const captureFetch=async(url,options)=>{
     submittedEvidence=JSON.parse(JSON.parse(options.body).input).evidence;
     return (DRY_RUN?fakeFetch:fetch)(url,options);
    };
    try{
     const result=await groundedChat(null,{message:question,fen:p.fen,side:'any',language:'ru'},
      {openaiApiKey:DRY_RUN?'DRY_RUN_NOT_A_KEY':process.env.OPENAI_API_KEY,
       openaiModel:MODEL,engine,positionFactsEnabled:enabled,fetchImpl:captureFetch});
     response=result.answer;
     if(!result.engineVerified)error='engine_not_verified:'+String(result.engineError||'missing');
    }catch(e){error=safeError(e);}
    runs[label]={answer:response,error,engineLines:submittedEvidence?.candidateLines||[],
     origin:submittedEvidence?.candidateOrigin||'not_submitted',
     factsTransmitted:submittedEvidence?.positionFacts!==undefined,
     squares:squareChecks(response,facts,submittedEvidence?.candidateLines,p.fen)};
   }
   const comparable=JSON.stringify(runs.OFF.engineLines)===JSON.stringify(runs.ON.engineLines)
     &&runs.OFF.origin==='server_stockfish_19'&&runs.ON.origin==='server_stockfish_19';
   summary.push({id:p.id,off:ungrounded(runs.OFF.squares),on:ungrounded(runs.ON.squares),
    comparable,failed:!!runs.OFF.error||!!runs.ON.error});
   const table=label=>{
    const r=runs[label];
    return '#### '+label+'\n\n'+
     '**Model answer (first attempt, unedited):**\n\n'+quote(r.answer||('[ERROR: '+r.error+']'))+
     '\n\n**Submitted engine evidence:**\n\n'+'\x60\x60\x60json\n'+
     JSON.stringify({origin:r.origin,candidateLines:r.engineLines},null,2)+
     '\n\x60\x60\x60\n\n'+
     '**Squares named by answer (lexical heuristic):**\n\n'+
     '| Square | Classification |\n|---|---|\n'+
     (r.squares.length?r.squares.map(z=>'| '+z.square+' | '+z.source+' |').join('\n'):'| — | None |')+
     '\n\nFacts passed to model: **'+(r.factsTransmitted?'yes':'no')+
     '**. Error/engine warning: '+escapeCell(r.error||'none')+'.\n';
   };
   sections.push('## '+(i+1)+'. '+escapeCell(p.id)+' — '+escapeCell(p.theme)+'\n\n'+
    '**Source game:** '+escapeCell(p.white)+' — '+escapeCell(p.black)+', '+
    p.year+', '+escapeCell(p.event)+', after '+escapeCell(p.move)+
    '. [PGN source]('+p.sourceUrl+')\n\n'+
    '**FEN:** \x60'+p.fen+'\x60\n\n**Question (both runs):** '+question+
    '\n\n**Verified positionFacts JSON:**\n\n'+'\x60\x60\x60json\n'+JSON.stringify(facts,null,2)+
    '\n\x60\x60\x60\n\n'+table('OFF')+'\n'+table('ON')+
    '\n**Stockfish evidence identical between runs:** '+(comparable?'YES':'NO / NOT VERIFIED')+
    '\n\n---\n');
   process.stdout.write('Position '+(i+1)+'/10: '+p.id+
    ' (OFF missing='+ungrounded(runs.OFF.squares)+', ON missing='+ungrounded(runs.ON.squares)+')\n');
  }
 }finally{engine.close();}
 const failures=summary.filter(s=>s.failed).length,nonComparable=summary.filter(s=>!s.comparable).length;
 const header='# ChessAZ Position Facts V1 — manual OFF/ON review\n\n'+
  '> **'+(DRY_RUN?'DRY RUN: synthetic provider and fake engine; NOT a chess-quality result':
   'LIVE RUN: OpenAI API and Stockfish; first response per condition only')+'**\n\n'+
  '- Input: 10 replayable master-game FEN positions, no database, no archive, same question per position.\n'+
  '- Model: \x60'+MODEL+'\x60; engine movetime: '+MOVETIME+' ms; position facts flag passed per call (OFF then ON).\n'+
  '- "NONE OF THESE" is a **possible unsupported square**, not proof of hallucination; conversely a square present in FEN or engine lines does **not** validate a claimed positional feature.\n'+
  '- Square extraction is a lexical regex \x60[a-h][1-8]\x60; manual chess review is mandatory.\n'+
  '- No retries, no edited answers. An engine failure or unverified evidence is explicitly labelled.\n\n'+
  '## Summary\n\n| Position | OFF: squares NONE OF THESE | ON: squares NONE OF THESE | Same engine evidence? | Any error? |\n'+
  '|---|---:|---:|---|---|\n'+summary.map(s=>'| '+s.id+' | '+s.off+' | '+s.on+' | '+
   (s.comparable?'YES':'NO')+' | '+(s.failed?'YES':'NO')+' |').join('\n')+
  '\n\n**Errors/warnings:** '+failures+' positions; **non-comparable or missing server engine evidence:** '+
  nonComparable+' positions.\n\n---\n\n';
 fs.writeFileSync(OUTPUT,header+sections.join('\n'),{encoding:'utf8',flag:'w',mode:0o600});
 process.stdout.write('Report written: '+OUTPUT+' (10 positions; no secrets)\n');
}
if(require.main===module)run().catch(e=>{console.error('Position facts review crashed: '+safeError(e));process.exitCode=1;});
module.exports={squareChecks,factSquares,run};
