'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {buildNimzowitschStrategy,MAX_SIGNALS}=require('./coachNimzowitsch');
const {groundedChat}=require('./aiCoachChat');

function sampleFacts(){
 return {
  white:{
   pawns:{passedBlockaded:['e5'],isolated:['d4'],doubledFiles:['c'],passed:['e5']},
   outposts:[{piece:'n',square:'d5'}],
   files:{open:['a'],halfOpen:['b']},
   strategy:{holesOccupiedByEnemyPiece:['f4']}
  },
  black:{
   pawns:{passedBlockaded:[],isolated:['a7'],doubledFiles:[]},
   outposts:[],files:{open:['a'],halfOpen:['c']},
   strategy:{holesOccupiedByEnemyPiece:[]}
  }
 };
}
test('strategic lenses are absent without a verified server engine',()=>{
 assert.equal(buildNimzowitschStrategy(sampleFacts()),null);
 assert.equal(buildNimzowitschStrategy(sampleFacts(),{engineVerified:false}),null);
 assert.equal(buildNimzowitschStrategy(null,{engineVerified:true}),null);
});
test('strategic signals use only observed squares and files and stay bounded',()=>{
 const data=buildNimzowitschStrategy(sampleFacts(),{engineVerified:true});
 assert.equal(data.kind,'nonverbatim_strategic_lenses');
 assert.ok(data.signals.length<=MAX_SIGNALS);
 assert.ok(data.signals.some(x=>x.theme==='blockade'&&x.side==='white'&&x.locations[0]==='e5'));
 assert.ok(data.signals.some(x=>x.theme==='outpost'&&x.locations[0]==='d5'));
 assert.ok(data.signals.some(x=>x.theme==='isolated-pawn'&&x.side==='black'&&x.locations[0]==='a7'));
 assert.ok(data.signals.some(x=>x.theme==='open-files'&&x.side==='both'&&x.locations[0]==='a'));
 assert.equal(JSON.stringify(data).includes('My System'),false,'book text or attribution is not embedded in the evidence');
});
const STEINITZ_FEN='r1bqk2r/ppp2ppp/2n5/3n4/1bBP4/2N2N2/PP3PPP/R1BQK2R w KQkq - 0 9';
const VERIFIED_PV=['O-O','Bxc3','bxc3','O-O','Re1'];
const engine={analyze:async()=>({engine:'stockfish-19-lite',budget:{movetimeMs:900},
 lines:[{sanPv:VERIFIED_PV,scoreKind:'cp',scoreWhite:28,depth:14,wdlWhite:[350,420,230]}]})};
const respond=()=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Verified strategic analysis.'})}]}]});
test('feature OFF leaves evidence and prompts unchanged; ON adds strategy only with engine verification',async()=>{
 const seen=[];
 const fetchImpl=async(_url,options)=>{
  const payload=JSON.parse(options.body);
  seen.push({evidence:JSON.parse(payload.input).evidence,instructions:payload.instructions});
  return respond();
 };
 const q={fen:STEINITZ_FEN,message:'Какой план у белых?',language:'ru',side:'any'};
 assert.ok(new Chess(q.fen).moves().includes('O-O'));
 const common={openaiApiKey:'synthetic',engine,fetchImpl,positionFactsEnabled:true};
 await groundedChat(null,q,common);
 await groundedChat(null,q,{...common,nimzowitschPrinciplesEnabled:false});
 await groundedChat(null,q,{...common,nimzowitschPrinciplesEnabled:true});
 assert.deepEqual(seen[0],seen[1],'disabled flag must be byte-compatible with existing behavior');
 assert.equal(Object.hasOwn(seen[1].evidence,'nimzowitschStrategy'),false);
 const enabled=seen[2];
 assert.ok(enabled.evidence.nimzowitschStrategy);
 assert.equal(enabled.evidence.candidateOrigin,'server_stockfish_19');
 assert.deepEqual(enabled.evidence.candidateLines[0].moves,VERIFIED_PV);
 assert.ok(enabled.instructions.includes('evidence.nimzowitschStrategy is an original'));
 assert.ok(enabled.instructions.includes('verified Stockfish candidateLines'));
 assert.equal(enabled.instructions.split('evidence.nimzowitschStrategy is an original').length-1,1);
 assert.equal(JSON.stringify(enabled.evidence).includes('originalText'),false);
});
test('client-supplied lines alone never activate Nimzowitsch strategy evidence',async()=>{
 const seen=[];
 const board=new Chess();
 const q={fen:board.fen(),message:'Explain the plan',language:'en',side:'any',candidateLines:[{moves:['e4','e5']}]};
 await groundedChat(null,q,{openaiApiKey:'synthetic',positionFactsEnabled:true,nimzowitschPrinciplesEnabled:true,
  fetchImpl:async(_url,options)=>{seen.push(JSON.parse(options.body));return respond();}});
 const e=JSON.parse(seen[0].input).evidence;
 assert.equal(e.candidateOrigin,'untrusted_client_legality_checked');
 assert.equal(Object.hasOwn(e,'nimzowitschStrategy'),false);
 assert.equal(seen[0].instructions.includes('evidence.nimzowitschStrategy is an original'),false);
});
