'use strict';
// Original condensed strategic cues, chosen only from deterministic board facts.
// This does NOT load book texts, verify tactical claims, or certify engine lines.
const bank=require('./coachStrategicPrinciples.json');
const authors=bank.authors;
const cap=8;

function match(condition,own,opp,facts,color){
 const castled=side=>side?.king?.castled===true;
 const sqs=a=>Array.isArray(a)&&a.length?a.slice(0,4).join(','):null;
 switch(condition){
  case 'opponent_uncastled':
   return !castled(opp)&&opp?.king?.square?('enemy king '+opp.king.square+' not castled'):null;
  case 'own_uncastled':
   return !castled(own)&&own?.king?.square?('own king '+own.king.square+' not castled'):null;
  case 'half_open_file':{
   const s=sqs(own?.files?.halfOpen);return s?'half-open files '+s:null;
  }
  case 'material_imbalance':
   return Number.isFinite(facts?.material?.balanceWhite)&&facts.material.balanceWhite!==0?'material balance White '+facts.material.balanceWhite+' pawn units':null;
  case 'isolated_own':{
   const s=sqs(own?.pawns?.isolated);return s?'isolated own pawn(s) '+s:null;
  }
  case 'undefended_own':{
   const a=own?.hanging?.undefended;
   return Array.isArray(a)&&a.length?'static geometric attacks on own '+a.slice(0,3).map(x=>x.piece+' '+x.square).join(', '):null;
  }
  case 'opponent_passed':{
   const s=sqs(opp?.pawns?.passed);return s?'opposing passed pawn(s) '+s:null;
  }
  case 'passed_own':{
   const s=sqs(own?.pawns?.passed);return s?'own passed pawn(s) '+s:null;
  }
  case 'outpost_own':{
   const a=own?.outposts;return Array.isArray(a)&&a.length?'own outposts '+a.slice(0,3).map(x=>x.piece+' '+x.square).join(', '):null;
  }
  case 'occupied_hole_own':{
   const s=sqs(own?.strategy?.holesOccupiedByEnemyPiece);return s?'enemy-occupied weak square(s) '+s:null;
  }
  default:return null;
 }
}
function selectStrategyKnowledge(facts,{limit=6}={}){
 if(!facts||typeof facts!=='object'||!facts.white||!facts.black)return null;
 if(!Number.isInteger(limit)||limit<1||limit>cap)return null;
 const buckets=new Map(authors.map(author=>[author,[]]));
 for(const entry of bank.entries){
  for(const [side,oppSide] of [['white','black'],['black','white']]){
   const evidence=match(entry.condition,facts[side],facts[oppSide],facts,side);
   if(evidence)buckets.get(entry.author).push({
    id:entry.id,author:entry.author,work:entry.work,sourceUrl:entry.sourceUrl,basis:entry.basis,
    side,theme:entry.theme,idea:entry.idea,goal:entry.goal,positionEvidence:evidence,
    status:'historically_informed_heuristic_not_engine_verified'
   });
  }
 }
 const result=[];
 while(result.length<limit){
  let didAdd=false;
  for(const author of authors){
   const next=buckets.get(author).shift();
   if(next){result.push(next);didAdd=true;if(result.length===limit)break;}
  }
  if(!didAdd)break;
 }
 return result.length?{kind:'strategy_cues',schemaVersion:bank.schemaVersion,fullTextIngested:false,items:result}:null;
}
module.exports={selectStrategyKnowledge};
