'use strict';
// Isolated manual Classics QA review (OFF vs ON, 12 positions x 2 = 24 calls max, no retries, no DB).
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const {Chess,validateFen}=require('chess.js');
const {groundedChat}=require('../aiCoachChat');
const {positionFacts}=require('../coachPositionFacts');
const {createCoachEngine}=require('../coachEngine');

const MD_OUTPUT=path.resolve(process.cwd(),'classics-qa-review.md');
const JSON_OUTPUT=path.resolve(process.cwd(),'classics-qa-review.json');
const DRY_RUN=process.env.CLASSICS_QA_REVIEW_DRY_RUN==='1';
const MODEL=process.env.CLASSICS_QA_REVIEW_MODEL||'gpt-6-sol';
const MOVETIME=Number(process.env.CLASSICS_QA_REVIEW_MOVETIME_MS||'900');
const MAX_MODEL_CALLS=24;

function fromMoves(movesStr){
 const c=new Chess();
 for(const m of movesStr.trim().split(/\s+/))c.move(m,{strict:true});
 return c.fen();
}

function loadAlekhineFen(gameNumber,ply){
 const file=path.join(__dirname,'..','knowledge','classics','alekhine-best-games-1908-1923.json');
 const book=JSON.parse(fs.readFileSync(file,'utf8'));
 const unit=book.units.find(u=>u.gameNumber===gameNumber);
 if(!unit)throw Error('missing_alekhine_game_'+gameNumber);
 const c=new Chess(unit.startFen);
 for(let i=0;i<ply;i++)c.move(unit.mainline[i],{strict:true});
 return c.fen();
}

function buildCases(){
 return [
  {id:'01-outpost',theme:'Positional advantage',lang:'en',side:'white',
   name:'Sicilian Boleslavsky (d5 outpost)',
   fen:fromMoves('e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6'),
   question:"What is White's positional plan regarding the d5 outpost and weak squares?"},
  {id:'02-carlsbad',theme:'Pawn structures',lang:'de',side:'white',
   name:'QGD Exchange Carlsbad (minority attack)',
   fen:fromMoves('d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8'),
   question:'Welcher strategische Plan (Minoritätsangriff und Bauernstruktur) ist hier für Weiß am besten?'},
  {id:'03-french-minor',theme:'Positional / minor pieces',lang:'ru',side:'white',
   name:'Good Knight vs Bad French Bishop',
   fen:fromMoves('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 O-O Ng6 Re1 Be7 Bd3 O-O'),
   question:'Как белым использовать преимущество коня против плохого слона в этой пешечной структуре?'},
  {id:'04-ruy-center',theme:'Positional / bishop pair',lang:'tr',side:'white',
   name:'Ruy Lopez Exchange (open center)',
   fen:fromMoves('e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 d4 exd4 Qxd4 Qxd4 Nxd4 Bd7 Nc3 O-O-O Be3'),
   question:'Bu konumda beyazın merkez kontrolü ve uzun vadeli stratejik planı nedir?'},
  {id:'05-alekhine-g97',theme:'Dynamic initiative',lang:'en',side:'white',
   name:'Alekhine–Sämisch 1923 (Game 97, after 20.Nd5!!)',
   fen:loadAlekhineFen(97,39),
   question:'How does White press the initiative after the queen sacrifice here?'},
  {id:'06-prophylaxis',theme:'Prophylaxis / defence',lang:'en',side:'black',
   name:'French Advance defensive counterplay',
   fen:fromMoves('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Bd3 Bd7 O-O cxd4 cxd4 Nxd4 Nxd4 Qxd4 Nc3 a6 Re1'),
   question:"What is Black's best defensive and prophylactic plan against White's kingside attack?"},
  {id:'07-alekhine-g89',theme:'Attack',lang:'az',side:'white',
   name:'Alekhine–Drewitt 1923 (Game 89, pre-20.Bxh7+!)',
   fen:loadAlekhineFen(89,38),
   question:'Bu mövqedə ağların şaha hücum və feda planı necədir?'},
  {id:'08-alekhine-g55',theme:'Attack',lang:'de',side:'white',
   name:'Alekhine–Bogoljubov 1921 (Game 55, pre-16.Be4!!)',
   fen:loadAlekhineFen(55,30),
   question:'Wie setzt Weiß den Königsangriff mit einer Kombination fort?'},
  {id:'09-sac-center',theme:'Sacrifices / initiative',lang:'uk',side:'white',
   name:'Giuoco Piano center play & sacrifice check',
   fen:fromMoves('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O'),
   question:'Який план гри і чи є тут ідеї для комбінації або жертви?'},
  {id:'10-dragon-exch',theme:'Sacrifices',lang:'en',side:'black',
   name:'Sicilian Dragon Rxc3 exchange sacrifice motif',
   fen:fromMoves('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 h4 Nc4 Bxc4 Rxc4'),
   question:'Is an exchange sacrifice on c3 justified here to gain initiative and dark-square play?'},
  {id:'11-capa-e59',theme:'Endgames (Rook)',lang:'en',side:'white',
   name:'Capablanca Chess Fundamentals Ex. 59 Rook Ending',
   fen:'8/7R/8/2k2P2/1p6/3r4/5PKP/8 w - - 0 1',
   question:'How should White play this rook ending with passed pawns?'},
  {id:'12-opposition',theme:'Endgames (K+P Opposition)',lang:'de',side:'white',
   name:'Pure King and Pawn Opposition Endgame',
   fen:'4k3/8/8/4P3/4K3/8/8/8 w - - 0 1',
   question:'Wie gewinnt Weiß dieses Bauernendspiel mit der Opposition und aktivem König?'}
 ];
}

