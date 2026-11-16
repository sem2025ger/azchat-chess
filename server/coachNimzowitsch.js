'use strict';

// Original, non-verbatim ChessAZ teaching rules informed by strategic themes in
// Nimzowitsch's My System. No translated book text, diagrams or game scores.
const MAX_SIGNALS=7;

function buildNimzowitschStrategy(facts,{engineVerified=false}={}){
 if(!engineVerified||!facts?.white||!facts?.black)return null;
 const signals=[];
 function add(side,theme,locations,question){
  if(!Array.isArray(locations)||!locations.length)return;
  signals.push({side,theme,locations:locations.slice(0,8),question});
 }
 for(const side of ['white','black']){
  const s=facts[side],p=s?.pawns||{},f=s?.files||{};
  const entries=[];
  function include(theme,locations,question){
   if(Array.isArray(locations)&&locations.length)entries.push({side,theme,locations:locations.slice(0,8),question});
  }
  include('blockade',p.passedBlockaded,
   'Is the blockade of the passed pawn sustainable in the verified variation?');
  include('outpost',(s?.outposts||[]).map(x=>x.square),
   'Can the supported piece remain on this outpost after the opponent best reply?');
  include('isolated-pawn',p.isolated,
   'Does the isolated pawn offer dynamic activity or become an exploitable target?');
  include('occupied-weak-squares',s?.strategy?.holesOccupiedByEnemyPiece,
   'Is the enemy piece on this pawn-weak square a real strategic problem?');
  include('doubled-pawns',p.doubledFiles,
   'Are the doubled pawns a practical weakness in the engine line?');
  include('half-open-files',f.halfOpen,
   'Could the half-open file become useful for major pieces?');
  signals.push(...entries.slice(0,3));
 }
 add('both','open-files',facts.white.files?.open,
  'Does the verified variation make use of an open file or an entry square?');
 return {
  schemaVersion:1,
  kind:'nonverbatim_strategic_lenses',
  methodology:[
   'Evaluate concrete position and counterplay before naming a plan.',
   'Look for restraint and prophylaxis only when a legal engine line demonstrates their usefulness.',
   'Prefer consolidation or overprotection of strategically important points only if the variation supports it.',
   'A structural feature is not an advantage verdict: let the verified Stockfish score and moves decide.'
  ],
  signals:signals.slice(0,MAX_SIGNALS)
 };
}
module.exports={buildNimzowitschStrategy,MAX_SIGNALS};
