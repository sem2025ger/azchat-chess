#!/usr/bin/env node
'use strict';
// Rebuilds the classics knowledge records from their unmodified sources.
//   node scripts/buildClassicsKnowledge.js          write the JSON files
//   node scripts/buildClassicsKnowledge.js --check  exit 1 if a committed file is stale
const fs=require('fs');
const path=require('path');
const {build}=require('../knowledge/buildChessFundamentals');
const {build:buildAlekhine}=require('../knowledge/buildAlekhineBestGames');

const OUTPUTS=[
 {file:path.join(__dirname,'..','knowledge','classics','capablanca-chess-fundamentals.json'),build},
 {file:path.join(__dirname,'..','knowledge','classics','alekhine-best-games-1908-1923.json'),build:buildAlekhine}
];

function serialize(record){return JSON.stringify(record,null,1)+'\n';}

if(require.main===module){
 let stale=0;
 for(const {file,build:make} of OUTPUTS){
  const next=serialize(make());
  const current=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  if(process.argv.includes('--check')){
   if(current!==next){console.error(`stale: ${path.relative(process.cwd(),file)}`);stale++;}
   continue;
  }
  fs.writeFileSync(file,next);
  const r=JSON.parse(next);
  const detail=r.notation
   ?`moves converted ${r.notation.conversion.resolved}/${r.notation.conversion.tokens}`
   :`${r.stats.totalValidatedMoves} validated moves, ${r.stats.uniqueGeneratedFens} unique FENs`;
  console.log(`${path.basename(file)}: ${r.units.length} units, ${detail}`);
 }
 if(stale)process.exit(1);
}
module.exports={serialize,OUTPUTS};