const escapeCell=v=>String(v??'—').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
const safeError=e=>String(e?.code||'provider_or_engine_error').replace(/[^a-z0-9_-]/gi,'').slice(0,80);
const quote=v=>String(v??'—').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;').split(/\r?\n/).map(x=>'> '+x).join('\n');
const coreEngineFields=lines=>(lines||[]).map(({id,moves,scoreKind,scoreWhite,depth,wdlWhite})=>({id,moves,scoreKind,scoreWhite,depth,wdlWhite}));

function stubEngine(movetimeMs){
 return {
  warmup:async()=>{},
  analyze:async(fen)=>{
   const b=new Chess(fen),first=b.moves()[0];
   if(!first)throw Object.assign(Error('terminal'),{code:'terminal_position'});
   return {engine:'dry-run-stub-NOT-Stockfish',budget:{movetimeMs},lines:[{sanPv:[first],scoreKind:'cp',scoreWhite:0,depth:0,wdlWhite:null}]};
  },
  close:()=>{}
 };
}

const fakeFetch=async(_url,options)=>{
 const body=JSON.parse(options.body),payload=JSON.parse(body.input);
 if(!Array.isArray(payload.legalMoves)||!payload.position)throw Error('bad_stub_request');
 const hasClassics=Array.isArray(payload.evidence.classicsKnowledge)&&payload.evidence.classicsKnowledge.length>0;
 const answer=hasClassics
  ?'DRY RUN: classicsKnowledge ('+payload.evidence.classicsKnowledge.map(c=>c.unitId).join(', ')+') attached; live model not called.'
  :'DRY RUN: classicsKnowledge omitted (OFF); live model not called.';
 return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer})}]}]});
};

async function run({dryRun=DRY_RUN,model=MODEL,movetimeMs=MOVETIME,mdOutput=MD_OUTPUT,jsonOutput=JSON_OUTPUT}={}){
 if(!Number.isInteger(movetimeMs)||movetimeMs<100||movetimeMs>5000)throw Error('invalid_movetime_ms');
 if(!/^gpt-[a-z0-9.-]{2,64}$/.test(model))throw Error('invalid_model_name');
 if(!dryRun&&!process.env.OPENAI_API_KEY)throw Error('Missing OPENAI_API_KEY (workflow secret name: QA_OPENAI_API_KEY)');
 const cases=buildCases();
 if(cases.length!==12)throw Error('expected_twelve_positions');
 for(const c of cases)if(!validateFen(c.fen).ok)throw Error('invalid_fen_'+c.id);

 const engine=dryRun?stubEngine(movetimeMs):createCoachEngine({movetimeMs,log:()=>{}});
 const records=[];
 let modelCalls=0,consecutiveFailures=0;
 const startedAt=new Date().toISOString();

 try{
  // Verify Stockfish 19 initializes and produces usable analysis before spending any model call.
  const preflightT0=performance.now();
  const preflight=await engine.analyze(cases[0].fen);
  const preflightMs=Math.round(performance.now()-preflightT0);
  if(!dryRun&&(preflight.engine!=='stockfish-19-lite'||!preflight.lines.length||!preflight.lines[0].depth)){
   throw Error('stockfish_preflight_failed');
  }

  for(const tc of cases){
   const facts=positionFacts(tc.fen);
   if(!facts)throw Error('invalid_facts_'+tc.id);
   const runs={};
   for(const [label,classicsEnabled] of [['OFF',false],['ON',true]]){
    if(modelCalls>=MAX_MODEL_CALLS)throw Error('max_model_calls_exceeded');
    let submittedEvidence=null,submittedInstructionsLen=0,response=null,error=null,httpStatus=null;
    const t0=performance.now();
    const captureFetch=async(url,options)=>{
     modelCalls++;
     const parsed=JSON.parse(options.body);
     submittedEvidence=JSON.parse(parsed.input).evidence;
     submittedInstructionsLen=parsed.instructions.length;
     const res=await (dryRun?fakeFetch:fetch)(url,options);
     httpStatus=res.status;
     return res;
    };
    try{
     const result=await groundedChat(null,{message:tc.question,fen:tc.fen,side:tc.side,language:tc.lang},{
      openaiApiKey:dryRun?'DRY_RUN_NOT_A_KEY':process.env.OPENAI_API_KEY,
      openaiModel:model,engine,positionFactsEnabled:true,classicsEnabled,fetchImpl:captureFetch
     });
     response=result.answer;
     if(!result.engineVerified)error='engine_not_verified:'+String(result.engineError||'missing');
     else consecutiveFailures=0;
    }catch(e){
     error=safeError(e);
     consecutiveFailures++;
    }
    const latencyMs=Math.round(performance.now()-t0);
    runs[label]={
     answer:response,error,httpStatus,latencyMs,answerChars:response?response.length:0,
     origin:submittedEvidence?.candidateOrigin||'not_submitted',
     engineLines:coreEngineFields(submittedEvidence?.candidateLines),
     evidenceBytes:submittedEvidence?Buffer.byteLength(JSON.stringify(submittedEvidence),'utf8'):0,
     instructionsLen:submittedInstructionsLen,
     classicsKnowledge:(submittedEvidence?.classicsKnowledge||[]).map(c=>({
      bookId:c.bookId,unitId:c.unitId,citation:c.citation,reasons:c.reasons,textLen:c.text.length
     }))
    };
    if(!dryRun&&consecutiveFailures>=2){
     records.push({tc,runs,comparable:false,abortedEarly:true});
     throw Object.assign(Error('aborted_after_consecutive_provider_failures'),{code:error||'provider_unavailable'});
    }
   }
   const comparable=(dryRun||runs.OFF.origin==='server_stockfish_19'&&runs.ON.origin==='server_stockfish_19')&&
    JSON.stringify(runs.OFF.engineLines)===JSON.stringify(runs.ON.engineLines);
   records.push({tc,runs,comparable,abortedEarly:false});
  }

  const reportData={
   meta:{
    dryRun,model,movetimeMs,startedAt,completedAt:new Date().toISOString(),
    preflight:{engine:preflight.engine,depth:preflight.lines[0]?.depth??0,firstMove:preflight.lines[0]?.sanPv?.[0]||null,ms:preflightMs},
    modelCalls,totalPositions:records.length,
    allComparableEngine:records.every(r=>r.comparable),
    allSucceeded:records.every(r=>!r.runs.OFF.error&&!r.runs.ON.error)
   },
   records
  };

  const summaryRows=records.map(({tc,runs,comparable})=>{
   const sf=runs.ON.engineLines[0];
   const sfText=sf?`${sf.moves[0]} (${sf.scoreKind==='mate'?'M'+sf.scoreWhite:(sf.scoreWhite>=0?'+':'')+sf.scoreWhite+'cp'} d${sf.depth})`:'none';
   const hits=runs.ON.classicsKnowledge.map(c=>`${c.bookId.startsWith('alekhine')?'ALE':'CAP'}:${c.unitId}`).join(', ')||'none';
   return `| ${tc.id} | ${tc.lang.toUpperCase()} | ${escapeCell(tc.theme)} | ${escapeCell(sfText)} | ${escapeCell(hits)} | ${runs.OFF.latencyMs}ms / ${runs.ON.latencyMs}ms | ${comparable?'YES':'NO'} | ${runs.OFF.error||runs.ON.error||'NO'} |`;
  });

  const sections=records.map(({tc,runs,comparable})=>{
   const sfBlock=runs.ON.engineLines.map(l=>`- \`${l.id}\` (${l.scoreKind==='mate'?'M'+l.scoreWhite:l.scoreWhite+' cp'}, d${l.depth}): \`${l.moves.join(' ')}\``).join('\n')||'- none';
   const classicsBlock=runs.ON.classicsKnowledge.map(c=>`- **${c.bookId}:${c.unitId}** — ${escapeCell(c.citation)} (reasons: \`${c.reasons.join(', ')}\`, ${c.textLen} chars)`).join('\n')||'- none';
   return [
    `## ${tc.id} — ${tc.name} [${tc.lang.toUpperCase()}]`,
    `- **Theme:** ${tc.theme} | **Side:** ${tc.side} | **Same SF19 evidence:** ${comparable?'YES':'NO'}`,
    `- **FEN:** \`${tc.fen}\``,
    `- **Question:** ${escapeCell(tc.question)}`,
    `- **Stockfish 19 MultiPV:**`,
    sfBlock,
    `- **Retrieved Classics (ON):**`,
    classicsBlock,
    `- **OFF** (${runs.OFF.latencyMs} ms, ${runs.OFF.answerChars} chars, ${runs.OFF.evidenceBytes} B evidence${runs.OFF.error?`, error: \`${runs.OFF.error}\``:''}):`,
    quote(runs.OFF.answer||`ERROR: ${runs.OFF.error}`),
    `- **ON** (${runs.ON.latencyMs} ms, ${runs.ON.answerChars} chars, ${runs.ON.evidenceBytes} B evidence${runs.ON.error?`, error: \`${runs.ON.error}\``:''}):`,
    quote(runs.ON.answer||`ERROR: ${runs.ON.error}`)
   ].join('\n');
  });

  const md=[
   '# ChessAZ Classics Live QA Review — OFF vs ON (PR #240)',
   '',
   dryRun?'> **DRY RUN: synthetic provider and stub engine; NOT a live AI quality result.**':'- **Mode:** GENUINE LIVE OPENAI + STOCKFISH 19 ISOLATED EVALUATION (no database, no retries, no hosted flag changes).',
   `- **Model:** \`${model}\` | **Stockfish 19 movetime:** ${movetimeMs} ms | **Total model calls:** ${modelCalls}/${MAX_MODEL_CALLS}`,
   `- **Stockfish 19 preflight:** engine=\`${preflight.engine}\`, depth=${preflight.lines[0]?.depth??0}, top=\`${preflight.lines[0]?.sanPv?.[0]||'?'}\`, time=${preflightMs} ms`,
   '',
   '## Summary',
   '| ID | Lang | Theme | SF19 Top | Classics ON Hits | Latency OFF/ON | Same SF19? | Error? |',
   '|---|---|---|---|---|---|---|---|',
   ...summaryRows,
   '',
   ...sections,
   ''
  ].join('\n');

  fs.writeFileSync(mdOutput,md,{mode:0o600});
  fs.writeFileSync(jsonOutput,JSON.stringify(reportData,null,2)+'\n',{mode:0o600});
  return reportData;
 }finally{engine.close();}
}

if(require.main===module){
 run().then(r=>{
  console.log(JSON.stringify({event:'classics_qa_review_done',dryRun:r.meta.dryRun,model:r.meta.model,modelCalls:r.meta.modelCalls,totalPositions:r.meta.totalPositions,allComparableEngine:r.meta.allComparableEngine,allSucceeded:r.meta.allSucceeded}));
 }).catch(e=>{
  console.error(JSON.stringify({event:'classics_qa_review_failed',code:safeError(e),message:String(e.message||'').slice(0,120)}));
  process.exit(1);
 });
}
module.exports={buildCases,run,MAX_MODEL_CALLS};
